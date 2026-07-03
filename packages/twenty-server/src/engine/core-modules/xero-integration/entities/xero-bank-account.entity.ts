import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'xeroBankAccount', schema: 'core' })
@Index('IDX_XERO_BANK_ACCOUNT_WORKSPACE', ['workspaceId'])
@Index('IDX_XERO_BANK_ACCOUNT_WORKSPACE_TENANT', ['workspaceId', 'tenantId'])
@Unique('UQ_XERO_BANK_ACCOUNT_TENANT_XEROID', ['tenantId', 'xeroAccountId'])
export class XeroBankAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'varchar' })
  tenantId: string;

  @Column({ type: 'varchar' })
  xeroAccountId: string;

  @Column({ type: 'varchar', nullable: true })
  code: string | null;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  currencyCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  bankAccountNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  status: string | null;

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
