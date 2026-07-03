import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'xeroContact', schema: 'core' })
@Index('IDX_XERO_CONTACT_WORKSPACE', ['workspaceId'])
@Index('IDX_XERO_CONTACT_WORKSPACE_TENANT', ['workspaceId', 'tenantId'])
@Unique('UQ_XERO_CONTACT_TENANT_XEROID', ['tenantId', 'xeroContactId'])
export class XeroContactEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'varchar' })
  tenantId: string;

  @Column({ type: 'varchar' })
  xeroContactId: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar', nullable: true })
  emailAddress: string | null;

  @Column({ type: 'boolean', default: false })
  isCustomer: boolean;

  @Column({ type: 'boolean', default: false })
  isSupplier: boolean;

  @Column({ type: 'varchar', length: 8, nullable: true })
  defaultCurrencyCode: string | null;

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
