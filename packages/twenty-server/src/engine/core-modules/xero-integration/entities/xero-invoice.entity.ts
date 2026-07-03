import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'xeroInvoice', schema: 'core' })
@Index('IDX_XERO_INVOICE_WORKSPACE', ['workspaceId'])
@Index('IDX_XERO_INVOICE_WORKSPACE_TENANT', ['workspaceId', 'tenantId'])
@Index('IDX_XERO_INVOICE_STATUS_TYPE', ['status', 'type'])
@Index('IDX_XERO_INVOICE_DUE_DATE', ['dueDate'])
@Index('IDX_XERO_INVOICE_UPDATED', ['xeroUpdatedDateUtc'])
@Unique('UQ_XERO_INVOICE_TENANT_XEROID', ['tenantId', 'xeroInvoiceId'])
export class XeroInvoiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'varchar' })
  tenantId: string;

  @Column({ type: 'varchar' })
  xeroInvoiceId: string;

  @Column({ type: 'varchar', nullable: true })
  invoiceNumber: string | null;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'varchar' })
  status: string;

  @Column({ type: 'varchar', nullable: true })
  contactXeroId: string | null;

  @Column({ type: 'varchar', nullable: true })
  contactName: string | null;

  @Column({ type: 'date', nullable: true })
  date: string | null;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  currencyCode: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  subTotal: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  totalTax: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  total: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  amountDue: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  amountPaid: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  amountCredited: string;

  @Column({ type: 'varchar', nullable: true })
  reference: string | null;

  @Column({ type: 'date', nullable: true })
  fullyPaidOnDate: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  xeroUpdatedDateUtc: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  raw: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
