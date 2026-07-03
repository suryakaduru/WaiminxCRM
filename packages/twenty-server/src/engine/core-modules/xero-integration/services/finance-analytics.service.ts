import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { WaiminBankAccountEntity } from 'src/engine/core-modules/xero-integration/entities/waimin-bank-account.entity';
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

export type WeeklyPlannerData = {
  fridayDate: string;
  cashByCurrency: CashPositionRow[];
  expectedReceipts: WeeklyPlannerInvoice[];
  duePayables: WeeklyPlannerInvoice[];
  totalsByCurrency: Record<
    string,
    { cash: number; expectedIn: number; dueOut: number; net: number }
  >;
};

const daysBetween = (from: Date, to: Date): number =>
  Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

@Injectable()
export class FinanceAnalyticsService {
  constructor(
    @InjectRepository(XeroInvoiceEntity)
    private readonly invoiceRepository: Repository<XeroInvoiceEntity>,
    @InjectRepository(WaiminBankAccountEntity)
    private readonly bankAccountRepository: Repository<WaiminBankAccountEntity>,
    @InjectRepository(WaiminPaymentPriorityEntity)
    private readonly priorityRepository: Repository<WaiminPaymentPriorityEntity>,
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

    const [invoices, priorities, cashByCurrency] = await Promise.all([
      this.invoiceRepository.find({
        where: { workspaceId, status: 'AUTHORISED' },
      }),
      this.priorityRepository.find({ where: { workspaceId } }),
      this.getCashPosition(workspaceId),
    ]);

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

    const totalsByCurrency: Record<
      string,
      { cash: number; expectedIn: number; dueOut: number; net: number }
    > = {};

    for (const row of cashByCurrency) {
      totalsByCurrency[row.currencyCode] = {
        cash: row.balance,
        expectedIn: 0,
        dueOut: 0,
        net: row.balance,
      };
    }
    for (const row of expectedReceipts) {
      const t = (totalsByCurrency[row.currencyCode] ??= {
        cash: 0,
        expectedIn: 0,
        dueOut: 0,
        net: 0,
      });

      t.expectedIn += row.amountDue;
      t.net += row.amountDue;
    }
    for (const row of duePayables) {
      const t = (totalsByCurrency[row.currencyCode] ??= {
        cash: 0,
        expectedIn: 0,
        dueOut: 0,
        net: 0,
      });

      t.dueOut += row.amountDue;
      t.net -= row.amountDue;
    }

    return {
      fridayDate,
      cashByCurrency,
      expectedReceipts,
      duePayables,
      totalsByCurrency,
    };
  }
}
