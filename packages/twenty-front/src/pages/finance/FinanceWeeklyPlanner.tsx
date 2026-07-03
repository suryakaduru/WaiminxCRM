import { tokenPairState } from '@/auth/states/tokenPairState';
import { PageTitle } from '@/ui/utilities/page-title/components/PageTitle';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { xeroFetch } from '@/xero-integration/utils/xero-api';
import { styled } from '@linaria/react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

type CashRow = { currencyCode: string; bankCount: number; balance: number };

type Invoice = {
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

type PlannerResponse = {
  fridayDate: string;
  cashByCurrency: CashRow[];
  expectedReceipts: Invoice[];
  duePayables: Invoice[];
  totalsByCurrency: Record<
    string,
    { cash: number; expectedIn: number; dueOut: number; net: number }
  >;
};

type BankAccount = {
  id: string;
  bankName: string;
  currencyCode: string;
  accountLabel: string | null;
};

/* ─────────────────── Styled Components (CRM Theme) ─────────────────── */

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[6]};
  height: 100%;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[6]} ${themeCssVariables.spacing[8]};
  width: 100%;
`;

const StyledHeader = styled.header`
  display: flex;
  gap: ${themeCssVariables.spacing[4]};
  justify-content: space-between;
  align-items: flex-end;
`;

const StyledHeadings = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledTitle = styled.h1`
  color: ${themeCssVariables.font.color.primary};
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0;
`;

const StyledSubtitle = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 14px;
  margin: 0;
  max-width: 720px;
  line-height: 1.5;
`;

const StyledActions = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  flex-shrink: 0;
`;

const StyledInput = styled.input`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-size: 13px;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  transition: border-color 0.15s;
  &:focus {
    outline: none;
    border-color: ${themeCssVariables.accent.primary};
  }
`;

const StyledSelect = styled.select`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-size: 13px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  transition: border-color 0.15s;
  &:focus {
    outline: none;
    border-color: ${themeCssVariables.accent.primary};
  }
`;

const StyledPrimaryButton = styled.button`
  background: ${themeCssVariables.accent.primary};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.inverted};
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
  transition: opacity 0.15s;
  &:hover { opacity: 0.85; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const StyledSecondaryButton = styled.button`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  transition: background 0.15s;
  &:hover { background: ${themeCssVariables.background.secondary}; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const StyledSteps = styled.ol`
  align-items: stretch;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: grid;
  gap: 0;
  grid-template-columns: repeat(3, 1fr);
  list-style: none;
  margin: 0;
  padding: 0;
  overflow: hidden;
`;

const StyledStep = styled.li`
  display: flex;
  gap: 12px;
  padding: ${themeCssVariables.spacing[4]} ${themeCssVariables.spacing[5]};
  position: relative;
  &:not(:last-child)::after {
    content: '';
    position: absolute;
    right: 0;
    top: 16px;
    bottom: 16px;
    width: 1px;
    background: ${themeCssVariables.border.color.light};
  }
`;

const StyledStepNum = styled.div`
  align-items: center;
  background: ${themeCssVariables.accent.primary};
  border-radius: 50%;
  color: ${themeCssVariables.font.color.inverted};
  display: flex;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  height: 24px;
  justify-content: center;
  width: 24px;
`;

const StyledSummary = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[4]};
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
`;

const StyledCard = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  overflow: hidden;
`;

const StyledSummaryCard = styled(StyledCard)`
  border-left: 3px solid ${themeCssVariables.accent.primary};
  padding: ${themeCssVariables.spacing[4]};
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const StyledSummaryLabel = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;

const StyledMathRow = styled.div`
  display: flex;
  font-size: 13px;
  gap: 6px;
  justify-content: space-between;
`;

const StyledSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledSectionHeader = styled.div`
  align-items: baseline;
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
  justify-content: space-between;
`;

const StyledSectionTitle = styled.h2`
  color: ${themeCssVariables.font.color.primary};
  font-size: 15px;
  font-weight: 600;
  margin: 0;
`;

const StyledSectionDescription = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 12px;
  margin: 0;
  max-width: 640px;
  line-height: 1.5;
`;

const StyledTable = styled.table`
  border-collapse: collapse;
  width: 100%;

  & thead {
    background: ${themeCssVariables.background.secondary};
    border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  }

  & th,
  & td {
    border-bottom: 1px solid ${themeCssVariables.border.color.light};
    font-size: 13px;
    padding: 10px 14px;
    text-align: left;
    vertical-align: middle;
  }

  & th {
    color: ${themeCssVariables.font.color.tertiary};
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  & tbody tr {
    transition: background 0.1s;
  }

  & tbody tr:hover td {
    background: ${themeCssVariables.background.transparent.lighter};
  }

  & tr:last-child td { border-bottom: none; }
  & td.num, & th.num { font-variant-numeric: tabular-nums; text-align: right; }
  & tr.overdue { background: ${themeCssVariables.background.transparent.danger}; }
  & tr.mustPay { background: ${themeCssVariables.background.transparent.blue}; }
`;

const StyledPill = styled.span`
  border-radius: ${themeCssVariables.border.radius.pill};
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  letter-spacing: 0.01em;
`;

const PILL_STYLES: Record<'red' | 'gray' | 'blue', CSSProperties> = {
  red: { background: 'var(--t-background-transparent-danger)', color: 'var(--t-font-color-danger)' },
  blue: { background: 'var(--t-background-transparent-blue)', color: 'var(--t-accent-primary)' },
  gray: { background: 'var(--t-background-secondary)', color: 'var(--t-font-color-tertiary)' },
};

const StyledEmpty = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  padding: ${themeCssVariables.spacing[8]} ${themeCssVariables.spacing[6]};
  text-align: center;
  font-size: 13px;
`;

const StyledStickyBar = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  bottom: 16px;
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  gap: ${themeCssVariables.spacing[4]};
  justify-content: space-between;
  margin-top: ${themeCssVariables.spacing[4]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[5]};
  position: sticky;
  z-index: 10;
`;

const StyledSyncBadge = styled.span`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: inline-flex;
  font-size: 11px;
  gap: 4px;
`;

const StyledAlertSuccess = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.transparent.success};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  font-size: 13px;
  font-weight: 500;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
`;

/* ─────────────────── Helpers ─────────────────── */

const nextFridayISO = (): string => {
  const d = new Date();
  const day = d.getDay();
  const diff = (5 - day + 7) % 7 || 7;

  d.setDate(d.getDate() + diff);

  return d.toISOString().slice(0, 10);
};

const fmt = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

const exportCSV = (rows: Invoice[], banks: BankAccount[], bankByInvoice: Record<string, string>, friday: string) => {
  const header = 'Pay Date,Invoice #,Supplier,Currency,Amount,Pay From Bank\n';
  const lines = rows.map((row) => {
    const bank = banks.find((b) => b.id === bankByInvoice[row.xeroInvoiceId]);
    const bankLabel = bank ? `${bank.bankName}${bank.accountLabel ? ` · ${bank.accountLabel}` : ''}` : '';
    return [
      friday,
      row.invoiceNumber ?? '',
      `"${(row.contactName ?? '').replace(/"/g, '""')}"`,
      row.currencyCode,
      row.amountDue.toFixed(2),
      `"${bankLabel}"`,
    ].join(',');
  });
  const blob = new Blob([header + lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payment-run-${friday}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

/* ─────────────────── Component ─────────────────── */

export const FinanceWeeklyPlanner = () => {
  const { t } = useLingui();
  const tokenPair = useAtomStateValue(tokenPairState);

  const [friday, setFriday] = useState<string>(nextFridayISO());
  const [data, setData] = useState<PlannerResponse | null>(null);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [primaryTenant, setPrimaryTenant] = useState<string | null>(null);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [bankByInvoice, setBankByInvoice] = useState<Record<string, string>>({});
  const [priority, setPriority] = useState<Record<string, number>>({});
  const [mustPay, setMustPay] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isDefined(tokenPair?.accessOrWorkspaceAgnosticToken?.token)) return;
    try {
      setError(null);
      const [planner, bankList, sync, savedPlan] = await Promise.all([
        xeroFetch<PlannerResponse>(
          `/finance/cashflow/weekly?friday=${friday}`,
          tokenPair,
        ),
        xeroFetch<BankAccount[]>('/finance/bank-accounts', tokenPair),
        xeroFetch<{ cursors: Array<{ tenantId: string; lastSyncedAt: string | null }> }>(
          '/finance/xero/sync/status',
          tokenPair,
        ),
        xeroFetch<{ plan: any }>(
          `/finance/cashflow/plan?friday=${friday}`,
          tokenPair,
        ).catch(() => ({ plan: null })),
      ]);

      setData(planner);
      setBanks(bankList);
      setPrimaryTenant(sync.cursors[0]?.tenantId ?? null);

      const syncTimes = sync.cursors
        .map((c) => c.lastSyncedAt)
        .filter(Boolean)
        .sort()
        .reverse();
      setLastSyncedAt(syncTimes[0] ?? null);

      const initialSelection: Record<string, boolean> = {};
      const initialBankByInvoice: Record<string, string> = {};
      const initialPriority: Record<string, number> = {};
      const initialMustPay: Record<string, boolean> = {};

      const planLines = savedPlan?.plan?.lines ?? [];
      if (savedPlan?.plan?.updatedAt) {
        setSavedAt(savedPlan.plan.updatedAt);
      } else {
        setSavedAt(null);
      }

      for (const row of planner.duePayables) {
        initialPriority[row.xeroInvoiceId] = row.priority;
        initialMustPay[row.xeroInvoiceId] = row.mustPay;

        const plannedLine = planLines.find((l: any) => l.xeroInvoiceId === row.xeroInvoiceId);
        if (plannedLine) {
          initialSelection[row.xeroInvoiceId] = plannedLine.included;
          if (plannedLine.bankAccountId) {
            initialBankByInvoice[row.xeroInvoiceId] = plannedLine.bankAccountId;
          }
        } else {
          initialSelection[row.xeroInvoiceId] = row.mustPay;
        }
      }
      setSelection(initialSelection);
      setBankByInvoice(initialBankByInvoice);
      setPriority(initialPriority);
      setMustPay(initialMustPay);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    }
  }, [tokenPair, friday]);

  const handleSync = async () => {
    if (!tokenPair || isSyncing) return;
    setIsSyncing(true);
    setError(null);
    try {
      await xeroFetch('/finance/xero/sync', tokenPair, { method: 'POST' });
      await new Promise((r) => setTimeout(r, 2000));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const tallies = useMemo(() => {
    if (!data) return {};
    const result: Record<
      string,
      { cash: number; expectedIn: number; selectedOut: number; postFriday: number }
    > = {};

    for (const [currency, tot] of Object.entries(data.totalsByCurrency)) {
      result[currency] = {
        cash: tot.cash,
        expectedIn: tot.expectedIn,
        selectedOut: 0,
        postFriday: tot.cash + tot.expectedIn,
      };
    }
    for (const row of data.duePayables) {
      if (selection[row.xeroInvoiceId]) {
        const tt = (result[row.currencyCode] ??= {
          cash: 0,
          expectedIn: 0,
          selectedOut: 0,
          postFriday: 0,
        });

        tt.selectedOut += row.amountDue;
        tt.postFriday -= row.amountDue;
      }
    }

    return result;
  }, [data, selection]);

  const savePriority = async (tenantId: string, invoiceId: string) => {
    if (!tokenPair) return;
    try {
      await xeroFetch('/finance/priorities', tokenPair, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          xeroInvoiceId: invoiceId,
          priority: priority[invoiceId] ?? 3,
          mustPay: mustPay[invoiceId] ?? false,
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save priority failed');
    }
  };

  const handleSavePlan = async () => {
    if (!tokenPair || !data) return;
    setIsSaving(true);
    try {
      const lines = data.duePayables
        .filter((row) => selection[row.xeroInvoiceId])
        .map((row) => ({
          tenantId: row.tenantId,
          xeroInvoiceId: row.xeroInvoiceId,
          bankAccountId: bankByInvoice[row.xeroInvoiceId] || undefined,
          amount: row.amountDue,
          currencyCode: row.currencyCode,
          included: true,
        }));

      await xeroFetch('/finance/cashflow/plan', tokenPair, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fridayDate: friday, lines }),
      });
      setSavedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCommitPlan = async () => {
    if (!tokenPair || !data) return;
    const unassigned = data.duePayables.filter(
      (row) => selection[row.xeroInvoiceId] && !bankByInvoice[row.xeroInvoiceId],
    );

    if (unassigned.length > 0) {
      setError(
        t`Assign a "Pay from" bank to every selected bill before committing (${unassigned.length} missing).`,
      );

      return;
    }

    const total = data.duePayables
      .filter((row) => selection[row.xeroInvoiceId])
      .reduce((sum, row) => sum + row.amountDue, 0);

    // eslint-disable-next-line no-alert
    if (
      !window.confirm(
        t`Commit this payment run? This deducts ${selectedCount} bill(s) totalling about ${total.toFixed(0)} from the chosen bank balances and marks the bills paid. This cannot be undone from the app.`,
      )
    ) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      // Persist current selection, then execute it.
      await handleSavePlanSilent();
      const res = await xeroFetch<{ billsPaid: number; totalPaid: number }>(
        '/finance/cashflow/plan/commit',
        tokenPair,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fridayDate: friday }),
        },
      );

      await load();
      setSavedAt(new Date().toISOString());
      setError(null);
      window.alert(
        t`Payment run committed: ${res.billsPaid} bill(s) paid, balances updated.`,
      );
    } catch (err) {
      setError(err instanceof Error ? `Commit failed: ${err.message}` : 'Commit failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePlanSilent = async () => {
    if (!tokenPair || !data) return;
    const lines = data.duePayables
      .filter((row) => selection[row.xeroInvoiceId])
      .map((row) => ({
        tenantId: row.tenantId,
        xeroInvoiceId: row.xeroInvoiceId,
        bankAccountId: bankByInvoice[row.xeroInvoiceId] || undefined,
        amount: row.amountDue,
        currencyCode: row.currencyCode,
        included: true,
      }));

    await xeroFetch('/finance/cashflow/plan', tokenPair, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fridayDate: friday, lines }),
    });
  };

  const handleExportCSV = () => {
    if (!data) return;
    const selectedRows = data.duePayables.filter((row) => selection[row.xeroInvoiceId]);
    exportCSV(selectedRows, banks, bankByInvoice, friday);
  };

  const selectedCount = Object.values(selection).filter(Boolean).length;
  const anyNegative = Object.values(tallies).some((t) => t.postFriday < 0);

  // Currencies with bills/receipts due but no bank balance to pay from.
  const bankCurrencies = new Set(
    (data?.cashByCurrency ?? []).map((c) => c.currencyCode),
  );
  const dueCurrencies = new Set<string>([
    ...(data?.duePayables ?? []).map((r) => r.currencyCode),
    ...(data?.expectedReceipts ?? []).map((r) => r.currencyCode),
  ]);
  const missingBankCurrencies = [...dueCurrencies].filter(
    (ccy) => !bankCurrencies.has(ccy),
  );

  /* ─────────────────── Render ─────────────────── */

  return (
    <>
      <PageTitle title={t`Weekly Planner`} />
      <StyledContainer>
        <StyledHeader>
          <StyledHeadings>
            <StyledTitle>
              <Trans>Weekly Payment Planner</Trans>
            </StyledTitle>
            <StyledSubtitle>
              <Trans>
                Review cash on hand, expected receipts, and choose which bills to
                pay this Friday. Save your plan then export a payment run CSV for your bank.
              </Trans>
            </StyledSubtitle>
          </StyledHeadings>
          <StyledActions>
            {lastSyncedAt && (
              <StyledSyncBadge>
                Synced {new Date(lastSyncedAt).toLocaleDateString()}
              </StyledSyncBadge>
            )}
            <StyledSecondaryButton onClick={handleSync} disabled={isSyncing}>
              {isSyncing ? '⏳ Syncing…' : '↻ Sync Xero'}
            </StyledSecondaryButton>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--t-font-color-secondary)' }}>
              <Trans>Pay date</Trans>
              <StyledInput
                type="date"
                value={friday}
                onChange={(e) => setFriday(e.target.value)}
              />
            </label>
          </StyledActions>
        </StyledHeader>

        <StyledSteps>
          <StyledStep>
            <StyledStepNum>1</StyledStepNum>
            <div>
              <strong style={{ fontSize: 13, color: 'var(--t-font-color-primary)' }}>
                <Trans>Confirm cash on hand</Trans>
              </strong>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--t-font-color-tertiary)' }}>
                <Trans>
                  Check bank balances per currency below. Update on the Bank
                  Accounts page if stale.
                </Trans>
              </p>
            </div>
          </StyledStep>
          <StyledStep>
            <StyledStepNum>2</StyledStepNum>
            <div>
              <strong style={{ fontSize: 13, color: 'var(--t-font-color-primary)' }}>
                <Trans>Review expected receipts</Trans>
              </strong>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--t-font-color-tertiary)' }}>
                <Trans>
                  Customer invoices due on or before your pay date. Realistic
                  estimate of money in.
                </Trans>
              </p>
            </div>
          </StyledStep>
          <StyledStep>
            <StyledStepNum>3</StyledStepNum>
            <div>
              <strong style={{ fontSize: 13, color: 'var(--t-font-color-primary)' }}>
                <Trans>Pick payables, save & export</Trans>
              </strong>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--t-font-color-tertiary)' }}>
                <Trans>
                  Tick bills you'll pay. Watch position stay positive. Save, then
                  export a CSV for your bank.
                </Trans>
              </p>
            </div>
          </StyledStep>
        </StyledSteps>

        {error && (
          <StyledCard style={{ padding: '12px 16px', color: 'var(--t-font-color-danger)', fontSize: 13 }}>
            ⚠ {error}
          </StyledCard>
        )}
        {savedAt && (
          <StyledAlertSuccess>
            <span style={{ fontSize: 16 }}>✓</span>
            <Trans>Plan saved — {new Date(savedAt).toLocaleString()}</Trans>
          </StyledAlertSuccess>
        )}
        {missingBankCurrencies.length > 0 && (
          <StyledCard
            style={{
              padding: '14px 18px',
              background: 'var(--t-background-transparent-warning, rgba(234,179,8,0.10))',
              borderColor: 'rgba(234,179,8,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div style={{ fontSize: 13, color: '#854d0e' }}>
              <strong>
                <Trans>No bank account for {missingBankCurrencies.join(', ')}</Trans>
              </strong>
              <div style={{ marginTop: 2 }}>
                <Trans>
                  Your invoices are in {missingBankCurrencies.join(', ')} but you have
                  no matching bank balance, so "Starting Balance" shows zero. Add a
                  bank account in that currency to see your true position after Friday.
                </Trans>
              </div>
            </div>
            <StyledSecondaryButton
              onClick={() => (window.location.href = '/finance/banks')}
            >
              <Trans>Add bank →</Trans>
            </StyledSecondaryButton>
          </StyledCard>
        )}

        <StyledSection>
          <StyledSectionHeader>
            <StyledSectionTitle>
              <Trans>Position after Friday — per currency</Trans>
            </StyledSectionTitle>
          </StyledSectionHeader>
          <StyledSectionDescription>
            <Trans>
              Cash you have + money coming in − bills you've ticked = balance
              left. Red border means you'd go negative.
            </Trans>
          </StyledSectionDescription>
          <StyledSummary>
            {Object.entries(tallies).map(([currency, tt]) => (
              <StyledSummaryCard
                key={currency}
                style={
                  tt.postFriday < 0
                    ? { borderLeftColor: 'var(--t-font-color-danger)' }
                    : undefined
                }
              >
                <StyledSummaryLabel>{currency}</StyledSummaryLabel>
                <StyledMathRow>
                  <span>{fmt(tt.cash, currency)}</span>
                  <span style={{ color: 'var(--t-font-color-tertiary)' }}>Starting Balance</span>
                </StyledMathRow>
                <StyledMathRow>
                  <span style={{ color: 'var(--t-color-green)' }}>+ {fmt(tt.expectedIn, currency)}</span>
                  <span style={{ color: 'var(--t-font-color-tertiary)' }}>Expected Inflows</span>
                </StyledMathRow>
                <StyledMathRow>
                  <span style={{ color: 'var(--t-font-color-danger)' }}>− {fmt(tt.selectedOut, currency)}</span>
                  <span style={{ color: 'var(--t-font-color-tertiary)' }}>Planned Outflows</span>
                </StyledMathRow>
                <div
                  style={{
                    borderTop: '1px solid var(--t-border-color-light)',
                    marginTop: 4,
                    paddingTop: 6,
                    fontSize: 18,
                    fontWeight: 600,
                    color: tt.postFriday < 0 ? 'var(--t-font-color-danger)' : 'var(--t-font-color-primary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-font-color-tertiary)', display: 'block', marginBottom: 2 }}>Ending Balance</span>
                  {fmt(tt.postFriday, currency)}
                </div>
              </StyledSummaryCard>
            ))}
            {Object.keys(tallies).length === 0 && (
              <StyledCard style={{ gridColumn: '1 / -1' }}>
                <StyledEmpty>
                  <Trans>
                    No cash, receipts, or payables loaded. Sync Xero and add
                    bank balances first.
                  </Trans>
                </StyledEmpty>
              </StyledCard>
            )}
          </StyledSummary>
        </StyledSection>

        <StyledSection>
          <StyledSectionHeader>
            <StyledSectionTitle>
              <Trans>Money coming in by Friday</Trans>
            </StyledSectionTitle>
            <StyledSyncBadge>
              {(data?.expectedReceipts ?? []).length} invoice(s)
            </StyledSyncBadge>
          </StyledSectionHeader>
          <StyledSectionDescription>
            <Trans>
              Customer invoices (A/R) with a due date on or before {friday}.
              Only what customers are supposed to have paid you.
            </Trans>
          </StyledSectionDescription>
          <StyledCard>
            <StyledTable>
              <thead>
                <tr>
                  <th><Trans>Due</Trans></th>
                  <th><Trans>Invoice</Trans></th>
                  <th><Trans>Customer</Trans></th>
                  <th>CCY</th>
                  <th className="num"><Trans>Amount</Trans></th>
                </tr>
              </thead>
              <tbody>
                {(data?.expectedReceipts ?? []).map((row) => (
                  <tr key={row.xeroInvoiceId}>
                    <td>{row.dueDate ?? '—'}</td>
                    <td>{row.invoiceNumber ?? '—'}</td>
                    <td>{row.contactName ?? '—'}</td>
                    <td>{row.currencyCode}</td>
                    <td className="num">{fmt(row.amountDue, row.currencyCode)}</td>
                  </tr>
                ))}
                {(data?.expectedReceipts ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <StyledEmpty>
                        <Trans>
                          No customer invoices due by {friday}. Either everyone
                          paid on time, or invoices land later.
                        </Trans>
                      </StyledEmpty>
                    </td>
                  </tr>
                )}
              </tbody>
            </StyledTable>
          </StyledCard>
        </StyledSection>

        {(() => {
          const plannedPayables = (data?.duePayables ?? []).filter(row => selection[row.xeroInvoiceId]);
          const otherPayables = (data?.duePayables ?? []).filter(row => !selection[row.xeroInvoiceId]);

          const renderTable = (payables: Invoice[], emptyMessage: React.ReactNode) => (
            <StyledCard>
              <StyledTable>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}><Trans>Pay?</Trans></th>
                    <th style={{ width: 90 }}><Trans>Priority</Trans></th>
                    <th style={{ width: 50 }}><Trans>Lock</Trans></th>
                    <th><Trans>Due</Trans></th>
                    <th><Trans>Bill #</Trans></th>
                    <th><Trans>Supplier</Trans></th>
                    <th>CCY</th>
                    <th className="num"><Trans>Amount</Trans></th>
                    <th><Trans>Pay from</Trans></th>
                  </tr>
                </thead>
                <tbody>
                  {payables.map((row) => {
                    const isMustPay = mustPay[row.xeroInvoiceId] ?? false;
                    return (
                      <tr key={row.xeroInvoiceId} className={isMustPay ? 'mustPay' : row.overdue ? 'overdue' : ''}>
                        <td>
                          <input type="checkbox" checked={selection[row.xeroInvoiceId] ?? false} onChange={(e) => setSelection((prev) => ({ ...prev, [row.xeroInvoiceId]: e.target.checked }))} />
                        </td>
                        <td>
                          <StyledSelect value={priority[row.xeroInvoiceId] ?? 3} onChange={(e) => { const value = Number(e.target.value); setPriority((prev) => ({ ...prev, [row.xeroInvoiceId]: value })); }} onBlur={() => savePriority(row.tenantId, row.xeroInvoiceId)}>
                            <option value={1}>1 · Highest</option>
                            <option value={2}>2 · High</option>
                            <option value={3}>3 · Normal</option>
                            <option value={4}>4 · Low</option>
                            <option value={5}>5 · Lowest</option>
                          </StyledSelect>
                        </td>
                        <td>
                          <input type="checkbox" title={t`Must-pay`} checked={isMustPay} onChange={(e) => { const checked = e.target.checked; setMustPay((prev) => ({ ...prev, [row.xeroInvoiceId]: checked })); if (checked) { setSelection((prev) => ({ ...prev, [row.xeroInvoiceId]: true })); } }} onBlur={() => savePriority(row.tenantId, row.xeroInvoiceId)} />
                        </td>
                        <td>
                          {row.dueDate ?? '—'}
                          {row.overdue && <> <StyledPill style={PILL_STYLES.red}><Trans>overdue</Trans></StyledPill></>}
                          {isMustPay && <> <StyledPill style={PILL_STYLES.blue}><Trans>locked</Trans></StyledPill></>}
                        </td>
                        <td>{row.invoiceNumber ?? '—'}</td>
                        <td>{row.contactName ?? '—'}</td>
                        <td>{row.currencyCode}</td>
                        <td className="num">{fmt(row.amountDue, row.currencyCode)}</td>
                        <td>
                          <StyledSelect value={bankByInvoice[row.xeroInvoiceId] ?? ''} onChange={(e) => setBankByInvoice((prev) => ({ ...prev, [row.xeroInvoiceId]: e.target.value }))}>
                            <option value="">— pick bank —</option>
                            {banks.map((b) => (
                              <option key={b.id} value={b.id}>{b.bankName}{b.accountLabel ? ` · ${b.accountLabel}` : ''} ({b.currencyCode})</option>
                            ))}
                          </StyledSelect>
                        </td>
                      </tr>
                    );
                  })}
                  {payables.length === 0 && (
                    <tr>
                      <td colSpan={9}>
                        <StyledEmpty>{emptyMessage}</StyledEmpty>
                      </td>
                    </tr>
                  )}
                </tbody>
              </StyledTable>
            </StyledCard>
          );

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <StyledSection>
                <StyledSectionHeader>
                  <StyledSectionTitle>
                    <Trans>Planned Payments</Trans>
                  </StyledSectionTitle>
                  <StyledSyncBadge>
                    {plannedPayables.length} bill(s)
                  </StyledSyncBadge>
                </StyledSectionHeader>
                <StyledSectionDescription>
                  <Trans>
                    Bills you have selected to pay this Friday. Review your selection before saving.
                  </Trans>
                </StyledSectionDescription>
                {renderTable(plannedPayables, <Trans>No bills selected for payment yet. Pick some from the list below.</Trans>)}
              </StyledSection>

              <StyledSection>
                <StyledSectionHeader>
                  <StyledSectionTitle>
                    <Trans>Other Due Bills</Trans>
                  </StyledSectionTitle>
                  <StyledSyncBadge>
                    {otherPayables.length} bill(s)
                  </StyledSyncBadge>
                </StyledSectionHeader>
                <StyledSectionDescription>
                  <Trans>
                    Bills due but not included in your Friday payment run.
                  </Trans>
                </StyledSectionDescription>
                {renderTable(otherPayables, <Trans>No other bills due by {friday}.</Trans>)}
              </StyledSection>
            </div>
          );
        })()}

        <StyledStickyBar>
          <div style={{ fontSize: 13, color: 'var(--t-font-color-secondary)' }}>
            {selectedCount === 0 ? (
              <Trans>Tick the bills you plan to pay, then save.</Trans>
            ) : (
              <>
                <strong>{selectedCount}</strong>{' '}
                <Trans>bill(s) selected for {friday}.</Trans>
              </>
            )}
            {anyNegative && (
              <span style={{ color: 'var(--t-font-color-danger)', marginLeft: 12, fontWeight: 500 }}>
                ⚠ <Trans>One or more currencies go negative — review selection.</Trans>
              </span>
            )}
          </div>
          <StyledActions>
            <StyledSecondaryButton onClick={handleExportCSV} disabled={selectedCount === 0}>
              ↓ <Trans>Export CSV</Trans>
            </StyledSecondaryButton>
            <StyledSecondaryButton
              onClick={handleSavePlan}
              disabled={isSaving || !data}
              title={selectedCount === 0 ? t`Saving with nothing ticked clears this week's plan` : ''}
            >
              {isSaving ? (
                <Trans>Saving…</Trans>
              ) : selectedCount === 0 ? (
                <Trans>Save (empty)</Trans>
              ) : (
                <Trans>Save draft</Trans>
              )}
            </StyledSecondaryButton>
            <StyledPrimaryButton
              onClick={handleCommitPlan}
              disabled={isSaving || selectedCount === 0}
              title={t`Deducts selected bills from bank balances and marks them paid`}
            >
              <Trans>Commit payment run</Trans>
            </StyledPrimaryButton>
          </StyledActions>
        </StyledStickyBar>
      </StyledContainer>
    </>
  );
};
