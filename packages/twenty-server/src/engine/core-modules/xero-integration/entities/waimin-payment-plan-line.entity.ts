import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { WaiminPaymentPlanEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-payment-plan.entity';

@Entity({ name: 'waiminPaymentPlanLine', schema: 'core' })
@Index('IDX_WAIMIN_PAYMENT_PLAN_LINE_PLAN', ['planId'])
export class WaiminPaymentPlanLineEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  planId: string;

  @ManyToOne(() => WaiminPaymentPlanEntity, (plan) => plan.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'planId' })
  plan: WaiminPaymentPlanEntity;

  @Column({ type: 'varchar' })
  tenantId: string;

  @Column({ type: 'varchar' })
  xeroInvoiceId: string;

  @Column({ type: 'uuid', nullable: true })
  bankAccountId: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  amount: string;

  @Column({ type: 'varchar', length: 8 })
  currencyCode: string;

  @Column({ type: 'boolean', default: true })
  included: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
