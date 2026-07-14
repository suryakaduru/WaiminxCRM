import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { WaiminBankAccountEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-bank-account.entity';
import { WaiminManualAdjustmentEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-manual-adjustment.entity';
import { WaiminMandatoryPaymentEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-mandatory-payment.entity';
import { type FinanceReminderType } from 'src/engine/core-modules/xero-integration/entities/waimin-finance-reminder.entity';
import { CronExpressionParser } from 'cron-parser';
import { WaiminPaymentPriorityEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-payment-priority.entity';
import { XeroInvoiceEntity } from 'src/engine/core-modules/xero-integration/entities/xero-invoice.entity';

export type AgingBucket = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';

export type AgingRow = {
  currencyCode: string;
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
  total: number;
  count: number;
};

export type AgingReport = {
  asOf: string;
  receivable: AgingRow[];
  payable: AgingRow[];
};

export type CashPositionRow = {
  currencyCode: string;
  bankCount: number;
  balance: number;
};

export type WeeklyPlannerInvoice = {
  tenantId: string;
  xeroInvoiceId: string;
  invoiceNumber: string | null;
  contactName: string | null;
  currencyCode: string;
  amountDue: number;
  dueDate: string | null;
  daysUntilDue: number | null;
  overdue: boolean;
  priority: number;
  mustPay: boolean;
  note: string | null;
};

export type ManualAdjustment = {
  id: string;
  fridayDate: string;
  direction: 'in' | 'out';
  label: string;
  currencyCode: string;
  amount: number;
  bankAccountId: string | null;
  note: string | null;
};

export type MandatoryPaymentDue = {
  id: string;
  type: FinanceReminderType;
  label: string;
  currencyCode: string;
  amount: number;
  dueDate: string;
  bankAccountId: string | null;
};

export type WeeklyPlannerData = {
  fridayDate: string;
  cashByCurrency: CashPositionRow[];
  expectedReceipts: WeeklyPlannerInvoice[];
  duePayables: WeeklyPlannerInvoice[];
  adjustments: ManualAdjustment[];
  mandatoryPayments: MandatoryPaymentDue[];
  totalsByCurrency: Record<
    string,
    {
      cash: number;
      expectedIn: number;
      dueOut: number;
      adjustIn: number;
      adjustOut: number;
      net: number;
    }
  >;
};

const daysBetween = (from: Date, to: Date): number =>
  Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

// First scheduled occurrence of a cron expression that falls within
// (windowStart, windowEnd], or null if the schedule doesn't fire this week.
// Lets recurring payments auto-appear only in the pay-week they are due.
const firstOccurrenceInWindow = (
  cron: string,
  windowStart: Date,
  windowEnd: Date,
): Date | null => {
  try {
    const iterator = CronExpressionParser.parse(cron, {
      currentDate: new Date(windowStart.getTime() - 1),
    });

    // Iterate up to a small bound to avoid runaway loops on dense schedules.
    for (let i = 0; i < 60; i++) {
      const occurrence = iterator.next().toDate();

      if (occurrence > windowEnd) return null;
      if (occurrence >= windowStart) return occurrence;
    }

    return null;
  } catch {
    return null;
  }
};

@Injectable()
export class FinanceAnalyticsService {
  constructor(
    @InjectRepository(XeroInvoiceEntity)
    private readonly invoiceRepository: Repository<XeroInvoiceEntity>,
    @InjectRepository(WaiminBankAccountEntity)
    private readonly bankAccountRepository: Repository<WaiminBankAccountEntity>,
    @InjectRepository(WaiminPaymentPriorityEntity)
    private readonly priorityRepository: Repository<WaiminPaymentPriorityEntity>,
    @InjectRepository(WaiminManualAdjustmentEntity)
    private readonly adjustmentRepository: Repository<WaiminManualAdjustmentEntity>,
    @InjectRepository(WaiminMandatoryPaymentEntity)
    private readonly mandatoryPaymentRepository: Repository<WaiminMandatoryPaymentEntity>,
  ) {}

  async getAging(workspaceId: string): Promise<AgingReport> {
    const invoices = await this.invoiceRepository.find({
      where: { workspaceId, status: 'AUTHORISED' },
    });
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const receivable = new Map<string, AgingRow>();
    const payable = new Map<string, AgingRow>();

    for (const invoice of invoices) {
      const amountDue = Number(invoice.amountDue);

      if (!Number.isFinite(amountDue) || amountDue <= 0) continue;

      const currency = invoice.currencyCode ?? 'USD';
      const target = invoice.type === 'ACCREC' ? receivable : payable;
      const row = target.get(currency) ?? {
        currencyCode: currency,
        current: 0,
        d1_30: 0,
        d31_60: 0,
        d61_90: 0,
        d90_plus: 0,
        total: 0,
        count: 0,
      };

      const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
      const daysOverdue = dueDate ? daysBetween(dueDate, today) : 0;

      if (daysOverdue <= 0) row.current += amountDue;
      else if (daysOverdue <= 30) row.d1_30 += amountDue;
      else if (daysOverdue <= 60) row.d31_60 += amountDue;
      else if (daysOverdue <= 90) row.d61_90 += amountDue;
      else row.d90_plus += amountDue;

      row.total += amountDue;
      row.count += 1;
      target.set(currency, row);
    }

    return {
      asOf: todayStr,
      receivable: Array.from(receivable.values()).sort((a, b) =>
        a.currencyCode.localeCompare(b.currencyCode),
      ),
      payable: Array.from(payable.values()).sort((a, b) =>
        a.currencyCode.localeCompare(b.currencyCode),
      ),
    };
  }

  async getCashPosition(workspaceId: string): Promise<CashPositionRow[]> {
    const accounts = await this.bankAccountRepository.find({
      where: { workspaceId, isActive: true },
    });
    const grouped = new Map<string, CashPositionRow>();

    for (const account of accounts) {
      const row = grouped.get(account.currencyCode) ?? {
        currencyCode: account.currencyCode,
        bankCount: 0,
        balance: 0,
      };

      row.balance += Number(account.balance);
      row.bankCount += 1;
      grouped.set(account.currencyCode, row);
    }

    return Array.from(grouped.values()).sort((a, b) =>
      a.currencyCode.localeCompare(b.currencyCode),
    );
  }

  async getWeeklyPlanner(
    workspaceId: string,
    fridayDate: string,
  ): Promise<WeeklyPlannerData> {
    const friday = new Date(fridayDate);

    if (Number.isNaN(friday.getTime())) {
      throw new Error(`Invalid fridayDate: ${fridayDate}`);
    }

    const [invoices, priorities, cashByCurrency, adjustmentRows, mandatoryRows] =
      await Promise.all([
        this.invoiceRepository.find({
          where: { workspaceId, status: 'AUTHORISED' },
        }),
        this.priorityRepository.find({ where: { workspaceId } }),
        this.getCashPosition(workspaceId),
        this.adjustmentRepository.find({
          where: { workspaceId, fridayDate },
          order: { createdAt: 'ASC' },
        }),
        this.mandatoryPaymentRepository.find({
          where: { workspaceId, isActive: true },
          order: { nextDueDate: 'ASC' },
        }),
      ]);

    // Pay-week = the 7 days ending on the planner's Friday. A recurring
    // payment shows only if its schedule fires inside that window, and not
    // before its start date (nextDueDate acts as "active from").
    const weekEnd = new Date(friday);
    weekEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date(friday);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const adjustments: ManualAdjustment[] = adjustmentRows.map((row) => ({
      id: row.id,
      fridayDate: row.fridayDate,
      direction: row.direction,
      label: row.label,
      currencyCode: row.currencyCode,
      amount: Number(row.amount),
      bankAccountId: row.bankAccountId,
      note: row.note,
    }));

    const mandatoryPayments: MandatoryPaymentDue[] = [];

    for (const row of mandatoryRows) {
      const startBound = new Date(row.nextDueDate);
      const occurrence = firstOccurrenceInWindow(
        row.frequencyCron,
        weekStart,
        weekEnd,
      );

      // Skip if the schedule doesn't fire this week, or fires before the
      // payment's start date.
      if (!occurrence || occurrence < startBound) continue;

      mandatoryPayments.push({
        id: row.id,
        type: row.type,
        label: row.label,
        currencyCode: row.currencyCode,
        amount: Number(row.amount),
        dueDate: occurrence.toISOString().slice(0, 10),
        bankAccountId: row.bankAccountId,
      });
    }

    const priorityMap = new Map(
      priorities.map((p) => [`${p.tenantId}:${p.xeroInvoiceId}`, p]),
    );

    const expectedReceipts: WeeklyPlannerInvoice[] = [];
    const duePayables: WeeklyPlannerInvoice[] = [];

    for (const invoice of invoices) {
      const amountDue = Number(invoice.amountDue);

      if (!Number.isFinite(amountDue) || amountDue <= 0) continue;

      const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
      const daysUntilDue = dueDate ? daysBetween(new Date(), dueDate) : null;
      const overrideKey = `${invoice.tenantId}:${invoice.xeroInvoiceId}`;
      const override = priorityMap.get(overrideKey);
      const currency = invoice.currencyCode ?? 'USD';

      const row: WeeklyPlannerInvoice = {
        tenantId: invoice.tenantId,
        xeroInvoiceId: invoice.xeroInvoiceId,
        invoiceNumber: invoice.invoiceNumber,
        contactName: invoice.contactName,
        currencyCode: currency,
        amountDue,
        dueDate: invoice.dueDate,
        daysUntilDue,
        overdue: dueDate ? dueDate < new Date() : false,
        priority: override?.priority ?? 3,
        mustPay: override?.mustPay ?? false,
        note: override?.note ?? null,
      };

      if (!dueDate || dueDate <= friday) {
        if (invoice.type === 'ACCREC') expectedReceipts.push(row);
        else duePayables.push(row);
      }
    }

    expectedReceipts.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
    duePayables.sort((a, b) => {
      if (a.mustPay !== b.mustPay) return a.mustPay ? -1 : 1;
      if (a.priority !== b.priority) return a.priority - b.priority;

      return (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
    });

    const totalsByCurrency: WeeklyPlannerData['totalsByCurrency'] = {};

    const emptyTotals = () => ({
      cash: 0,
      expectedIn: 0,
      dueOut: 0,
      adjustIn: 0,
      adjustOut: 0,
      net: 0,
    });

    for (const row of cashByCurrency) {
      totalsByCurrency[row.currencyCode] = {
        ...emptyTotals(),
        cash: row.balance,
        net: row.balance,
      };
    }
    for (const row of expectedReceipts) {
      const t = (totalsByCurrency[row.currencyCode] ??= emptyTotals());

      t.expectedIn += row.amountDue;
      t.net += row.amountDue;
    }
    for (const row of duePayables) {
      const t = (totalsByCurrency[row.currencyCode] ??= emptyTotals());

      t.dueOut += row.amountDue;
      t.net -= row.amountDue;
    }
    for (const row of adjustments) {
      const t = (totalsByCurrency[row.currencyCode] ??= emptyTotals());

      if (row.direction === 'in') {
        t.adjustIn += row.amount;
        t.net += row.amount;
      } else {
        t.adjustOut += row.amount;
        t.net -= row.amount;
      }
    }
    // Mandatory payments are always-on outflows — counted in dueOut so the
    // position after Friday reflects them even before any bill is ticked.
    for (const row of mandatoryPayments) {
      const t = (totalsByCurrency[row.currencyCode] ??= emptyTotals());

      t.dueOut += row.amount;
      t.net -= row.amount;
    }

    return {
      fridayDate,
      cashByCurrency,
      expectedReceipts,
      duePayables,
      adjustments,
      mandatoryPayments,
      totalsByCurrency,
    };
  }
}
