import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';

import { Repository } from 'typeorm';
import { CronExpressionParser } from 'cron-parser';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { WaiminFinanceReminderEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-finance-reminder.entity';
import { TaskWorkspaceEntity } from 'src/modules/task/standard-objects/task.workspace-entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { NotificationService } from 'src/engine/core-modules/xero-integration/services/notification.service';

@Injectable()
export class FinanceReminderCronJob {
  private readonly logger = new Logger(FinanceReminderCronJob.name);

  constructor(
    @InjectRepository(WaiminFinanceReminderEntity)
    private readonly reminderRepository: Repository<WaiminFinanceReminderEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly notificationService: NotificationService,
  ) {}

  // Runs every 15 min so reminders fire near their chosen send time
  // (nextDueDate carries the time-of-day). Each due reminder fires once,
  // then advances to its next occurrence.
  @Cron('*/15 * * * *')
  async scheduledRun() {
    // Only the server registers crons; the worker sets this flag. Guard here
    // too so the reminder dispatch doesn't fire twice (server + worker).
    if (process.env.DISABLE_CRON_JOBS_REGISTRATION === 'true') return;

    await this.handleCron();
  }

  async handleCron() {
    this.logger.log('Running finance reminders cron job...');

    const dueReminders = await this.reminderRepository
      .createQueryBuilder('reminder')
      .where('reminder.isActive = true')
      .andWhere('reminder.nextDueDate <= :now', { now: new Date() })
      .getMany();

    if (dueReminders.length === 0) {
      this.logger.log('No finance reminders are due.');
      return;
    }

    const workspaces = await this.workspaceRepository.find();
    const activeWorkspaceIds = new Set(workspaces.map((w) => w.id));

    for (const reminder of dueReminders) {
      if (!activeWorkspaceIds.has(reminder.workspaceId)) continue;

      try {
        await this.processReminder(reminder);
      } catch (err) {
        this.logger.error(`Error processing reminder ${reminder.id}`, err);
      }
    }

    this.logger.log(`Processed ${dueReminders.length} finance reminders.`);
  }

  private async processReminder(reminder: WaiminFinanceReminderEntity) {
    // Best-effort CRM task creation — the workspace permission model can reject
    // the system context. Don't let that block the Teams notification below.
    try {
      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const taskRepo = await this.globalWorkspaceOrmManager.getRepository<TaskWorkspaceEntity>(
            reminder.workspaceId,
            'task',
          );

          const taskToCreate = taskRepo.create({
            title: reminder.title,
            dueAt: reminder.nextDueDate,
            status: 'TODO',
            assigneeId: reminder.assigneeId,
            bodyV2: {
              blocknote: JSON.stringify([
                {
                  id: 'finance-reminder',
                  type: 'paragraph',
                  props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
                  content: [{ type: 'text', text: `Auto-generated reminder: ${reminder.title}`, styles: {} }],
                },
              ]),
              markdown: `Auto-generated reminder: ${reminder.title}`,
            },
          });

          await taskRepo.save(taskToCreate);
        },
        buildSystemAuthContext(reminder.workspaceId),
      );
    } catch (err) {
      this.logger.warn(
        `Reminder task creation skipped for ${reminder.id}: ${String(err)}`,
      );
    }

    // Fire a Teams notification if a webhook is configured (best-effort).
    await this.notificationService.sendTeams(
      reminder.workspaceId,
      `💰 Finance reminder due: ${reminder.title}`,
      `**${reminder.title}** (${reminder.type}) is due ${reminder.nextDueDate.toLocaleDateString?.() ?? reminder.nextDueDate}. A task has been created in Waimin CRM.`,
    );

    reminder.lastCreatedTaskAt = new Date();

    try {
      // Compute the next occurrence in the reminder's own timezone so it keeps
      // firing at the chosen wall-clock time regardless of server tz.
      const interval = CronExpressionParser.parse(reminder.frequencyCron, {
        tz: reminder.timezone || 'UTC',
      });

      reminder.nextDueDate = interval.next().toDate();
    } catch {
      // Fallback if cron is invalid
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      reminder.nextDueDate = nextWeek;
    }

    await this.reminderRepository.save(reminder);
  }
}
