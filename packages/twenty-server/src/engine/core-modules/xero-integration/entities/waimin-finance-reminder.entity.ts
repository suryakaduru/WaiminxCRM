import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type FinanceReminderType =
  | 'payroll'
  | 'gst'
  | 'rent'
  | 'loan'
  | 'credit_card'
  | 'trust_account'
  | 'inland_revenue'
  | 'bank_recon'
  | 'custom';

@Entity({ name: 'waiminFinanceReminder', schema: 'core' })
@Index('IDX_FINANCE_REMINDER_WORKSPACE_ID', ['workspaceId'])
export class WaiminFinanceReminderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar' })
  type: FinanceReminderType;

  @Column({ type: 'varchar' })
  frequencyCron: string;

  // IANA timezone the send-time is expressed in (e.g. 'Asia/Kolkata'), so the
  // reminder fires at the chosen wall-clock time in the creator's zone —
  // independent of the server's timezone. Recurrence is computed in this zone.
  @Column({ type: 'varchar', default: 'UTC' })
  timezone: string;

  @Column({ type: 'timestamptz' })
  nextDueDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastCreatedTaskAt: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'uuid', nullable: true })
  assigneeId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
