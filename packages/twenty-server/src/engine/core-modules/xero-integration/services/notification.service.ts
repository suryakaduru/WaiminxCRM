import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { WaiminNotificationSettingEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-notification-setting.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(WaiminNotificationSettingEntity)
    private readonly settingRepository: Repository<WaiminNotificationSettingEntity>,
  ) {}

  async getSetting(workspaceId: string) {
    const existing = await this.settingRepository.findOne({
      where: { workspaceId },
    });

    return { teamsWebhookUrl: existing?.teamsWebhookUrl ?? null };
  }

  async saveWebhook(workspaceId: string, teamsWebhookUrl: string | null) {
    let setting = await this.settingRepository.findOne({
      where: { workspaceId },
    });

    if (!setting) {
      setting = this.settingRepository.create({ workspaceId });
    }

    setting.teamsWebhookUrl =
      teamsWebhookUrl && teamsWebhookUrl.trim() !== ''
        ? teamsWebhookUrl.trim()
        : null;

    await this.settingRepository.save(setting);

    return { teamsWebhookUrl: setting.teamsWebhookUrl };
  }

  // Posts a MessageCard to a Teams Incoming Webhook. No-op if not configured.
  async sendTeams(
    workspaceId: string,
    title: string,
    text: string,
  ): Promise<boolean> {
    const { teamsWebhookUrl } = await this.getSetting(workspaceId);

    if (!teamsWebhookUrl) return false;

    return this.postToWebhook(teamsWebhookUrl, title, text);
  }

  async postToWebhook(
    webhookUrl: string,
    title: string,
    text: string,
  ): Promise<boolean> {
    try {
      const card = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: '2563EB',
        summary: title,
        sections: [
          {
            activityTitle: title,
            text,
            markdown: true,
          },
        ],
      };

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(card),
      });

      if (res.ok) return true;

      const body = await res.text();

      this.logger.warn(
        `Teams MessageCard post failed: ${res.status} ${body.slice(0, 300)}. Retrying as plain payload.`,
      );

      // Power Automate "Workflows" webhooks (the new Teams model) reject the
      // legacy MessageCard schema. Retry with the simple shapes those flows
      // and Adaptive-Card flows accept.
      const plain = {
        text: `**${title}**\n\n${text}`,
        title,
        summary: title,
      };

      const retry = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plain),
      });

      if (retry.ok) return true;

      const retryBody = await retry.text();

      this.logger.warn(
        `Teams webhook failed (both formats): ${retry.status} ${retryBody.slice(0, 300)}`,
      );

      return false;
    } catch (err) {
      this.logger.error(
        `Teams webhook error: ${err instanceof Error ? err.message : String(err)}`,
      );

      return false;
    }
  }
}
