import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type FinanceReminderType = 'payroll' | 'gst' | 'rent' | 'loan' | 'bank_recon' | 'custom';

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
