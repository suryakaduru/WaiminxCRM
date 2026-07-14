import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { XeroConnectionService } from 'src/engine/core-modules/xero-integration/services/xero-connection.service';
import { FinanceAnalyticsService } from 'src/engine/core-modules/xero-integration/services/finance-analytics.service';
import { FinanceCrudService } from 'src/engine/core-modules/xero-integration/services/finance-crud.service';
import { FinanceReminderService } from 'src/engine/core-modules/xero-integration/services/finance-reminder.service';
import { FinanceReminderCronJob } from 'src/engine/core-modules/xero-integration/jobs/finance-reminder-cron.job';
import { WiseSyncService } from 'src/engine/core-modules/xero-integration/services/wise-sync.service';
import { NotificationService } from 'src/engine/core-modules/xero-integration/services/notification.service';
import { XeroSyncService } from 'src/engine/core-modules/xero-integration/services/xero-sync.service';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

const guards = [JwtAuthGuard, WorkspaceAuthGuard];

@Controller('finance')
@UseGuards(...guards)
export class FinanceController {
  constructor(
    private readonly analytics: FinanceAnalyticsService,
    private readonly crud: FinanceCrudService,
    private readonly xeroSync: XeroSyncService,
    private readonly xeroConnection: XeroConnectionService,
    private readonly wiseSync: WiseSyncService,
    private readonly reminderService: FinanceReminderService,
    private readonly notificationService: NotificationService,
    private readonly reminderCron: FinanceReminderCronJob,
  ) {}

  // On-demand trigger of the daily reminder dispatch (creates CRM tasks +
  // posts Teams alerts for every reminder due now). Used to test the flow
  // without waiting for the 8am cron.
  @Post('reminders/run-due')
  async runDueReminders() {
    await this.reminderCron.handleCron();

    return { ok: true, ranAt: new Date().toISOString() };
  }

  @Get('aging')
  aging(@AuthWorkspace() workspace: WorkspaceEntity) {
    return this.analytics.getAging(workspace.id);
  }

  // Live mid-market FX rate (Wise, with exchangerate.host fallback), cached 60s.
  // Estimate-only: used by the planner to show cross-currency converted amounts.
  @Get('fx/rate')
  async fxRate(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Query('source') source: string,
    @Query('target') target: string,
  ) {
    if (!source || !target) {
      throw new BadRequestException('source and target query params required');
    }

    try {
      return await this.wiseSync.getRate(workspace.id, source, target);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Rate lookup failed',
      );
    }
  }

  @Get('cash-position')
  async cashPosition(@AuthWorkspace() workspace: WorkspaceEntity) {
    const byCurrency = await this.analytics.getCashPosition(workspace.id);

    return { asOf: new Date().toISOString(), byCurrency };
  }

  // Consolidated cash across every currency, converted to NZD at live rates.
  // Saves the accountant the manual weekly conversion for reporting.
  @Get('cash-position/nzd')
  async cashPositionNzd(@AuthWorkspace() workspace: WorkspaceEntity) {
    const base = 'NZD';
    const byCurrency = await this.analytics.getCashPosition(workspace.id);

    let totalNzd = 0;
    let hasErrors = false;

    const breakdown = await Promise.all(
      byCurrency.map(async (row) => {
        try {
          const fx = await this.wiseSync.getRate(
            workspace.id,
            row.currencyCode,
            base,
          );
          const nzd = row.balance * fx.rate;

          totalNzd += nzd;

          return {
            currencyCode: row.currencyCode,
            balance: row.balance,
            rate: fx.rate,
            nzd,
            provider: fx.provider,
            converted: true,
          };
        } catch {
          // One unavailable rate shouldn't break the whole total.
          hasErrors = true;

          return {
            currencyCode: row.currencyCode,
            balance: row.balance,
            rate: null,
            nzd: null,
            provider: null,
            converted: false,
          };
        }
      }),
    );

    return {
      base,
      totalNzd,
      hasErrors,
      asOf: new Date().toISOString(),
      breakdown,
    };
  }

  @Get('cashflow/weekly')
  weekly(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Query('friday') friday: string,
  ) {
    if (!friday) throw new BadRequestException('friday query param required (YYYY-MM-DD)');

    return this.analytics.getWeeklyPlanner(workspace.id, friday);
  }

  @Get('cashflow/plan')
  async getPlan(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Query('friday') friday: string,
  ) {
    if (!friday) throw new BadRequestException('friday query param required');
    const plan = await this.crud.getPlan(workspace.id, friday);

    return { plan };
  }

  @Post('cashflow/plan')
  savePlan(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Body()
    body: {
      fridayDate: string;
      notes?: string;
      lines: Array<{
        tenantId: string;
        xeroInvoiceId: string;
        bankAccountId?: string;
        amount: number;
        currencyCode: string;
        included?: boolean;
      }>;
    },
  ) {
    if (!body?.fridayDate || !Array.isArray(body.lines)) {
      throw new BadRequestException('fridayDate and lines[] required');
    }

    if (body.lines.some((l) => !l.tenantId)) {
      throw new BadRequestException('All lines must have a tenantId');
    }

    return this.crud.savePlan({
      workspaceId: workspace.id,
      fridayDate: body.fridayDate,
      notes: body.notes ?? null,
      lines: body.lines,
    });
  }

  @Post('cashflow/plan/commit')
  commitPlan(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Body() body: { fridayDate: string },
  ) {
    if (!body?.fridayDate) {
      throw new BadRequestException('fridayDate required');
    }

    return this.crud.commitPlan(workspace.id, body.fridayDate);
  }

  @Get('notification-settings')
  getNotificationSettings(@AuthWorkspace() workspace: WorkspaceEntity) {
    return this.notificationService.getSetting(workspace.id);
  }

  @Post('notification-settings')
  saveNotificationSettings(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Body() body: { teamsWebhookUrl?: string | null },
  ) {
    return this.notificationService.saveWebhook(
      workspace.id,
      body?.teamsWebhookUrl ?? null,
    );
  }

  @Post('notification-settings/test')
  async testNotification(@AuthWorkspace() workspace: WorkspaceEntity) {
    const sent = await this.notificationService.sendTeams(
      workspace.id,
      'Waimin CRM test',
      'This is a test message from your Waimin finance reminders. If you can see this, Teams notifications are working. ✅',
    );

    if (!sent) {
      throw new BadRequestException(
        'No Teams webhook configured, or Teams rejected the message. Save a valid webhook URL first.',
      );
    }

    return { sent: true };
  }

  @Get('bank-accounts')
  listBankAccounts(@AuthWorkspace() workspace: WorkspaceEntity) {
    return this.crud.listBankAccounts(workspace.id);
  }

  @Post('bank-accounts')
  createBankAccount(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Body()
    body: {
      bankName: string;
      accountLabel?: string;
      currencyCode: string;
      balance: number;
      source?: 'manual' | 'xero' | 'wise' | 'statrys';
      bankRole?: 'main' | 'international' | 'expense' | 'other';
      xeroAccountId?: string;
      sortOrder?: number;
    },
  ) {
    if (!body?.bankName || !body?.currencyCode) {
      throw new BadRequestException('bankName and currencyCode required');
    }

    return this.crud.upsertBankAccount({
      workspaceId: workspace.id,
      bankName: body.bankName,
      accountLabel: body.accountLabel ?? null,
      currencyCode: body.currencyCode,
      balance: Number(body.balance ?? 0),
      source: body.source,
      bankRole: body.bankRole,
      xeroAccountId: body.xeroAccountId ?? null,
      sortOrder: body.sortOrder,
    });
  }

  @Put('bank-accounts/:id')
  updateBankAccount(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Param('id') id: string,
    @Body()
    body: {
      bankName: string;
      accountLabel?: string;
      currencyCode: string;
      balance: number;
      source?: 'manual' | 'xero' | 'wise' | 'statrys';
      bankRole?: 'main' | 'international' | 'expense' | 'other';
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    return this.crud.upsertBankAccount({
      id,
      workspaceId: workspace.id,
      bankName: body.bankName,
      accountLabel: body.accountLabel ?? null,
      currencyCode: body.currencyCode,
      balance: Number(body.balance ?? 0),
      source: body.source,
      bankRole: body.bankRole,
      isActive: body.isActive,
      sortOrder: body.sortOrder,
    });
  }

  @Delete('bank-accounts/:id')
  async deleteBankAccount(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Param('id') id: string,
  ) {
    await this.crud.deleteBankAccount(workspace.id, id);

    return { ok: true };
  }

  @Get('adjustments')
  listAdjustments(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Query('friday') friday: string,
  ) {
    if (!friday) throw new BadRequestException('friday query param required');

    return this.crud.listAdjustments(workspace.id, friday);
  }

  @Post('adjustments')
  upsertAdjustment(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUser() user: UserEntity,
    @Body()
    body: {
      id?: string;
      fridayDate: string;
      direction: 'in' | 'out';
      label: string;
      currencyCode: string;
      amount: number;
      bankAccountId?: string;
      note?: string;
    },
  ) {
    if (
      !body?.fridayDate ||
      !body?.direction ||
      !body?.label ||
      !body?.currencyCode
    ) {
      throw new BadRequestException(
        'fridayDate, direction, label, and currencyCode required',
      );
    }
    if (body.direction !== 'in' && body.direction !== 'out') {
      throw new BadRequestException('direction must be "in" or "out"');
    }

    return this.crud.upsertAdjustment({
      id: body.id,
      workspaceId: workspace.id,
      fridayDate: body.fridayDate,
      direction: body.direction,
      label: body.label,
      currencyCode: body.currencyCode,
      amount: Number(body.amount ?? 0),
      bankAccountId: body.bankAccountId ?? null,
      note: body.note ?? null,
      createdByUserId: user.id,
    });
  }

  @Delete('adjustments/:id')
  async deleteAdjustment(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Param('id') id: string,
  ) {
    await this.crud.deleteAdjustment(workspace.id, id);

    return { ok: true };
  }

  @Get('mandatory-payments')
  listMandatoryPayments(@AuthWorkspace() workspace: WorkspaceEntity) {
    return this.crud.listMandatoryPayments(workspace.id);
  }

  @Post('mandatory-payments')
  upsertMandatoryPayment(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Body()
    body: {
      id?: string;
      type:
        | 'payroll'
        | 'gst'
        | 'rent'
        | 'loan'
        | 'credit_card'
        | 'trust_account'
        | 'inland_revenue'
        | 'bank_recon'
        | 'custom';
      label: string;
      currencyCode: string;
      amount: number;
      frequencyCron: string;
      nextDueDate: string;
      bankAccountId?: string;
      isActive?: boolean;
    },
  ) {
    if (
      !body?.type ||
      !body?.label ||
      !body?.currencyCode ||
      !body?.frequencyCron ||
      !body?.nextDueDate
    ) {
      throw new BadRequestException(
        'type, label, currencyCode, frequencyCron, and nextDueDate required',
      );
    }

    return this.crud.upsertMandatoryPayment({
      id: body.id,
      workspaceId: workspace.id,
      type: body.type,
      label: body.label,
      currencyCode: body.currencyCode,
      amount: Number(body.amount ?? 0),
      frequencyCron: body.frequencyCron,
      nextDueDate: body.nextDueDate,
      bankAccountId: body.bankAccountId ?? null,
      isActive: body.isActive,
    });
  }

  @Delete('mandatory-payments/:id')
  async deleteMandatoryPayment(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Param('id') id: string,
  ) {
    await this.crud.deleteMandatoryPayment(workspace.id, id);

    return { ok: true };
  }

  @Get('priorities')
  listPriorities(@AuthWorkspace() workspace: WorkspaceEntity) {
    return this.crud.listPriorities(workspace.id);
  }

  @Post('priorities')
  upsertPriority(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Body()
    body: {
      tenantId: string;
      xeroInvoiceId: string;
      priority?: number;
      mustPay?: boolean;
      note?: string;
    },
  ) {
    if (!body?.tenantId || !body?.xeroInvoiceId) {
      throw new BadRequestException('tenantId and xeroInvoiceId required');
    }

    return this.crud.upsertPriority({
      workspaceId: workspace.id,
      tenantId: body.tenantId,
      xeroInvoiceId: body.xeroInvoiceId,
      priority: body.priority,
      mustPay: body.mustPay,
      note: body.note ?? null,
    });
  }

  @Post('xero/sync')
  async triggerSync(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Query('tenantId') tenantId: string | undefined,
  ) {
    const connections = await this.xeroConnection.listByWorkspace(workspace.id);

    if (connections.length === 0) throw new NotFoundException('No Xero connection');

    const targets = tenantId
      ? connections.filter((c) => c.tenantId === tenantId)
      : connections;

    if (targets.length === 0) throw new NotFoundException('Tenant not found');

    const results = [];

    for (const connection of targets) {
      results.push({
        tenantId: connection.tenantId,
        synced: await this.xeroSync.syncConnection(connection),
      });
    }

    return { results };
  }

  @Get('xero/sync/status')
  async syncStatus(@AuthWorkspace() workspace: WorkspaceEntity) {
    const cursors = await this.xeroSync.listCursors(workspace.id);

    return {
      cursors: cursors.map((cursor) => ({
        tenantId: cursor.tenantId,
        entityType: cursor.entityType,
        status: cursor.status,
        lastSyncedAt: cursor.lastSyncedAt,
        lastCursorAt: cursor.lastCursorAt,
        lastError: cursor.lastError,
        recordsSyncedLastRun: cursor.recordsSyncedLastRun,
      })),
    };
  }

  @Post('wise/connect')
  async connectWise(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUser() user: UserEntity,
    @Body() body: { token: string },
  ) {
    if (!body?.token) {
      throw new BadRequestException('Wise API token required');
    }

    await this.wiseSync.saveToken(workspace.id, body.token, user.id);
    // Initial sync
    const result = await this.wiseSync.syncBalances(workspace.id);

    return { success: true, ...result };
  }

  @Post('wise/sync')
  async syncWise(@AuthWorkspace() workspace: WorkspaceEntity) {
    const result = await this.wiseSync.syncBalances(workspace.id);

    return { success: true, ...result };
  }

  @Get('accountants')
  listAccountants(@AuthWorkspace() workspace: WorkspaceEntity) {
    return this.reminderService.listAccountants(workspace.id);
  }

  @Get('reminders')
  listReminders(@AuthWorkspace() workspace: WorkspaceEntity) {
    return this.reminderService.listReminders(workspace.id);
  }

  @Post('reminders')
  upsertReminder(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Body()
    body: {
      id?: string;
      title: string;
      type:
        | 'payroll'
        | 'gst'
        | 'rent'
        | 'loan'
        | 'credit_card'
        | 'trust_account'
        | 'inland_revenue'
        | 'bank_recon'
        | 'custom';
      frequencyCron: string;
      nextDueDate: string;
      timezone?: string;
      isActive?: boolean;
      assigneeId?: string;
    },
  ) {
    if (!body?.title || !body?.type || !body?.frequencyCron || !body?.nextDueDate) {
      throw new BadRequestException('title, type, frequencyCron, and nextDueDate required');
    }

    return this.reminderService.upsertReminder({
      id: body.id,
      workspaceId: workspace.id,
      title: body.title,
      type: body.type,
      frequencyCron: body.frequencyCron,
      nextDueDate: body.nextDueDate,
      timezone: body.timezone,
      isActive: body.isActive,
      assigneeId: body.assigneeId,
    });
  }

  @Delete('reminders/:id')
  async deleteReminder(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Param('id') id: string,
  ) {
    await this.reminderService.deleteReminder(workspace.id, id);
    return { ok: true };
  }
}
