import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWiseAndReminderTables1782000002000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."wiseConnection" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "profileId" varchar,
        "apiTokenCiphertext" text NOT NULL,
        "connectedByUserId" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_WISE_CONNECTION_ID" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_WISE_CONNECTION_WORKSPACE" UNIQUE ("workspaceId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_WISE_CONNECTION_WORKSPACE_ID" ON "core"."wiseConnection" ("workspaceId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."waiminFinanceReminder" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "title" varchar NOT NULL,
        "type" varchar NOT NULL,
        "frequencyCron" varchar NOT NULL,
        "nextDueDate" timestamptz NOT NULL,
        "lastCreatedTaskAt" timestamptz,
        "isActive" boolean NOT NULL DEFAULT true,
        "assigneeId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_FINANCE_REMINDER_ID" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_FINANCE_REMINDER_WORKSPACE_ID" ON "core"."waiminFinanceReminder" ("workspaceId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."waiminFinanceReminder"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."wiseConnection"`);
  }
}
