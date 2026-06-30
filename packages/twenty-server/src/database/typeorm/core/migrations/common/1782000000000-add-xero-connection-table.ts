import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddXeroConnectionTable1782000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "core"."xeroConnection" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "tenantId" varchar NOT NULL,
        "tenantName" varchar,
        "tenantType" varchar,
        "refreshTokenCiphertext" text NOT NULL,
        "accessTokenCiphertext" text NOT NULL,
        "accessTokenExpiresAt" timestamptz NOT NULL,
        "scopes" varchar NOT NULL,
        "connectedByUserId" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_XERO_CONNECTION_ID" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_XERO_CONNECTION_WORKSPACE_TENANT" UNIQUE ("workspaceId", "tenantId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_XERO_CONNECTION_WORKSPACE_ID" ON "core"."xeroConnection" ("workspaceId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "core"."xeroConnection"`);
  }
}
