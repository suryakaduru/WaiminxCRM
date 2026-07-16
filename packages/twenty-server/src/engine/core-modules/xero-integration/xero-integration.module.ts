import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TokenModule } from 'src/engine/core-modules/auth/token/token.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { SecretEncryptionModule } from 'src/engine/core-modules/secret-encryption/secret-encryption.module';
import { TwentyConfigModule } from 'src/engine/core-modules/twenty-config/twenty-config.module';
import { XeroSyncCronCommand } from 'src/engine/core-modules/xero-integration/commands/xero-sync-cron.command';
import { FinanceController } from 'src/engine/core-modules/xero-integration/controllers/finance.controller';
import { FinancePermissionGuard } from 'src/engine/core-modules/xero-integration/guards/finance-permission.guard';
import { XeroController } from 'src/engine/core-modules/xero-integration/controllers/xero.controller';
import { WaiminBankAccountEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-bank-account.entity';
import { WaiminPaymentPlanLineEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-payment-plan-line.entity';
import { WaiminPaymentPlanEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-payment-plan.entity';
import { WaiminPaymentPriorityEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-payment-priority.entity';
import { XeroBankAccountEntity } from 'src/engine/core-modules/xero-integration/entities/xero-bank-account.entity';
import { XeroConnectionEntity } from 'src/engine/core-modules/xero-integration/entities/xero-connection.entity';
import { XeroContactEntity } from 'src/engine/core-modules/xero-integration/entities/xero-contact.entity';
import { XeroInvoiceEntity } from 'src/engine/core-modules/xero-integration/entities/xero-invoice.entity';
import { XeroSyncCursorEntity } from 'src/engine/core-modules/xero-integration/entities/xero-sync-cursor.entity';
import { WiseConnectionEntity } from 'src/engine/core-modules/xero-integration/entities/wise-connection.entity';
import { WaiminFinanceReminderEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-finance-reminder.entity';
import { WaiminNotificationSettingEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-notification-setting.entity';
import { WaiminManualAdjustmentEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-manual-adjustment.entity';
import { WaiminMandatoryPaymentEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-mandatory-payment.entity';
import { NotificationService } from 'src/engine/core-modules/xero-integration/services/notification.service';
import { FinanceReminderCronJob } from 'src/engine/core-modules/xero-integration/jobs/finance-reminder-cron.job';
import { XeroSyncCronJob } from 'src/engine/core-modules/xero-integration/jobs/xero-sync-cron.job';
import { XeroSyncJob } from 'src/engine/core-modules/xero-integration/jobs/xero-sync.job';
import { FinanceAnalyticsService } from 'src/engine/core-modules/xero-integration/services/finance-analytics.service';
import { FinanceCrudService } from 'src/engine/core-modules/xero-integration/services/finance-crud.service';
import { FinanceReminderService } from 'src/engine/core-modules/xero-integration/services/finance-reminder.service';
import { XeroConnectionService } from 'src/engine/core-modules/xero-integration/services/xero-connection.service';
import { XeroOAuthService } from 'src/engine/core-modules/xero-integration/services/xero-oauth.service';
import { XeroSyncService } from 'src/engine/core-modules/xero-integration/services/xero-sync.service';
import { PermissionsModule } from 'src/engine/metadata-modules/permissions/permissions.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { WiseSyncService } from 'src/engine/core-modules/xero-integration/services/wise-sync.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { TwentyORMModule } from 'src/engine/twenty-orm/twenty-orm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      XeroConnectionEntity,
      XeroInvoiceEntity,
      XeroContactEntity,
      XeroBankAccountEntity,
      XeroSyncCursorEntity,
      WaiminBankAccountEntity,
      WaiminPaymentPriorityEntity,
      WaiminPaymentPlanEntity,
      WaiminPaymentPlanLineEntity,
      WiseConnectionEntity,
      WaiminFinanceReminderEntity,
      WaiminNotificationSettingEntity,
      WaiminManualAdjustmentEntity,
      WaiminMandatoryPaymentEntity,
      WorkspaceEntity,
    ]),
    TwentyConfigModule,
    SecretEncryptionModule,
    JwtModule,
    TokenModule,
    WorkspaceCacheModule,
    WorkspaceCacheStorageModule,
    PermissionsModule,
    TwentyORMModule,
  ],
  providers: [
    XeroOAuthService,
    XeroConnectionService,
    XeroSyncService,
    FinanceAnalyticsService,
    FinanceCrudService,
    XeroSyncJob,
    XeroSyncCronJob,
    XeroSyncCronCommand,
    WiseSyncService,
    FinanceReminderService,
    FinanceReminderCronJob,
    NotificationService,
    FinancePermissionGuard,
  ],
  controllers: [XeroController, FinanceController],
  exports: [XeroOAuthService, XeroConnectionService, XeroSyncService, WiseSyncService],
})
export class XeroIntegrationModule {}
