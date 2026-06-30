import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SecretEncryptionModule } from 'src/engine/core-modules/secret-encryption/secret-encryption.module';
import { TwentyConfigModule } from 'src/engine/core-modules/twenty-config/twenty-config.module';
import { XeroController } from 'src/engine/core-modules/xero-integration/controllers/xero.controller';
import { XeroConnectionEntity } from 'src/engine/core-modules/xero-integration/entities/xero-connection.entity';
import { XeroConnectionService } from 'src/engine/core-modules/xero-integration/services/xero-connection.service';
import { XeroOAuthService } from 'src/engine/core-modules/xero-integration/services/xero-oauth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([XeroConnectionEntity]),
    TwentyConfigModule,
    SecretEncryptionModule,
  ],
  providers: [XeroOAuthService, XeroConnectionService],
  controllers: [XeroController],
  exports: [XeroOAuthService, XeroConnectionService],
})
export class XeroIntegrationModule {}
