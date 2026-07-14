import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { type FinanceReminderType } from 'src/engine/core-modules/xero-integration/entities/waimin-finance-reminder.entity';

// Recurring obligations that must be paid regardless of Xero bills — payroll,
// GST, loan, rent, credit card, Trust Account, Inland Revenue. Any instance due
// on or before the planner's Friday shows as a locked must-pay outflow.
@Entity({ name: 'waiminMandatoryPayment', schema: 'core' })
@Index('IDX_WAIMIN_MANDATORY_PAYMENT_WORKSPACE', ['workspaceId'])
export class WaiminMandatoryPaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'varchar' })
  type: FinanceReminderType;

  @Column({ type: 'varchar' })
  label: string;

  @Column({ type: 'varchar', length: 8 })
  currencyCode: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  amount: string;

  @Column({ type: 'varchar' })
  frequencyCron: string;

  @Column({ type: 'date' })
  nextDueDate: string;

  @Column({ type: 'uuid', nullable: true })
  bankAccountId: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
