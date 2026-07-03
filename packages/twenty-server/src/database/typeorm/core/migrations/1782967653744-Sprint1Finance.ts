import { MigrationInterface, QueryRunner } from "typeorm";

export class Sprint1Finance1782967653744 implements MigrationInterface {
    name = 'Sprint1Finance1782967653744'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "core"."waiminPaymentPlanLine" DROP CONSTRAINT "FK_WAIMIN_PAYMENT_PLAN_LINE_PLAN"`);
        await queryRunner.query(`CREATE TABLE "core"."wiseConnection" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "profileId" character varying, "apiTokenCiphertext" text NOT NULL, "connectedByUserId" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_WISE_CONNECTION_WORKSPACE" UNIQUE ("workspaceId"), CONSTRAINT "PK_cf03f1691c56f18dd50fc0dbe8b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_WISE_CONNECTION_WORKSPACE_ID" ON "core"."wiseConnection" ("workspaceId") `);
        await queryRunner.query(`CREATE TABLE "core"."waiminFinanceReminder" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "title" character varying NOT NULL, "type" character varying NOT NULL, "frequencyCron" character varying NOT NULL, "nextDueDate" TIMESTAMP WITH TIME ZONE NOT NULL, "lastCreatedTaskAt" TIMESTAMP WITH TIME ZONE, "isActive" boolean NOT NULL DEFAULT true, "assigneeId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0a72da305aba7eda9ca07bedf69" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_FINANCE_REMINDER_WORKSPACE_ID" ON "core"."waiminFinanceReminder" ("workspaceId") `);
        await queryRunner.query(`ALTER TABLE "core"."rolePermissionFlag" ADD "flag" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "core"."waiminPaymentPlanLine" ADD CONSTRAINT "FK_3701da354eb8d30792151d0ef92" FOREIGN KEY ("planId") REFERENCES "core"."waiminPaymentPlan"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "core"."waiminPaymentPlanLine" DROP CONSTRAINT "FK_3701da354eb8d30792151d0ef92"`);
        await queryRunner.query(`ALTER TABLE "core"."rolePermissionFlag" DROP COLUMN "flag"`);
        await queryRunner.query(`DROP INDEX "core"."IDX_FINANCE_REMINDER_WORKSPACE_ID"`);
        await queryRunner.query(`DROP TABLE "core"."waiminFinanceReminder"`);
        await queryRunner.query(`DROP INDEX "core"."IDX_WISE_CONNECTION_WORKSPACE_ID"`);
        await queryRunner.query(`DROP TABLE "core"."wiseConnection"`);
        await queryRunner.query(`ALTER TABLE "core"."waiminPaymentPlanLine" ADD CONSTRAINT "FK_WAIMIN_PAYMENT_PLAN_LINE_PLAN" FOREIGN KEY ("planId") REFERENCES "core"."waiminPaymentPlan"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
