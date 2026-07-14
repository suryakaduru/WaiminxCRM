import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { AuditLogService } from 'src/engine/core-modules/audit-log/services/audit-log.service';

const RETENTION_DAYS = 90;

@Injectable()
export class AuditLogPurgeCronJob {
  private readonly logger = new Logger(AuditLogPurgeCronJob.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  // Daily at 03:15. Drops audit rows past the retention window.
  @Cron('15 3 * * *')
  async scheduledRun() {
    // Only the server registers crons; guard so it doesn't also fire on worker.
    if (process.env.DISABLE_CRON_JOBS_REGISTRATION === 'true') return;

    await this.handleCron();
  }

  async handleCron() {
    const cutoff = new Date();

    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const deleted = await this.auditLogService.purgeOlderThan(cutoff);

    this.logger.log(
      `Audit log purge: removed ${deleted} rows older than ${RETENTION_DAYS} days.`,
    );
  }
}
