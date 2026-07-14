import { MigrationInterface, QueryRunner } from 'typeorm';

// The waiminFinanceReminder.timezone column was originally added by a manual
// ALTER on running DBs; this migration makes it reproducible on fresh deploys.
export class AddReminderTimezoneColumn1782000008000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."waiminFinanceReminder"
        ADD COLUMN IF NOT EXISTS "timezone" varchar NOT NULL DEFAULT 'UTC'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."waiminFinanceReminder"
        DROP COLUMN IF EXISTS "timezone"
    `);
  }
}
