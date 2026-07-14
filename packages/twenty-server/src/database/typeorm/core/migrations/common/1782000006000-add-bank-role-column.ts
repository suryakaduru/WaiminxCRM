import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBankRoleColumn1782000006000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."waiminBankAccount" ADD COLUMN "bankRole" varchar NOT NULL DEFAULT 'other'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."waiminBankAccount" DROP COLUMN "bankRole"`,
    );
  }
}
