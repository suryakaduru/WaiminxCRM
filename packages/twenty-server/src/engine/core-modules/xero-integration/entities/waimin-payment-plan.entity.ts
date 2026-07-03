import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import type { WaiminPaymentPlanLineEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-payment-plan-line.entity';

export type WaiminPaymentPlanStatus = 'draft' | 'committed' | 'archived';

@Entity({ name: 'waiminPaymentPlan', schema: 'core' })
@Index('IDX_WAIMIN_PAYMENT_PLAN_WORKSPACE', ['workspaceId'])
@Unique('UQ_WAIMIN_PAYMENT_PLAN_WORKSPACE_FRIDAY', [
  'workspaceId',
  'fridayDate',
])
export class WaiminPaymentPlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'date' })
  fridayDate: string;

  @Column({ type: 'varchar', default: 'draft' })
  status: WaiminPaymentPlanStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', nullable: true })
  createdByUserId: string | null;

  @OneToMany('WaiminPaymentPlanLineEntity', (line: WaiminPaymentPlanLineEntity) => line.plan)
  lines: WaiminPaymentPlanLineEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
