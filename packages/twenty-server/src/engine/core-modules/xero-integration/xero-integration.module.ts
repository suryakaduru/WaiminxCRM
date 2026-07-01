import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TokenModule } from 'src/engine/core-modules/auth/token/token.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { SecretEncryptionModule } from 'src/engine/core-modules/secret-encryption/secret-encryption.module';
import { TwentyConfigModule } from 'src/engine/core-modules/twenty-config/twenty-config.module';
import { XeroController } from 'src/engine/core-modules/xero-integration/controllers/xero.controller';
import { XeroConnectionEntity } from 'src/engine/core-modules/xero-integration/entities/xero-connection.entity';
import { XeroConnectionService } from 'src/engine/core-modules/xero-integration/services/xero-connection.service';
import { XeroOAuthService } from 'src/engine/core-modules/xero-integration/services/xero-oauth.service';
import { PermissionsModule } from 'src/engine/metadata-modules/permissions/permissions.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([XeroConnectionEntity]),
    TwentyConfigModule,
    SecretEncryptionModule,
    JwtModule,
    TokenModule,
    WorkspaceCacheModule,
    WorkspaceCacheStorageModule,
    PermissionsModule,
  ],
  providers: [XeroOAuthService, XeroConnectionService],
  controllers: [XeroController],
  exports: [XeroOAuthService, XeroConnectionService],
})
export class XeroIntegrationModule {}
