import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddXeroCacheAndWaiminFinanceTables1782000001000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // xeroInvoice cache
    await queryRunner.query(`
      CREATE TABLE "core"."xeroInvoice" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "tenantId" varchar NOT NULL,
        "xeroInvoiceId" varchar NOT NULL,
        "invoiceNumber" varchar,
        "type" varchar NOT NULL,
        "status" varchar NOT NULL,
        "contactXeroId" varchar,
        "contactName" varchar,
        "date" date,
        "dueDate" date,
        "currencyCode" varchar(8),
        "subTotal" numeric(18,4) NOT NULL DEFAULT 0,
        "totalTax" numeric(18,4) NOT NULL DEFAULT 0,
        "total" numeric(18,4) NOT NULL DEFAULT 0,
        "amountDue" numeric(18,4) NOT NULL DEFAULT 0,
        "amountPaid" numeric(18,4) NOT NULL DEFAULT 0,
        "amountCredited" numeric(18,4) NOT NULL DEFAULT 0,
        "reference" varchar,
        "fullyPaidOnDate" date,
        "xeroUpdatedDateUtc" timestamptz,
        "lastSyncedAt" timestamptz,
        "raw" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_XERO_INVOICE_ID" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_XERO_INVOICE_TENANT_XEROID" UNIQUE ("tenantId", "xeroInvoiceId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_XERO_INVOICE_WORKSPACE" ON "core"."xeroInvoice" ("workspaceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_XERO_INVOICE_WORKSPACE_TENANT" ON "core"."xeroInvoice" ("workspaceId", "tenantId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_XERO_INVOICE_STATUS_TYPE" ON "core"."xeroInvoice" ("status", "type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_XERO_INVOICE_DUE_DATE" ON "core"."xeroInvoice" ("dueDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_XERO_INVOICE_UPDATED" ON "core"."xeroInvoice" ("xeroUpdatedDateUtc")`,
    );

    // xeroContact cache
    await queryRunner.query(`
      CREATE TABLE "core"."xeroContact" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "tenantId" varchar NOT NULL,
        "xeroContactId" varchar NOT NULL,
        "name" varchar,
        "emailAddress" varchar,
        "isCustomer" boolean NOT NULL DEFAULT false,
        "isSupplier" boolean NOT NULL DEFAULT false,
        "defaultCurrencyCode" varchar(8),
        "xeroUpdatedDateUtc" timestamptz,
        "lastSyncedAt" timestamptz,
        "raw" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_XERO_CONTACT_ID" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_XERO_CONTACT_TENANT_XEROID" UNIQUE ("tenantId", "xeroContactId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_XERO_CONTACT_WORKSPACE" ON "core"."xeroContact" ("workspaceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_XERO_CONTACT_WORKSPACE_TENANT" ON "core"."xeroContact" ("workspaceId", "tenantId")`,
    );

    // xeroBankAccount cache
    await queryRunner.query(`
      CREATE TABLE "core"."xeroBankAccount" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "tenantId" varchar NOT NULL,
        "xeroAccountId" varchar NOT NULL,
        "code" varchar,
        "name" varchar,
        "currencyCode" varchar(8),
        "bankAccountNumber" varchar,
        "status" varchar,
        "xeroUpdatedDateUtc" timestamptz,
        "lastSyncedAt" timestamptz,
        "raw" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_XERO_BANK_ACCOUNT_ID" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_XERO_BANK_ACCOUNT_TENANT_XEROID" UNIQUE ("tenantId", "xeroAccountId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_XERO_BANK_ACCOUNT_WORKSPACE" ON "core"."xeroBankAccount" ("workspaceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_XERO_BANK_ACCOUNT_WORKSPACE_TENANT" ON "core"."xeroBankAccount" ("workspaceId", "tenantId")`,
    );

    // xeroSyncCursor
    await queryRunner.query(`
      CREATE TABLE "core"."xeroSyncCursor" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "tenantId" varchar NOT NULL,
        "entityType" varchar NOT NULL,
        "lastSyncedAt" timestamptz,
        "lastCursorAt" timestamptz,
        "status" varchar NOT NULL DEFAULT 'idle',
        "lastError" text,
        "recordsSyncedLastRun" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_XERO_SYNC_CURSOR_ID" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_XERO_SYNC_CURSOR_TENANT_ENTITY" UNIQUE ("workspaceId", "tenantId", "entityType")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_XERO_SYNC_CURSOR_WORKSPACE" ON "core"."xeroSyncCursor" ("workspaceId")`,
    );

    // Waimin bankAccount (manual + auto sub-accounts per currency)
    await queryRunner.query(`
      CREATE TABLE "core"."waiminBankAccount" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "bankName" varchar NOT NULL,
        "accountLabel" varchar,
        "currencyCode" varchar(8) NOT NULL,
        "balance" numeric(18,4) NOT NULL DEFAULT 0,
        "balanceAsOf" timestamptz,
        "source" varchar NOT NULL DEFAULT 'manual',
        "xeroAccountId" varchar,
        "isActive" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_WAIMIN_BANK_ACCOUNT_ID" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_WAIMIN_BANK_ACCOUNT_WORKSPACE" ON "core"."waiminBankAccount" ("workspaceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_WAIMIN_BANK_ACCOUNT_CURRENCY" ON "core"."waiminBankAccount" ("workspaceId", "currencyCode")`,
    );

    // Waimin payment priority overlay on Xero invoices
    await queryRunner.query(`
      CREATE TABLE "core"."waiminPaymentPriority" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "tenantId" varchar NOT NULL,
        "xeroInvoiceId" varchar NOT NULL,
        "priority" integer NOT NULL DEFAULT 3,
        "mustPay" boolean NOT NULL DEFAULT false,
        "note" text,
        "updatedByUserId" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_WAIMIN_PAYMENT_PRIORITY_ID" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_WAIMIN_PAYMENT_PRIORITY_INVOICE" UNIQUE ("workspaceId", "tenantId", "xeroInvoiceId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_WAIMIN_PAYMENT_PRIORITY_WORKSPACE" ON "core"."waiminPaymentPriority" ("workspaceId")`,
    );

    // Weekly payment plan (draft or committed)
    await queryRunner.query(`
      CREATE TABLE "core"."waiminPaymentPlan" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "fridayDate" date NOT NULL,
        "status" varchar NOT NULL DEFAULT 'draft',
        "notes" text,
        "createdByUserId" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_WAIMIN_PAYMENT_PLAN_ID" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_WAIMIN_PAYMENT_PLAN_WORKSPACE_FRIDAY" UNIQUE ("workspaceId", "fridayDate")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_WAIMIN_PAYMENT_PLAN_WORKSPACE" ON "core"."waiminPaymentPlan" ("workspaceId")`,
    );

    // Line items on payment plan
    await queryRunner.query(`
      CREATE TABLE "core"."waiminPaymentPlanLine" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "planId" uuid NOT NULL,
        "tenantId" varchar NOT NULL,
        "xeroInvoiceId" varchar NOT NULL,
        "bankAccountId" uuid,
        "amount" numeric(18,4) NOT NULL DEFAULT 0,
        "currencyCode" varchar(8) NOT NULL,
        "included" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_WAIMIN_PAYMENT_PLAN_LINE_ID" PRIMARY KEY ("id"),
        CONSTRAINT "FK_WAIMIN_PAYMENT_PLAN_LINE_PLAN" FOREIGN KEY ("planId")
          REFERENCES "core"."waiminPaymentPlan"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_WAIMIN_PAYMENT_PLAN_LINE_PLAN" ON "core"."waiminPaymentPlanLine" ("planId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "core"."waiminPaymentPlanLine"`);
    await queryRunner.query(`DROP TABLE "core"."waiminPaymentPlan"`);
    await queryRunner.query(`DROP TABLE "core"."waiminPaymentPriority"`);
    await queryRunner.query(`DROP TABLE "core"."waiminBankAccount"`);
    await queryRunner.query(`DROP TABLE "core"."xeroSyncCursor"`);
    await queryRunner.query(`DROP TABLE "core"."xeroBankAccount"`);
    await queryRunner.query(`DROP TABLE "core"."xeroContact"`);
    await queryRunner.query(`DROP TABLE "core"."xeroInvoice"`);
  }
}
