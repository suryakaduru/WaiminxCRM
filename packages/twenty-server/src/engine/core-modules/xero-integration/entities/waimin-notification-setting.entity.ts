import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'waiminNotificationSetting', schema: 'core' })
@Unique('UQ_WAIMIN_NOTIFICATION_SETTING_WORKSPACE', ['workspaceId'])
export class WaiminNotificationSettingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  // Microsoft Teams (or any) Incoming Webhook URL. Null = no external alerts.
  @Column({ type: 'text', nullable: true })
  teamsWebhookUrl: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
