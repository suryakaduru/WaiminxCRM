import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { WiseSyncService } from 'src/engine/core-modules/xero-integration/services/wise-sync.service';

import {
  WaiminBankAccountEntity,
  type WaiminBankSource,
  type WaiminBankRole,
} from 'src/engine/core-modules/xero-integration/entities/waimin-bank-account.entity';
import {
  WaiminManualAdjustmentEntity,
  type WaiminAdjustmentDirection,
} from 'src/engine/core-modules/xero-integration/entities/waimin-manual-adjustment.entity';
import { WaiminMandatoryPaymentEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-mandatory-payment.entity';
import { type FinanceReminderType } from 'src/engine/core-modules/xero-integration/entities/waimin-finance-reminder.entity';
import { WaiminPaymentPlanLineEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-payment-plan-line.entity';
import { WaiminPaymentPlanEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-payment-plan.entity';
import { WaiminPaymentPriorityEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-payment-priority.entity';
import { XeroInvoiceEntity } from 'src/engine/core-modules/xero-integration/entities/xero-invoice.entity';

export type UpsertBankAccountInput = {
  id?: string;
  workspaceId: string;
  bankName: string;
  accountLabel?: string | null;
  currencyCode: string;
  balance: number;
  source?: WaiminBankSource;
  bankRole?: WaiminBankRole;
  xeroAccountId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

export type UpsertPriorityInput = {
  workspaceId: string;
  tenantId: string;
  xeroInvoiceId: string;
  priority?: number;
  mustPay?: boolean;
  note?: string | null;
  updatedByUserId?: string | null;
};

export type UpsertAdjustmentInput = {
  id?: string;
  workspaceId: string;
  fridayDate: string;
  direction: WaiminAdjustmentDirection;
  label: string;
  currencyCode: string;
  amount: number;
  bankAccountId?: string | null;
  note?: string | null;
  createdByUserId?: string | null;
};

export type UpsertMandatoryPaymentInput = {
  id?: string;
  workspaceId: string;
  type: FinanceReminderType;
  label: string;
  currencyCode: string;
  amount: number;
  frequencyCron: string;
  nextDueDate: string;
  bankAccountId?: string | null;
  isActive?: boolean;
};

export type SavePlanInput = {
  workspaceId: string;
  fridayDate: string;
  notes?: string | null;
  createdByUserId?: string | null;
  lines: Array<{
    tenantId: string;
    xeroInvoiceId: string;
    bankAccountId?: string | null;
    amount: number;
    currencyCode: string;
    included?: boolean;
  }>;
};

@Injectable()
export class FinanceCrudService {
  constructor(
    @InjectRepository(WaiminBankAccountEntity)
    private readonly bankAccountRepository: Repository<WaiminBankAccountEntity>,
    @InjectRepository(WaiminPaymentPriorityEntity)
    private readonly priorityRepository: Repository<WaiminPaymentPriorityEntity>,
    @InjectRepository(WaiminPaymentPlanEntity)
    private readonly planRepository: Repository<WaiminPaymentPlanEntity>,
    @InjectRepository(WaiminPaymentPlanLineEntity)
    private readonly planLineRepository: Repository<WaiminPaymentPlanLineEntity>,
    @InjectRepository(XeroInvoiceEntity)
    private readonly invoiceRepository: Repository<XeroInvoiceEntity>,
    @InjectRepository(WaiminManualAdjustmentEntity)
    private readonly adjustmentRepository: Repository<WaiminManualAdjustmentEntity>,
    @InjectRepository(WaiminMandatoryPaymentEntity)
    private readonly mandatoryPaymentRepository: Repository<WaiminMandatoryPaymentEntity>,
    private readonly wiseSync: WiseSyncService,
  ) {}

  listMandatoryPayments(workspaceId: string) {
    return this.mandatoryPaymentRepository.find({
      where: { workspaceId },
      order: { nextDueDate: 'ASC' },
    });
  }

  async upsertMandatoryPayment(input: UpsertMandatoryPaymentInput) {
    const bankAccountId =
      input.bankAccountId && input.bankAccountId.trim() !== ''
        ? input.bankAccountId
        : null;

    if (input.id) {
      const existing = await this.mandatoryPaymentRepository.findOne({
        where: { id: input.id, workspaceId: input.workspaceId },
      });

      if (!existing) throw new NotFoundException('Mandatory payment not found');

      Object.assign(existing, {
        type: input.type,
        label: input.label,
        currencyCode: input.currencyCode,
        amount: String(input.amount),
        frequencyCron: input.frequencyCron,
        nextDueDate: input.nextDueDate,
        bankAccountId,
        isActive: input.isActive ?? existing.isActive,
      });

      return this.mandatoryPaymentRepository.save(existing);
    }

    return this.mandatoryPaymentRepository.save(
      this.mandatoryPaymentRepository.create({
        workspaceId: input.workspaceId,
        type: input.type,
        label: input.label,
        currencyCode: input.currencyCode,
        amount: String(input.amount),
        frequencyCron: input.frequencyCron,
        nextDueDate: input.nextDueDate,
        bankAccountId,
        isActive: input.isActive ?? true,
      }),
    );
  }

  async deleteMandatoryPayment(workspaceId: string, id: string) {
    const result = await this.mandatoryPaymentRepository.delete({
      id,
      workspaceId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Mandatory payment not found');
    }
  }

  listAdjustments(workspaceId: string, fridayDate: string) {
    return this.adjustmentRepository.find({
      where: { workspaceId, fridayDate },
      order: { createdAt: 'ASC' },
    });
  }

  async upsertAdjustment(input: UpsertAdjustmentInput) {
    const bankAccountId =
      input.bankAccountId && input.bankAccountId.trim() !== ''
        ? input.bankAccountId
        : null;

    if (input.id) {
      const existing = await this.adjustmentRepository.findOne({
        where: { id: input.id, workspaceId: input.workspaceId },
      });

      if (!existing) throw new NotFoundException('Adjustment not found');

      Object.assign(existing, {
        fridayDate: input.fridayDate,
        direction: input.direction,
        label: input.label,
        currencyCode: input.currencyCode,
        amount: String(input.amount),
        bankAccountId,
        note: input.note ?? null,
      });

      return this.adjustmentRepository.save(existing);
    }

    return this.adjustmentRepository.save(
      this.adjustmentRepository.create({
        workspaceId: input.workspaceId,
        fridayDate: input.fridayDate,
        direction: input.direction,
        label: input.label,
        currencyCode: input.currencyCode,
        amount: String(input.amount),
        bankAccountId,
        note: input.note ?? null,
        createdByUserId: input.createdByUserId ?? null,
      }),
    );
  }

  async deleteAdjustment(workspaceId: string, id: string) {
    const result = await this.adjustmentRepository.delete({ id, workspaceId });

    if (result.affected === 0) throw new NotFoundException('Adjustment not found');
  }

  listBankAccounts(workspaceId: string) {
    return this.bankAccountRepository.find({
      where: { workspaceId },
      order: { sortOrder: 'ASC', bankName: 'ASC', currencyCode: 'ASC' },
    });
  }

  async upsertBankAccount(input: UpsertBankAccountInput) {
    if (input.id) {
      const existing = await this.bankAccountRepository.findOne({
        where: { id: input.id, workspaceId: input.workspaceId },
      });

      if (!existing) throw new NotFoundException('Bank account not found');

      Object.assign(existing, {
        bankName: input.bankName,
        accountLabel: input.accountLabel ?? existing.accountLabel,
        currencyCode: input.currencyCode,
        balance: String(input.balance),
        balanceAsOf: new Date(),
        source: input.source ?? existing.source,
        bankRole: input.bankRole ?? existing.bankRole,
        xeroAccountId: input.xeroAccountId ?? existing.xeroAccountId,
        isActive: input.isActive ?? existing.isActive,
        sortOrder: input.sortOrder ?? existing.sortOrder,
      });

      return this.bankAccountRepository.save(existing);
    }

    return this.bankAccountRepository.save(
      this.bankAccountRepository.create({
        workspaceId: input.workspaceId,
        bankName: input.bankName,
        accountLabel: input.accountLabel ?? null,
        currencyCode: input.currencyCode,
        balance: String(input.balance),
        balanceAsOf: new Date(),
        source: input.source ?? 'manual',
        bankRole: input.bankRole ?? 'other',
        xeroAccountId: input.xeroAccountId ?? null,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      }),
    );
  }

  async deleteBankAccount(workspaceId: string, id: string) {
    const result = await this.bankAccountRepository.delete({
      id,
      workspaceId,
    });

    if (result.affected === 0) throw new NotFoundException('Bank account not found');
  }

  listPriorities(workspaceId: string) {
    return this.priorityRepository.find({ where: { workspaceId } });
  }

  async upsertPriority(input: UpsertPriorityInput) {
    const existing = await this.priorityRepository.findOne({
      where: {
        workspaceId: input.workspaceId,
        tenantId: input.tenantId,
        xeroInvoiceId: input.xeroInvoiceId,
      },
    });

    if (existing) {
      Object.assign(existing, {
        priority: input.priority ?? existing.priority,
        mustPay: input.mustPay ?? existing.mustPay,
        note: input.note ?? existing.note,
        updatedByUserId: input.updatedByUserId ?? existing.updatedByUserId,
      });

      return this.priorityRepository.save(existing);
    }

    return this.priorityRepository.save(
      this.priorityRepository.create({
        workspaceId: input.workspaceId,
        tenantId: input.tenantId,
        xeroInvoiceId: input.xeroInvoiceId,
        priority: input.priority ?? 3,
        mustPay: input.mustPay ?? false,
        note: input.note ?? null,
        updatedByUserId: input.updatedByUserId ?? null,
      }),
    );
  }

  async savePlan(input: SavePlanInput) {
    let plan = await this.planRepository.findOne({
      where: {
        workspaceId: input.workspaceId,
        fridayDate: input.fridayDate,
      },
    });

    if (!plan) {
      plan = await this.planRepository.save(
        this.planRepository.create({
          workspaceId: input.workspaceId,
          fridayDate: input.fridayDate,
          notes: input.notes ?? null,
          createdByUserId: input.createdByUserId ?? null,
          status: 'draft',
        }),
      );
    } else {
      plan.notes = input.notes ?? plan.notes;
      await this.planRepository.save(plan);
    }

    await this.planLineRepository.delete({ planId: plan.id });

    if (input.lines.length > 0) {
      await this.planLineRepository.save(
        input.lines.map((line) =>
          this.planLineRepository.create({
            planId: plan!.id,
            tenantId: line.tenantId,
            xeroInvoiceId: line.xeroInvoiceId,
            bankAccountId: line.bankAccountId ?? null,
            amount: String(line.amount),
            currencyCode: line.currencyCode,
            included: line.included ?? true,
          }),
        ),
      );
    }

    return this.getPlan(input.workspaceId, input.fridayDate);
  }

  async getPlan(workspaceId: string, fridayDate: string) {
    const plan = await this.planRepository.findOne({
      where: { workspaceId, fridayDate },
      relations: ['lines'],
    });

    return plan ?? null;
  }

  // Execute a saved plan: deduct each bill from its selected bank balance,
  // mark the bill paid locally, lock the plan. Local-only — does NOT write to Xero.
  async commitPlan(workspaceId: string, fridayDate: string) {
    const plan = await this.planRepository.findOne({
      where: { workspaceId, fridayDate },
      relations: ['lines'],
    });

    if (!plan) throw new NotFoundException('No saved plan for that date');
    if (plan.status === 'committed') {
      throw new NotFoundException('Plan already committed');
    }

    const includedLines = plan.lines.filter((line) => line.included);

    if (includedLines.length === 0) {
      throw new NotFoundException('Plan has no included bills to commit');
    }

    const deductions: Array<{
      bankAccountId: string;
      currencyCode: string;
      amount: number;
    }> = [];

    // Amount (in the paying bank's currency) to deduct per line. When the bank
    // holds a different currency (route-by-provider: NZD→BNZ, other currencies
    // →Wise/Statrys), convert the bill via the live FX rate.
    const lineDeduct = new Map<string, number>();

    // Validate every line has a bank before mutating anything.
    for (const line of includedLines) {
      if (!line.bankAccountId) {
        throw new NotFoundException(
          `Bill ${line.xeroInvoiceId} has no bank account assigned. Pick a bank for every bill before committing.`,
        );
      }

      const bank = await this.bankAccountRepository.findOne({
        where: { id: line.bankAccountId, workspaceId },
      });

      if (!bank) {
        throw new NotFoundException(
          `Bank account for bill ${line.xeroInvoiceId} not found`,
        );
      }

      let deductAmount = Number(line.amount);

      if (bank.currencyCode !== line.currencyCode) {
        const fx = await this.wiseSync.getRate(
          workspaceId,
          line.currencyCode,
          bank.currencyCode,
        );

        deductAmount = Number(line.amount) * fx.rate;
      }

      lineDeduct.set(line.xeroInvoiceId, deductAmount);

      deductions.push({
        bankAccountId: bank.id,
        currencyCode: bank.currencyCode,
        amount: deductAmount,
      });
    }

    // Apply: deduct balances (converted amount in the bank's currency).
    for (const line of includedLines) {
      const bank = await this.bankAccountRepository.findOne({
        where: { id: line.bankAccountId!, workspaceId },
      });

      if (bank) {
        const deduct = lineDeduct.get(line.xeroInvoiceId) ?? Number(line.amount);

        bank.balance = String(Number(bank.balance) - deduct);
        bank.balanceAsOf = new Date();
        await this.bankAccountRepository.save(bank);
      }

      // Mark the cached invoice paid locally.
      const invoice = await this.invoiceRepository.findOne({
        where: {
          workspaceId,
          tenantId: line.tenantId,
          xeroInvoiceId: line.xeroInvoiceId,
        },
      });

      if (invoice) {
        const paidNow = Number(line.amount);

        invoice.amountPaid = String(Number(invoice.amountPaid) + paidNow);
        invoice.amountDue = String(
          Math.max(0, Number(invoice.amountDue) - paidNow),
        );
        if (Number(invoice.amountDue) <= 0) invoice.status = 'PAID';
        await this.invoiceRepository.save(invoice);
      }
    }

    plan.status = 'committed';
    await this.planRepository.save(plan);

    const totalPaid = deductions.reduce((sum, d) => sum + d.amount, 0);

    return {
      committed: true,
      billsPaid: includedLines.length,
      totalPaid,
      deductions,
    };
  }
}
