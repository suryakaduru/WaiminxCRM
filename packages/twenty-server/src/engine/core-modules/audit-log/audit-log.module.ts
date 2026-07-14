import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TokenModule } from 'src/engine/core-modules/auth/token/token.module';
import { AuditLogController } from 'src/engine/core-modules/audit-log/controllers/audit-log.controller';
import { WaiminAuditLogEntity } from 'src/engine/core-modules/audit-log/entities/waimin-audit-log.entity';
import { AuditLogPurgeCronJob } from 'src/engine/core-modules/audit-log/jobs/audit-log-purge-cron.job';
import { AuditLogService } from 'src/engine/core-modules/audit-log/services/audit-log.service';
import { PermissionsModule } from 'src/engine/metadata-modules/permissions/permissions.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WaiminAuditLogEntity]),
    // JwtAuthGuard on the controller needs AccessTokenService (TokenModule)
    // and WorkspaceCacheStorageService. PermissionsModule provides the
    // AUDIT_LOGS flag check.
    TokenModule,
    WorkspaceCacheStorageModule,
    PermissionsModule,
  ],
  providers: [AuditLogService, AuditLogPurgeCronJob],
  controllers: [AuditLogController],
  exports: [AuditLogService],
})
export class AuditLogModule {}
