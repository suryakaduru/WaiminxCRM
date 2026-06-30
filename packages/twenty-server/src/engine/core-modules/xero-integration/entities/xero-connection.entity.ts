import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'xeroConnection', schema: 'core' })
@Index('IDX_XERO_CONNECTION_WORKSPACE_ID', ['workspaceId'])
@Unique('UQ_XERO_CONNECTION_WORKSPACE_TENANT', ['workspaceId', 'tenantId'])
export class XeroConnectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'varchar' })
  tenantId: string;

  @Column({ type: 'varchar', nullable: true })
  tenantName: string | null;

  @Column({ type: 'varchar', nullable: true })
  tenantType: string | null;

  @Column({ type: 'text' })
  refreshTokenCiphertext: string;

  @Column({ type: 'text' })
  accessTokenCiphertext: string;

  @Column({ type: 'timestamptz' })
  accessTokenExpiresAt: Date;

  @Column({ type: 'varchar' })
  scopes: string;

  @Column({ type: 'varchar', nullable: true })
  connectedByUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
