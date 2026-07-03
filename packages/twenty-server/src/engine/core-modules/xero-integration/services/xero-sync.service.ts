import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { XeroBankAccountEntity } from 'src/engine/core-modules/xero-integration/entities/xero-bank-account.entity';
import { XeroConnectionEntity } from 'src/engine/core-modules/xero-integration/entities/xero-connection.entity';
import { XeroContactEntity } from 'src/engine/core-modules/xero-integration/entities/xero-contact.entity';
import { XeroInvoiceEntity } from 'src/engine/core-modules/xero-integration/entities/xero-invoice.entity';
import {
  XeroSyncCursorEntity,
  XeroSyncEntityType,
} from 'src/engine/core-modules/xero-integration/entities/xero-sync-cursor.entity';
import { XeroConnectionService } from 'src/engine/core-modules/xero-integration/services/xero-connection.service';

const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0';
const INVOICE_PAGE_SIZE = 100;
const CONTACT_PAGE_SIZE = 100;

type XeroInvoiceApi = {
  InvoiceID: string;
  InvoiceNumber?: string;
  Type: string;
  Status: string;
  Contact?: { ContactID?: string; Name?: string };
  DateString?: string;
  Date?: string;
  DueDateString?: string;
  DueDate?: string;
  CurrencyCode?: string;
  SubTotal?: number;
  TotalTax?: number;
  Total?: number;
  AmountDue?: number;
  AmountPaid?: number;
  AmountCredited?: number;
  Reference?: string;
  FullyPaidOnDate?: string;
  UpdatedDateUTC?: string;
};

type XeroContactApi = {
  ContactID: string;
  Name?: string;
  EmailAddress?: string;
  IsCustomer?: boolean;
  IsSupplier?: boolean;
  DefaultCurrency?: string;
  UpdatedDateUTC?: string;
};

type XeroAccountApi = {
  AccountID: string;
  Code?: string;
  Name?: string;
  Type?: string;
  CurrencyCode?: string;
  BankAccountNumber?: string;
  Status?: string;
  UpdatedDateUTC?: string;
};

// Parse "/Date(1234567890000+0000)/" or ISO strings from Xero.
const parseXeroDate = (raw: string | undefined | null): Date | null => {
  if (!raw) return null;
  const match = /\/Date\((-?\d+)/.exec(raw);

  if (match) {
    const ms = Number(match[1]);

    return Number.isFinite(ms) ? new Date(ms) : null;
  }

  const parsed = new Date(raw);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toDateString = (value: Date | null): string | null => {
  if (!value) return null;

  return value.toISOString().slice(0, 10);
};

@Injectable()
export class XeroSyncService {
  private readonly logger = new Logger(XeroSyncService.name);

  constructor(
    @InjectRepository(XeroInvoiceEntity)
    private readonly invoiceRepository: Repository<XeroInvoiceEntity>,
    @InjectRepository(XeroContactEntity)
    private readonly contactRepository: Repository<XeroContactEntity>,
    @InjectRepository(XeroBankAccountEntity)
    private readonly bankAccountRepository: Repository<XeroBankAccountEntity>,
    @InjectRepository(XeroSyncCursorEntity)
    private readonly cursorRepository: Repository<XeroSyncCursorEntity>,
    private readonly xeroConnectionService: XeroConnectionService,
  ) {}

  async syncConnection(
    connection: XeroConnectionEntity,
    entities: XeroSyncEntityType[] = ['invoices', 'contacts', 'bankAccounts'],
  ): Promise<Record<XeroSyncEntityType, number>> {
    const result: Record<XeroSyncEntityType, number> = {
      invoices: 0,
      contacts: 0,
      bankAccounts: 0,
    };

    for (const entityType of entities) {
      try {
        result[entityType] = await this.runEntitySync(connection, entityType);
      } catch (error) {
        this.logger.error(
          `Xero ${entityType} sync failed for workspace ${connection.workspaceId} tenant ${connection.tenantId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        await this.markCursorError(
          connection,
          entityType,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    return result;
  }

  private async runEntitySync(
    connection: XeroConnectionEntity,
    entityType: XeroSyncEntityType,
  ): Promise<number> {
    const cursor = await this.getOrCreateCursor(connection, entityType);

    cursor.status = 'running';
    cursor.lastError = null;
    await this.cursorRepository.save(cursor);

    const accessToken = await this.xeroConnectionService.getValidAccessToken(
      connection,
    );

    let count = 0;
    let maxCursor: Date | null = cursor.lastCursorAt;

    switch (entityType) {
      case 'invoices': {
        const { synced, cursorAt } = await this.syncInvoices(
          connection,
          accessToken,
          cursor.lastCursorAt,
        );

        count = synced;
        maxCursor = cursorAt ?? maxCursor;
        break;
      }
      case 'contacts': {
        const { synced, cursorAt } = await this.syncContacts(
          connection,
          accessToken,
          cursor.lastCursorAt,
        );

        count = synced;
        maxCursor = cursorAt ?? maxCursor;
        break;
      }
      case 'bankAccounts': {
        const { synced, cursorAt } = await this.syncBankAccounts(
          connection,
          accessToken,
          cursor.lastCursorAt,
        );

        count = synced;
        maxCursor = cursorAt ?? maxCursor;
        break;
      }
    }

    cursor.status = 'idle';
    cursor.recordsSyncedLastRun = count;
    cursor.lastSyncedAt = new Date();
    cursor.lastCursorAt = maxCursor;
    await this.cursorRepository.save(cursor);

    this.logger.log(
      `Xero ${entityType} sync ok — workspace ${connection.workspaceId} tenant ${connection.tenantId}: ${count} records`,
    );

    return count;
  }

  private async syncInvoices(
    connection: XeroConnectionEntity,
    accessToken: string,
    since: Date | null,
  ): Promise<{ synced: number; cursorAt: Date | null }> {
    let page = 1;
    let synced = 0;
    let maxCursor: Date | null = since;

    while (true) {
      const url = `${XERO_API_BASE}/Invoices?page=${page}&pageSize=${INVOICE_PAGE_SIZE}&order=UpdatedDateUTC%20ASC`;
      const invoices = await this.xeroFetch<{ Invoices?: XeroInvoiceApi[] }>(
        url,
        accessToken,
        connection.tenantId,
        since,
      );
      const batch = invoices.Invoices ?? [];

      if (batch.length === 0) break;

      for (const invoice of batch) {
        const updatedAt = parseXeroDate(invoice.UpdatedDateUTC);

        if (updatedAt && (!maxCursor || updatedAt > maxCursor)) {
          maxCursor = updatedAt;
        }

        await this.invoiceRepository.upsert(
          {
            workspaceId: connection.workspaceId,
            tenantId: connection.tenantId,
            xeroInvoiceId: invoice.InvoiceID,
            invoiceNumber: invoice.InvoiceNumber ?? null,
            type: invoice.Type,
            status: invoice.Status,
            contactXeroId: invoice.Contact?.ContactID ?? null,
            contactName: invoice.Contact?.Name ?? null,
            date: toDateString(
              parseXeroDate(invoice.DateString ?? invoice.Date ?? null),
            ),
            dueDate: toDateString(
              parseXeroDate(invoice.DueDateString ?? invoice.DueDate ?? null),
            ),
            currencyCode: invoice.CurrencyCode ?? null,
            subTotal: String(invoice.SubTotal ?? 0),
            totalTax: String(invoice.TotalTax ?? 0),
            total: String(invoice.Total ?? 0),
            amountDue: String(invoice.AmountDue ?? 0),
            amountPaid: String(invoice.AmountPaid ?? 0),
            amountCredited: String(invoice.AmountCredited ?? 0),
            reference: invoice.Reference ?? null,
            fullyPaidOnDate: toDateString(
              parseXeroDate(invoice.FullyPaidOnDate ?? null),
            ),
            xeroUpdatedDateUtc: updatedAt,
            lastSyncedAt: new Date(),
            raw: invoice as any,
          },
          {
            conflictPaths: ['tenantId', 'xeroInvoiceId'],
          },
        );

        synced++;
      }

      if (batch.length < INVOICE_PAGE_SIZE) break;
      page++;
    }

    return { synced, cursorAt: maxCursor };
  }

  private async syncContacts(
    connection: XeroConnectionEntity,
    accessToken: string,
    since: Date | null,
  ): Promise<{ synced: number; cursorAt: Date | null }> {
    let page = 1;
    let synced = 0;
    let maxCursor: Date | null = since;

    while (true) {
      const url = `${XERO_API_BASE}/Contacts?page=${page}&pageSize=${CONTACT_PAGE_SIZE}&order=UpdatedDateUTC%20ASC`;
      const contacts = await this.xeroFetch<{ Contacts?: XeroContactApi[] }>(
        url,
        accessToken,
        connection.tenantId,
        since,
      );
      const batch = contacts.Contacts ?? [];

      if (batch.length === 0) break;

      for (const contact of batch) {
        const updatedAt = parseXeroDate(contact.UpdatedDateUTC);

        if (updatedAt && (!maxCursor || updatedAt > maxCursor)) {
          maxCursor = updatedAt;
        }

        await this.contactRepository.upsert(
          {
            workspaceId: connection.workspaceId,
            tenantId: connection.tenantId,
            xeroContactId: contact.ContactID,
            name: contact.Name ?? null,
            emailAddress: contact.EmailAddress ?? null,
            isCustomer: contact.IsCustomer ?? false,
            isSupplier: contact.IsSupplier ?? false,
            defaultCurrencyCode: contact.DefaultCurrency ?? null,
            xeroUpdatedDateUtc: updatedAt,
            lastSyncedAt: new Date(),
            raw: contact as any,
          },
          {
            conflictPaths: ['tenantId', 'xeroContactId'],
          },
        );

        synced++;
      }

      if (batch.length < CONTACT_PAGE_SIZE) break;
      page++;
    }

    return { synced, cursorAt: maxCursor };
  }

  private async syncBankAccounts(
    connection: XeroConnectionEntity,
    accessToken: string,
    since: Date | null,
  ): Promise<{ synced: number; cursorAt: Date | null }> {
    // Xero returns all accounts; filter Type=BANK client-side.
    const url = `${XERO_API_BASE}/Accounts?where=Type%3D%3D%22BANK%22`;
    const accounts = await this.xeroFetch<{ Accounts?: XeroAccountApi[] }>(
      url,
      accessToken,
      connection.tenantId,
      null,
    );
    const batch = accounts.Accounts ?? [];
    let synced = 0;
    let maxCursor: Date | null = since;

    for (const account of batch) {
      const updatedAt = parseXeroDate(account.UpdatedDateUTC);

      if (updatedAt && (!maxCursor || updatedAt > maxCursor)) {
        maxCursor = updatedAt;
      }

      await this.bankAccountRepository.upsert(
        {
          workspaceId: connection.workspaceId,
          tenantId: connection.tenantId,
          xeroAccountId: account.AccountID,
          code: account.Code ?? null,
          name: account.Name ?? null,
          currencyCode: account.CurrencyCode ?? null,
          bankAccountNumber: account.BankAccountNumber ?? null,
          status: account.Status ?? null,
          xeroUpdatedDateUtc: updatedAt,
          lastSyncedAt: new Date(),
          raw: account as any,
        },
        {
          conflictPaths: ['tenantId', 'xeroAccountId'],
        },
      );

      synced++;
    }

    return { synced, cursorAt: maxCursor };
  }

  private async xeroFetch<T>(
    url: string,
    accessToken: string,
    tenantId: string,
    ifModifiedSince: Date | null,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Xero-Tenant-Id': tenantId,
      Accept: 'application/json',
    };

    if (ifModifiedSince) {
      // Xero honours If-Modified-Since as a delta cursor.
      headers['If-Modified-Since'] = ifModifiedSince.toUTCString();
    }

    const response = await fetch(url, { headers });

    if (response.status === 304) {
      return {} as T;
    }

    if (!response.ok) {
      const body = await response.text();

      throw new BadRequestException(
        `Xero API ${response.status}: ${body.slice(0, 500)}`,
      );
    }

    return (await response.json()) as T;
  }

  private async getOrCreateCursor(
    connection: XeroConnectionEntity,
    entityType: XeroSyncEntityType,
  ): Promise<XeroSyncCursorEntity> {
    const existing = await this.cursorRepository.findOne({
      where: {
        workspaceId: connection.workspaceId,
        tenantId: connection.tenantId,
        entityType,
      },
    });

    if (existing) return existing;

    return this.cursorRepository.save(
      this.cursorRepository.create({
        workspaceId: connection.workspaceId,
        tenantId: connection.tenantId,
        entityType,
        status: 'idle',
      }),
    );
  }

  private async markCursorError(
    connection: XeroConnectionEntity,
    entityType: XeroSyncEntityType,
    message: string,
  ): Promise<void> {
    const cursor = await this.getOrCreateCursor(connection, entityType);

    cursor.status = 'error';
    cursor.lastError = message.slice(0, 2000);
    await this.cursorRepository.save(cursor);
  }

  async listCursors(workspaceId: string): Promise<XeroSyncCursorEntity[]> {
    return this.cursorRepository.find({ where: { workspaceId } });
  }
}
