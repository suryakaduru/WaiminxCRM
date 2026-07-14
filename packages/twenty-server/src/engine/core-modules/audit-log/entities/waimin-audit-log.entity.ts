import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Append-only activity log: who did what, when. One row per user action.
// No UpdateDateColumn on purpose — rows are immutable once written.
@Entity({ name: 'waiminAuditLog', schema: 'core' })
@Index('IDX_WAIMIN_AUDIT_LOG_WORKSPACE_CREATED', ['workspaceId', 'createdAt'])
@Index('IDX_WAIMIN_AUDIT_LOG_WORKSPACE_USER', ['workspaceId', 'userId'])
@Index('IDX_WAIMIN_AUDIT_LOG_WORKSPACE_ACTION', ['workspaceId', 'action'])
export class WaiminAuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  // Actor. Null for system-originated actions.
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  // Denormalized so the log survives the user being deleted.
  @Column({ type: 'varchar', nullable: true })
  userEmail: string | null;

  // created | updated | deleted | restored | destroyed | login | logout | login_failed
  @Column({ type: 'varchar' })
  action: string;

  // Object nameSingular for record events (person, company, payment...). Null for auth events.
  @Column({ type: 'varchar', nullable: true })
  objectName: string | null;

  @Column({ type: 'uuid', nullable: true })
  recordId: string | null;

  // Best-effort human label of the affected record.
  @Column({ type: 'varchar', nullable: true })
  recordName: string | null;

  // Field-level before->after diff for record updates. Null for auth events.
  @Column({ type: 'jsonb', nullable: true })
  diff: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  // Free-form extra context (e.g. auth method, workspaceMemberId).
  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
