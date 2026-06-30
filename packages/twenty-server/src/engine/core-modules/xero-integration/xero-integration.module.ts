import { Module } from '@nestjs/common';

import { TwentyConfigModule } from 'src/engine/core-modules/twenty-config/twenty-config.module';
import { XeroController } from 'src/engine/core-modules/xero-integration/controllers/xero.controller';
import { XeroOAuthService } from 'src/engine/core-modules/xero-integration/services/xero-oauth.service';

@Module({
  imports: [TwentyConfigModule],
  providers: [XeroOAuthService],
  controllers: [XeroController],
  exports: [XeroOAuthService],
})
export class XeroIntegrationModule {}
