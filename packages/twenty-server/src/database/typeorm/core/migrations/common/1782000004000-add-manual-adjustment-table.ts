import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManualAdjustmentTable1782000004000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "core"."waiminManualAdjustment" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "fridayDate" date NOT NULL,
        "direction" varchar NOT NULL,
        "label" varchar NOT NULL,
        "currencyCode" varchar(8) NOT NULL,
        "amount" numeric(18,4) NOT NULL DEFAULT 0,
        "bankAccountId" uuid,
        "note" text,
        "createdByUserId" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_WAIMIN_MANUAL_ADJUSTMENT_ID" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_WAIMIN_MANUAL_ADJUSTMENT_WORKSPACE" ON "core"."waiminManualAdjustment" ("workspaceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_WAIMIN_MANUAL_ADJUSTMENT_FRIDAY" ON "core"."waiminManualAdjustment" ("workspaceId", "fridayDate")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "core"."waiminManualAdjustment"`);
  }
}
