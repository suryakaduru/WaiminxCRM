import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationSettingTable1782000003000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."waiminNotificationSetting" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "teamsWebhookUrl" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_WAIMIN_NOTIFICATION_SETTING_ID" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_WAIMIN_NOTIFICATION_SETTING_WORKSPACE" UNIQUE ("workspaceId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "core"."waiminNotificationSetting"`,
    );
  }
}
