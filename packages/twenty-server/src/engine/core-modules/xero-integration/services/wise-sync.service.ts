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
