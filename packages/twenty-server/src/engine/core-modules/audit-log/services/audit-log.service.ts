import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { isDefined } from 'twenty-shared/utils';

import { Between, In, LessThan, Repository } from 'typeorm';
import { type QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { WaiminAuditLogEntity } from 'src/engine/core-modules/audit-log/entities/waimin-audit-log.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';

export type AuditLogInput = {
  workspaceId: string;
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  objectName?: string | null;
  recordId?: string | null;
  recordName?: string | null;
  diff?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  context?: Record<string, unknown> | null;
};

export type AuditLogQuery = {
  workspaceId: string;
  userId?: string;
  action?: string;
  objectName?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
};

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(WaiminAuditLogEntity)
    private readonly auditLogRepository: Repository<WaiminAuditLogEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  // Fire-and-forget write. Auditing must never break the action being audited,
  // so any failure is logged and swallowed.
  async record(input: AuditLogInput): Promise<void> {
    try {
      // jsonb columns are typed as Record<string, unknown>, which TypeORM's
      // QueryDeepPartialEntity recursion rejects — cast the payload past it.
      const values = {
        workspaceId: input.workspaceId,
        userId: input.userId ?? null,
        userEmail: input.userEmail ?? null,
        action: input.action,
        objectName: input.objectName ?? null,
        recordId: input.recordId ?? null,
        recordName: input.recordName ?? null,
        diff: input.diff ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        context: input.context ?? null,
      } as unknown as QueryDeepPartialEntity<WaiminAuditLogEntity>;

      await this.auditLogRepository.insert(values);
    } catch (error) {
      this.logger.error(
        `Failed to write audit log (${input.action}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async find(
    query: AuditLogQuery,
  ): Promise<{ rows: WaiminAuditLogEntity[]; total: number }> {
    const limit = Math.min(query.limit ?? 50, 200);
    const offset = query.offset ?? 0;

    const where: Record<string, unknown> = { workspaceId: query.workspaceId };

    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = query.action;
    if (query.objectName) where.objectName = query.objectName;

    if (query.from && query.to) {
      where.createdAt = Between(query.from, query.to);
    } else if (query.from) {
      where.createdAt = Between(query.from, new Date());
    }

    const [rows, total] = await this.auditLogRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    // Resolve actor UUIDs to human names so the viewer shows "Jane Doe",
    // not a raw userId. userEmail is already stored for auth events.
    const userIds = [
      ...new Set(
        rows
          .filter((row) => !row.userEmail && isDefined(row.userId))
          .map((row) => row.userId as string),
      ),
    ];

    if (userIds.length > 0) {
      const users = await this.userRepository.find({
        where: { id: In(userIds) },
      });
      const nameByUserId = new Map(
        users.map((user) => [
          user.id,
          [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
            user.email,
        ]),
      );

      for (const row of rows) {
        if (!row.userEmail && isDefined(row.userId)) {
          row.userEmail = nameByUserId.get(row.userId) ?? null;
        }
      }
    }

    return { rows, total };
  }

  // Retention: drop rows older than the cutoff. Returns number deleted.
  async purgeOlderThan(cutoff: Date): Promise<number> {
    const result = await this.auditLogRepository.delete({
      createdAt: LessThan(cutoff),
    });

    return result.affected ?? 0;
  }
}
