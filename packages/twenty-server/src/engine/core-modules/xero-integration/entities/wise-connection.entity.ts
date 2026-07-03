import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'wiseConnection', schema: 'core' })
@Index('IDX_WISE_CONNECTION_WORKSPACE_ID', ['workspaceId'])
@Unique('UQ_WISE_CONNECTION_WORKSPACE', ['workspaceId'])
export class WiseConnectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'varchar', nullable: true })
  profileId: string | null;

  @Column({ type: 'text' })
  apiTokenCiphertext: string;

  @Column({ type: 'varchar', nullable: true })
  connectedByUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
