import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLogTable1782000007000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core"."waiminAuditLog" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "userId" uuid,
        "userEmail" varchar,
        "action" varchar NOT NULL,
        "objectName" varchar,
        "recordId" uuid,
        "recordName" varchar,
        "diff" jsonb,
        "ipAddress" varchar,
        "userAgent" text,
        "context" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_WAIMIN_AUDIT_LOG_ID" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_WAIMIN_AUDIT_LOG_WORKSPACE_CREATED"
        ON "core"."waiminAuditLog" ("workspaceId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_WAIMIN_AUDIT_LOG_WORKSPACE_USER"
        ON "core"."waiminAuditLog" ("workspaceId", "userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_WAIMIN_AUDIT_LOG_WORKSPACE_ACTION"
        ON "core"."waiminAuditLog" ("workspaceId", "action")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "core"."waiminAuditLog"`,
    );
  }
}
