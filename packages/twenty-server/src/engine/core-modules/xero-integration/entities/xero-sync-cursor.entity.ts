import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type XeroSyncEntityType = 'invoices' | 'contacts' | 'bankAccounts';
export type XeroSyncStatus = 'idle' | 'running' | 'error';

@Entity({ name: 'xeroSyncCursor', schema: 'core' })
@Index('IDX_XERO_SYNC_CURSOR_WORKSPACE', ['workspaceId'])
@Unique('UQ_XERO_SYNC_CURSOR_TENANT_ENTITY', [
  'workspaceId',
  'tenantId',
  'entityType',
])
export class XeroSyncCursorEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'varchar' })
  tenantId: string;

  @Column({ type: 'varchar' })
  entityType: XeroSyncEntityType;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastCursorAt: Date | null;

  @Column({ type: 'varchar', default: 'idle' })
  status: XeroSyncStatus;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'integer', default: 0 })
  recordsSyncedLastRun: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
