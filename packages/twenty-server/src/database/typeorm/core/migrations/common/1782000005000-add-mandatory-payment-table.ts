import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMandatoryPaymentTable1782000005000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "core"."waiminMandatoryPayment" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "type" varchar NOT NULL,
        "label" varchar NOT NULL,
        "currencyCode" varchar(8) NOT NULL,
        "amount" numeric(18,4) NOT NULL DEFAULT 0,
        "frequencyCron" varchar NOT NULL,
        "nextDueDate" date NOT NULL,
        "bankAccountId" uuid,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_WAIMIN_MANDATORY_PAYMENT_ID" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_WAIMIN_MANDATORY_PAYMENT_WORKSPACE" ON "core"."waiminMandatoryPayment" ("workspaceId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "core"."waiminMandatoryPayment"`);
  }
}
