import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { type EncryptedString } from 'src/engine/core-modules/secret-encryption/branded-strings/encrypted-string.type';
import { type PlaintextString } from 'src/engine/core-modules/secret-encryption/branded-strings/plaintext-string.type';
import { SecretEncryptionService } from 'src/engine/core-modules/secret-encryption/secret-encryption.service';
import { WaiminBankAccountEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-bank-account.entity';
import { WiseConnectionEntity } from 'src/engine/core-modules/xero-integration/entities/wise-connection.entity';

@Injectable()
export class WiseSyncService {
  private readonly logger = new Logger(WiseSyncService.name);

  constructor(
    @InjectRepository(WiseConnectionEntity)
    private readonly wiseConnectionRepository: Repository<WiseConnectionEntity>,
    @InjectRepository(WaiminBankAccountEntity)
    private readonly bankAccountRepository: Repository<WaiminBankAccountEntity>,
    private readonly secretEncryptionService: SecretEncryptionService,
  ) {}

  async saveToken(
    workspaceId: string,
    token: string,
    connectedByUserId: string,
  ) {
    let connection = await this.wiseConnectionRepository.findOne({
      where: { workspaceId },
    });

    if (!connection) {
      connection = this.wiseConnectionRepository.create({
        workspaceId,
      });
    }

    connection.apiTokenCiphertext =
      this.secretEncryptionService.encryptVersioned(
        token as PlaintextString,
        { workspaceId },
      );
    connection.connectedByUserId = connectedByUserId;

    // Verify token works and fetch profile
    const profileId = await this.fetchProfileId(token);
    connection.profileId = profileId;

    await this.wiseConnectionRepository.save(connection);
  }

  async syncBalances(workspaceId: string): Promise<{ synced: number; currencies: string[] }> {
    const connection = await this.wiseConnectionRepository.findOne({
      where: { workspaceId },
    });

    if (!connection || !connection.profileId) {
      return { synced: 0, currencies: [] };
    }

    const syncedCurrencies: string[] = [];

    const token = this.secretEncryptionService.decryptVersioned(
      connection.apiTokenCiphertext as EncryptedString,
      { workspaceId },
    );

    const accounts = await this.fetchBorderlessAccounts(token, connection.profileId);

    // Save each balance to WaiminBankAccountEntity
    for (const account of accounts) {
      for (const balance of account.balances) {
        // Find existing bank account
        let bankAccount = await this.bankAccountRepository.findOne({
          where: {
            workspaceId,
            source: 'wise',
            currencyCode: balance.currency,
          },
        });

        if (!bankAccount) {
          // Find max sort order to append
          const existing = await this.bankAccountRepository.find({
            where: { workspaceId },
            order: { sortOrder: 'DESC' },
            take: 1,
          });
          const maxSortOrder = existing[0]?.sortOrder ?? 0;

          bankAccount = this.bankAccountRepository.create({
            workspaceId,
            source: 'wise',
            bankName: 'Wise',
            accountLabel: `Wise ${balance.currency}`,
            currencyCode: balance.currency,
            sortOrder: maxSortOrder + 1,
            isActive: true,
          });
        }

        bankAccount.balance = balance.amount.value.toString();
        bankAccount.balanceAsOf = new Date();

        await this.bankAccountRepository.save(bankAccount);
        syncedCurrencies.push(balance.currency);
      }
    }

    return { synced: syncedCurrencies.length, currencies: syncedCurrencies };
  }

  // Short-lived in-memory FX cache. Keyed by "SOURCE->TARGET".
  // 60s TTL keeps the planner effectively real-time without hammering Wise
  // on every re-render.
  private readonly rateCache = new Map<
    string,
    { rate: number; provider: string; asOf: string; fetchedAtMs: number }
  >();
  private static readonly RATE_TTL_MS = 60_000;

  async getRate(
    workspaceId: string,
    source: string,
    target: string,
  ): Promise<{ rate: number; provider: string; asOf: string }> {
    const src = source?.toUpperCase();
    const tgt = target?.toUpperCase();

    if (!src || !tgt) {
      throw new Error('source and target currency codes are required');
    }
    if (src === tgt) {
      return { rate: 1, provider: 'identity', asOf: new Date().toISOString() };
    }

    const cacheKey = `${src}->${tgt}`;
    const cached = this.rateCache.get(cacheKey);

    if (
      cached &&
      Date.now() - cached.fetchedAtMs < WiseSyncService.RATE_TTL_MS
    ) {
      return { rate: cached.rate, provider: cached.provider, asOf: cached.asOf };
    }

    const result =
      (await this.fetchWiseRate(workspaceId, src, tgt)) ??
      (await this.fetchFallbackRate(src, tgt));

    if (!result) {
      throw new Error(`No exchange rate available for ${src} → ${tgt}`);
    }

    this.rateCache.set(cacheKey, { ...result, fetchedAtMs: Date.now() });

    return result;
  }

  // Live mid-market rate from Wise, using the workspace's connected token.
  // Returns null (not throws) so the caller can fall back cleanly.
  private async fetchWiseRate(
    workspaceId: string,
    source: string,
    target: string,
  ): Promise<{ rate: number; provider: string; asOf: string } | null> {
    try {
      const connection = await this.wiseConnectionRepository.findOne({
        where: { workspaceId },
      });

      if (!connection?.apiTokenCiphertext) return null;

      const token = this.secretEncryptionService.decryptVersioned(
        connection.apiTokenCiphertext as EncryptedString,
        { workspaceId },
      );

      const res = await fetch(
        `https://api.wise.com/v1/rates?source=${source}&target=${target}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!res.ok) return null;

      const data = await res.json();
      const entry = Array.isArray(data) ? data[0] : data;

      if (!entry || typeof entry.rate !== 'number') return null;

      return {
        rate: entry.rate,
        provider: 'wise',
        asOf: entry.time ?? new Date().toISOString(),
      };
    } catch (error) {
      this.logger.warn(`Wise rate lookup failed: ${String(error)}`);

      return null;
    }
  }

  // Free fallback when Wise isn't connected or errors. Uses open.er-api.com
  // (no API key, 160+ currencies incl. MYR/INR/HKD). exchangerate.host was
  // dropped — it now requires a paid access key and silently returns no rates.
  private async fetchFallbackRate(
    source: string,
    target: string,
  ): Promise<{ rate: number; provider: string; asOf: string } | null> {
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${source}`);

      if (!res.ok) return null;

      const data = await res.json();
      const rate = data?.rates?.[target];

      if (typeof rate !== 'number') return null;

      return {
        rate,
        provider: 'open.er-api.com',
        asOf: data.time_last_update_utc ?? new Date().toISOString(),
      };
    } catch (error) {
      this.logger.warn(`Fallback rate lookup failed: ${String(error)}`);

      return null;
    }
  }

  private async fetchProfileId(token: string): Promise<string> {
    const res = await fetch('https://api.wise.com/v1/profiles', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Wise API error: ${res.status} - ${text}`);
    }

    const data = await res.json();
    if (!data || data.length === 0) {
      throw new Error('No Wise profile found for this token');
    }

    return data[0].id.toString();
  }

  private async fetchBorderlessAccounts(token: string, profileId: string): Promise<any[]> {
    const res = await fetch(
      `https://api.wise.com/v1/borderless-accounts?profileId=${profileId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Wise API error: ${res.status} - ${text}`);
    }

    return res.json();
  }
}
