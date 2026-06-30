import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { type EncryptedString } from 'src/engine/core-modules/secret-encryption/branded-strings/encrypted-string.type';
import { type PlaintextString } from 'src/engine/core-modules/secret-encryption/branded-strings/plaintext-string.type';
import { SecretEncryptionService } from 'src/engine/core-modules/secret-encryption/secret-encryption.service';
import { XeroConnectionEntity } from 'src/engine/core-modules/xero-integration/entities/xero-connection.entity';
import { XeroOAuthService } from 'src/engine/core-modules/xero-integration/services/xero-oauth.service';

const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

type SaveConnectionInput = {
  workspaceId: string;
  tenantId: string;
  tenantName: string | null;
  tenantType: string | null;
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  scopes: string;
  connectedByUserId: string | null;
};

@Injectable()
export class XeroConnectionService {
  private readonly logger = new Logger(XeroConnectionService.name);

  constructor(
    @InjectRepository(XeroConnectionEntity)
    private readonly xeroConnectionRepository: Repository<XeroConnectionEntity>,
    private readonly secretEncryptionService: SecretEncryptionService,
    private readonly xeroOAuthService: XeroOAuthService,
  ) {}

  async findByWorkspaceAndTenant(
    workspaceId: string,
    tenantId: string,
  ): Promise<XeroConnectionEntity | null> {
    return this.xeroConnectionRepository.findOne({
      where: { workspaceId, tenantId },
    });
  }

  async getValidAccessToken(connection: XeroConnectionEntity): Promise<string> {
    const expiresAt = connection.accessTokenExpiresAt.getTime();

    if (expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS) {
      return this.decryptAccessToken(connection);
    }

    const refreshToken = this.decryptRefreshToken(connection);
    const refreshed = await this.xeroOAuthService.refreshAccessToken(
      refreshToken,
    );

    connection.refreshTokenCiphertext = this.secretEncryptionService.encryptVersioned(
      refreshed.refresh_token as PlaintextString,
      { workspaceId: connection.workspaceId },
    );
    connection.accessTokenCiphertext = this.secretEncryptionService.encryptVersioned(
      refreshed.access_token as PlaintextString,
      { workspaceId: connection.workspaceId },
    );
    connection.accessTokenExpiresAt = new Date(
      Date.now() + refreshed.expires_in * 1000,
    );
    connection.scopes = refreshed.scope;

    await this.xeroConnectionRepository.save(connection);

    this.logger.log(
      `Refreshed Xero access token for workspace ${connection.workspaceId} tenant ${connection.tenantId}`,
    );

    return refreshed.access_token;
  }

  async saveConnection(input: SaveConnectionInput): Promise<XeroConnectionEntity> {
    const refreshTokenCiphertext = this.secretEncryptionService.encryptVersioned(
      input.refreshToken as PlaintextString,
      { workspaceId: input.workspaceId },
    );
    const accessTokenCiphertext = this.secretEncryptionService.encryptVersioned(
      input.accessToken as PlaintextString,
      { workspaceId: input.workspaceId },
    );

    const accessTokenExpiresAt = new Date(
      Date.now() + input.accessTokenExpiresInSeconds * 1000,
    );

    const existing = await this.xeroConnectionRepository.findOne({
      where: { workspaceId: input.workspaceId, tenantId: input.tenantId },
    });

    if (existing) {
      existing.tenantName = input.tenantName;
      existing.tenantType = input.tenantType;
      existing.refreshTokenCiphertext = refreshTokenCiphertext;
      existing.accessTokenCiphertext = accessTokenCiphertext;
      existing.accessTokenExpiresAt = accessTokenExpiresAt;
      existing.scopes = input.scopes;
      existing.connectedByUserId = input.connectedByUserId;

      return this.xeroConnectionRepository.save(existing);
    }

    return this.xeroConnectionRepository.save(
      this.xeroConnectionRepository.create({
        workspaceId: input.workspaceId,
        tenantId: input.tenantId,
        tenantName: input.tenantName,
        tenantType: input.tenantType,
        refreshTokenCiphertext,
        accessTokenCiphertext,
        accessTokenExpiresAt,
        scopes: input.scopes,
        connectedByUserId: input.connectedByUserId,
      }),
    );
  }

  async listByWorkspace(workspaceId: string): Promise<XeroConnectionEntity[]> {
    return this.xeroConnectionRepository.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteByWorkspaceAndTenant(
    workspaceId: string,
    tenantId: string,
  ): Promise<void> {
    await this.xeroConnectionRepository.delete({ workspaceId, tenantId });
  }

  decryptRefreshToken(connection: XeroConnectionEntity): string {
    return this.secretEncryptionService.decryptVersioned(
      connection.refreshTokenCiphertext as EncryptedString,
      { workspaceId: connection.workspaceId },
    );
  }

  decryptAccessToken(connection: XeroConnectionEntity): string {
    return this.secretEncryptionService.decryptVersioned(
      connection.accessTokenCiphertext as EncryptedString,
      { workspaceId: connection.workspaceId },
    );
  }
}
