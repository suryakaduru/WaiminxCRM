import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type WaiminAdjustmentDirection = 'in' | 'out';

// Ad-hoc cash movements the weekly planner cannot derive from Xero:
// unexpected supplier invoice, urgent payroll, emergency transfer, a
// customer paying early/late. Scoped to one Friday plan.
@Entity({ name: 'waiminManualAdjustment', schema: 'core' })
@Index('IDX_WAIMIN_MANUAL_ADJUSTMENT_WORKSPACE', ['workspaceId'])
@Index('IDX_WAIMIN_MANUAL_ADJUSTMENT_FRIDAY', ['workspaceId', 'fridayDate'])
export class WaiminManualAdjustmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'date' })
  fridayDate: string;

  @Column({ type: 'varchar' })
  direction: WaiminAdjustmentDirection;

  @Column({ type: 'varchar' })
  label: string;

  @Column({ type: 'varchar', length: 8 })
  currencyCode: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  amount: string;

  @Column({ type: 'uuid', nullable: true })
  bankAccountId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
