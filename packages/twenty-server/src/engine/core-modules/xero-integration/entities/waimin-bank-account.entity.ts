import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type WaiminBankSource = 'manual' | 'xero' | 'wise' | 'statrys';

@Entity({ name: 'waiminBankAccount', schema: 'core' })
@Index('IDX_WAIMIN_BANK_ACCOUNT_WORKSPACE', ['workspaceId'])
@Index('IDX_WAIMIN_BANK_ACCOUNT_CURRENCY', ['workspaceId', 'currencyCode'])
export class WaiminBankAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'varchar' })
  bankName: string;

  @Column({ type: 'varchar', nullable: true })
  accountLabel: string | null;

  @Column({ type: 'varchar', length: 8 })
  currencyCode: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  balance: string;

  @Column({ type: 'timestamptz', nullable: true })
  balanceAsOf: Date | null;

  @Column({ type: 'varchar', default: 'manual' })
  source: WaiminBankSource;

  @Column({ type: 'varchar', nullable: true })
  xeroAccountId: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
