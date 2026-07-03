import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  WaiminFinanceReminderEntity,
  type FinanceReminderType,
} from 'src/engine/core-modules/xero-integration/entities/waimin-finance-reminder.entity';
import { WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';

export type UpsertReminderInput = {
  id?: string;
  workspaceId: string;
  title: string;
  type: FinanceReminderType;
  frequencyCron: string;
  nextDueDate: string;
  isActive?: boolean;
  assigneeId?: string | null;
};

@Injectable()
export class FinanceReminderService {
  constructor(
    @InjectRepository(WaiminFinanceReminderEntity)
    private readonly reminderRepository: Repository<WaiminFinanceReminderEntity>,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async listAccountants(workspaceId: string) {
    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const repo = await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberWorkspaceEntity>(
          workspaceId,
          'workspaceMember',
        );
        const members = await repo.find();
        return members.map(m => ({
          id: m.id,
          name: `${m.name?.firstName ?? ''} ${m.name?.lastName ?? ''}`.trim() || 'Unknown User',
        }));
      },
      buildSystemAuthContext(workspaceId),
    );
  }

  async listReminders(workspaceId: string) {
    return this.reminderRepository.find({
      where: { workspaceId },
      order: { nextDueDate: 'ASC' },
    });
  }

  async upsertReminder(input: UpsertReminderInput) {
    // Empty string from an unselected assignee dropdown is not a valid uuid.
    const assigneeId =
      input.assigneeId && input.assigneeId.trim() !== ''
        ? input.assigneeId
        : null;

    input = { ...input, assigneeId };

    if (input.id) {
      const existing = await this.reminderRepository.findOne({
        where: { id: input.id, workspaceId: input.workspaceId },
      });

      if (!existing) throw new NotFoundException('Reminder not found');

      Object.assign(existing, {
        title: input.title,
        type: input.type,
        frequencyCron: input.frequencyCron,
        nextDueDate: new Date(input.nextDueDate),
        isActive: input.isActive ?? existing.isActive,
        assigneeId: input.assigneeId ?? existing.assigneeId,
      });

      return this.reminderRepository.save(existing);
    }

    const newReminder = this.reminderRepository.create({
      workspaceId: input.workspaceId,
      title: input.title,
      type: input.type,
      frequencyCron: input.frequencyCron,
      nextDueDate: new Date(input.nextDueDate),
      isActive: input.isActive ?? true,
      assigneeId: input.assigneeId ?? null,
    });

    return this.reminderRepository.save(newReminder);
  }

  async deleteReminder(workspaceId: string, id: string) {
    const existing = await this.reminderRepository.findOne({
      where: { id, workspaceId },
    });

    if (!existing) throw new NotFoundException('Reminder not found');

    await this.reminderRepository.remove(existing);
  }
}
