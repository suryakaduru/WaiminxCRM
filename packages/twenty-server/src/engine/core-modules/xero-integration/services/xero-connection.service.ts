import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { type EncryptedString } from 'src/engine/core-modules/secret-encryption/branded-strings/encrypted-string.type';
import { type PlaintextString } from 'src/engine/core-modules/secret-encryption/branded-strings/plaintext-string.type';
import { SecretEncryptionService } from 'src/engine/core-modules/secret-encryption/secret-encryption.service';
import { XeroConnectionEntity } from 'src/engine/core-modules/xero-integration/entities/xero-connection.entity';

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
  ) {}

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
