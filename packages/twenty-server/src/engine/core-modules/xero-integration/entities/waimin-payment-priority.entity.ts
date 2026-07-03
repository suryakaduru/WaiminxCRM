import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'waiminPaymentPriority', schema: 'core' })
@Index('IDX_WAIMIN_PAYMENT_PRIORITY_WORKSPACE', ['workspaceId'])
@Unique('UQ_WAIMIN_PAYMENT_PRIORITY_INVOICE', [
  'workspaceId',
  'tenantId',
  'xeroInvoiceId',
])
export class WaiminPaymentPriorityEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'varchar' })
  tenantId: string;

  @Column({ type: 'varchar' })
  xeroInvoiceId: string;

  // 1 = highest, 5 = lowest
  @Column({ type: 'integer', default: 3 })
  priority: number;

  @Column({ type: 'boolean', default: false })
  mustPay: boolean;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', nullable: true })
  updatedByUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
