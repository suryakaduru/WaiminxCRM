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
import { type AuthTokenPair } from '~/generated-metadata/graphql';

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

type Adjustment = {
  id: string;
  fridayDate: string;
  direction: 'in' | 'out';
  label: string;
  currencyCode: string;
  amount: number;
  bankAccountId: string | null;
  note: string | null;
};

type MandatoryPayment = {
  id: string;
  type: string;
  label: string;
  currencyCode: string;
  amount: number;
  dueDate: string;
  bankAccountId: string | null;
};

type PlannerResponse = {
  fridayDate: string;
  cashByCurrency: CashRow[];
  expectedReceipts: Invoice[];
  duePayables: Invoice[];
  adjustments: Adjustment[];
  mandatoryPayments: MandatoryPayment[];
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

type BankRole = 'main' | 'international' | 'expense' | 'other';

type BankAccount = {
  id: string;
  bankName: string;
  currencyCode: string;
  accountLabel: string | null;
  balance: string;
  bankRole: BankRole;
};

type SuggestedTransfer = {
  fromBankId: string | null;
  toBankId: string;
  currencyCode: string;
  amount: number;
};

/* ─────────────────── Styled Components (CRM Theme) ─────────────────── */

const StyledContainer = styled.div`
  background: ${themeCssVariables.background.secondary};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[6]};
  height: 100%;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[6]} ${themeCssVariables.spacing[8]};
  width: 100%;

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
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

const StyledStepper = styled.ol`
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

const StyledStepTab = styled.li<{ active: boolean; done: boolean }>`
  align-items: center;
  cursor: pointer;
  display: flex;
  gap: 10px;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
  position: relative;
  background: ${(p) =>
    p.active ? themeCssVariables.background.transparent.blue : 'transparent'};
  transition: background 0.15s;
  &:hover {
    background: ${themeCssVariables.background.transparent.lighter};
  }
  &:not(:last-child)::after {
    content: '';
    position: absolute;
    right: 0;
    top: 12px;
    bottom: 12px;
    width: 1px;
    background: ${themeCssVariables.border.color.light};
  }
`;

const StyledStepBadge = styled.div<{ active: boolean; done: boolean }>`
  align-items: center;
  border-radius: 50%;
  color: ${themeCssVariables.font.color.inverted};
  display: flex;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  height: 24px;
  justify-content: center;
  width: 24px;
  background: ${(p) =>
    p.active || p.done
      ? themeCssVariables.accent.primary
      : themeCssVariables.font.color.light};
`;

const StyledPositionStrip = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
  position: sticky;
  top: 0;
  z-index: 5;
`;

const StyledPositionChip = styled.div<{ negative: boolean }>`
  align-items: baseline;
  display: flex;
  gap: 6px;
  border-left: 3px solid
    ${(p) =>
      p.negative
        ? themeCssVariables.font.color.danger
        : themeCssVariables.accent.primary};
  padding-left: 10px;
`;

const StyledWizardFooter = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  bottom: 16px;
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
  justify-content: space-between;
  margin-top: ${themeCssVariables.spacing[4]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[5]};
  position: sticky;
  z-index: 10;
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

// Table card that caps its height and scrolls internally, so a long list of
// invoices doesn't push the page into an endless scroll. Header stays pinned.
const StyledScrollCard = styled(StyledCard)`
  max-height: 380px;
  overflow-y: auto;
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

  & thead th {
    background: ${themeCssVariables.background.secondary};
    position: sticky;
    top: 0;
    z-index: 2;
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

const MANDATORY_TYPE_LABELS: Record<string, string> = {
  payroll: 'Payroll',
  gst: 'GST',
  rent: 'Rent',
  loan: 'Loan',
  credit_card: 'Credit Card',
  trust_account: 'Trust Account',
  inland_revenue: 'Inland Revenue',
  bank_recon: 'Bank Recon',
  custom: 'Custom',
};

// Route each outflow to a bank: international transfers (non-NZD) prefer
// Wise/Statrys, domestic expenses (NZD) prefer UOB/BNZ. BNZ (main) is the
// fallback and the source for top-up transfers when a bank is short.
const classifyOutflow = (currencyCode: string): 'international' | 'expense' =>
  currencyCode === 'NZD' ? 'expense' : 'international';

const ROLE_RANK: Record<'international' | 'expense', Record<BankRole, number>> = {
  international: { international: 0, main: 1, expense: 2, other: 3 },
  expense: { expense: 0, main: 1, international: 2, other: 3 },
};

const suggestBankFor = (
  currencyCode: string,
  amount: number,
  banks: BankAccount[],
): string | null => {
  const kind = classifyOutflow(currencyCode);
  const candidates = banks
    .filter((b) => b.currencyCode === currencyCode)
    .sort((a, b) => {
      const ra = ROLE_RANK[kind][a.bankRole] ?? 9;
      const rb = ROLE_RANK[kind][b.bankRole] ?? 9;

      if (ra !== rb) return ra - rb;

      return Number(b.balance) - Number(a.balance);
    });

  if (candidates.length === 0) return null;

  const funded = candidates.find((b) => Number(b.balance) >= amount);

  return (funded ?? candidates[0]).id;
};

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

// Estimate-only cross-currency helper. When a bill has no bank in its own
// currency, show what it costs in a bank currency the user actually holds,
// using the live Wise mid-market rate (server-cached 60s). Does NOT let the
// bill be committed — that still requires a same-currency bank.
type FxState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; rate: number; provider: string };

const FxEstimate = ({
  tokenPair,
  amount,
  from,
  to,
}: {
  tokenPair: AuthTokenPair | null;
  amount: number;
  from: string;
  to: string;
}) => {
  const [state, setState] = useState<FxState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;

    setState({ status: 'loading' });
    xeroFetch<{ rate: number; provider: string; asOf: string }>(
      `/finance/fx/rate?source=${from}&target=${to}`,
      tokenPair,
    )
      .then((r) => {
        if (alive) {
          setState({ status: 'ok', rate: r.rate, provider: r.provider });
        }
      })
      .catch(() => {
        if (alive) setState({ status: 'error' });
      });

    return () => {
      alive = false;
    };
  }, [tokenPair, from, to]);

  if (state.status === 'loading') {
    return (
      <span style={{ fontSize: 12, color: 'var(--t-font-color-tertiary)' }}>
        converting…
      </span>
    );
  }

  if (state.status === 'error') {
    return (
      <span style={{ fontSize: 12, color: 'var(--t-font-color-danger)' }}>
        <Trans>No {from} bank — add one</Trans>
      </span>
    );
  }

  return (
    <span
      style={{ fontSize: 12, color: 'var(--t-font-color-secondary)' }}
      title={`Estimate only — paying a ${from} bill needs a ${from} bank.`}
    >
      ≈ {fmt(amount * state.rate, to)}{' '}
      <span style={{ color: 'var(--t-font-color-tertiary)' }}>
        @ {state.rate.toFixed(4)} · {state.provider}
      </span>
    </span>
  );
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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [billCcyFilter, setBillCcyFilter] = useState<string>('');
  const [billSearch, setBillSearch] = useState<string>('');
  const [newAdj, setNewAdj] = useState<{
    direction: 'in' | 'out';
    label: string;
    amount: string;
    currencyCode: string;
    bankAccountId: string;
    note: string;
  }>({ direction: 'out', label: '', amount: '', currencyCode: 'NZD', bankAccountId: '', note: '' });
  const [isAddingAdj, setIsAddingAdj] = useState(false);

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
      {
        cash: number;
        expectedIn: number;
        adjustIn: number;
        adjustOut: number;
        mandatoryOut: number;
        selectedOut: number;
        postFriday: number;
      }
    > = {};

    const empty = () => ({
      cash: 0,
      expectedIn: 0,
      adjustIn: 0,
      adjustOut: 0,
      mandatoryOut: 0,
      selectedOut: 0,
      postFriday: 0,
    });

    for (const [currency, tot] of Object.entries(data.totalsByCurrency)) {
      result[currency] = {
        ...empty(),
        cash: tot.cash,
        expectedIn: tot.expectedIn,
        adjustIn: tot.adjustIn,
        adjustOut: tot.adjustOut,
        postFriday: tot.cash + tot.expectedIn + tot.adjustIn - tot.adjustOut,
      };
    }
    for (const row of data.mandatoryPayments) {
      const tt = (result[row.currencyCode] ??= empty());

      tt.mandatoryOut += row.amount;
      tt.postFriday -= row.amount;
    }
    for (const row of data.duePayables) {
      if (selection[row.xeroInvoiceId]) {
        const tt = (result[row.currencyCode] ??= empty());

        tt.selectedOut += row.amountDue;
        tt.postFriday -= row.amountDue;
      }
    }

    return result;
  }, [data, selection]);

  const routing = useMemo(() => {
    const empty = { assignments: {} as Record<string, string | null>, transfers: [] as SuggestedTransfer[] };

    if (!data) return empty;

    const banksById = new Map(banks.map((b) => [b.id, b]));

    const outflows: Array<{
      key: string;
      currencyCode: string;
      amount: number;
      assignedBank: string | null;
    }> = [];

    for (const row of data.duePayables) {
      if (selection[row.xeroInvoiceId]) {
        outflows.push({
          key: row.xeroInvoiceId,
          currencyCode: row.currencyCode,
          amount: row.amountDue,
          assignedBank: bankByInvoice[row.xeroInvoiceId] || null,
        });
      }
    }
    for (const mp of data.mandatoryPayments) {
      outflows.push({
        key: `mp:${mp.id}`,
        currencyCode: mp.currencyCode,
        amount: mp.amount,
        assignedBank: mp.bankAccountId,
      });
    }

    const assignments: Record<string, string | null> = {};
    const demand = new Map<string, { currencyCode: string; amount: number }>();

    for (const o of outflows) {
      const bankId = o.assignedBank ?? suggestBankFor(o.currencyCode, o.amount, banks);

      assignments[o.key] = bankId;

      if (bankId) {
        const d = demand.get(bankId) ?? { currencyCode: o.currencyCode, amount: 0 };

        d.amount += o.amount;
        demand.set(bankId, d);
      }
    }

    const transfers: SuggestedTransfer[] = [];

    for (const [bankId, d] of demand) {
      const bank = banksById.get(bankId);

      if (!bank || bank.bankRole === 'main') continue;

      const shortfall = d.amount - Number(bank.balance);

      if (shortfall > 0.005) {
        const mainBank =
          banks.find((b) => b.bankRole === 'main' && b.currencyCode === d.currencyCode) ??
          banks.find((b) => b.bankRole === 'main');

        transfers.push({
          fromBankId: mainBank?.id ?? null,
          toBankId: bankId,
          currencyCode: d.currencyCode,
          amount: shortfall,
        });
      }
    }

    return { assignments, transfers };
  }, [data, banks, selection, bankByInvoice]);

  const handleAutoAssignBanks = () => {
    if (!data) return;
    setBankByInvoice((prev) => {
      const next = { ...prev };

      for (const row of data.duePayables) {
        if (selection[row.xeroInvoiceId] && !next[row.xeroInvoiceId]) {
          const suggested = routing.assignments[row.xeroInvoiceId];

          if (suggested) next[row.xeroInvoiceId] = suggested;
        }
      }

      return next;
    });
  };

  // Projected balance per bank: current balance minus everything assigned to
  // that specific bank (ticked bills, mandatory payments, manual out) plus
  // manual money-in. Lets the manual "Pay from" choice visibly move a bank.
  const bankProjection = useMemo(() => {
    if (!data) return [] as Array<{ bank: BankAccount; start: number; projected: number }>;

    const map = new Map(
      banks.map((b) => [
        b.id,
        { bank: b, start: Number(b.balance), projected: Number(b.balance) },
      ]),
    );

    for (const row of data.duePayables) {
      if (selection[row.xeroInvoiceId]) {
        const entry = map.get(bankByInvoice[row.xeroInvoiceId] ?? '');

        if (entry) entry.projected -= row.amountDue;
      }
    }
    for (const mp of data.mandatoryPayments) {
      const entry = map.get(mp.bankAccountId ?? '');

      if (entry) entry.projected -= mp.amount;
    }
    for (const adj of data.adjustments) {
      const entry = map.get(adj.bankAccountId ?? '');

      if (entry) entry.projected += adj.direction === 'in' ? adj.amount : -adj.amount;
    }

    return [...map.values()].sort(
      (a, b) =>
        a.bank.currencyCode.localeCompare(b.bank.currencyCode) ||
        a.bank.bankName.localeCompare(b.bank.bankName),
    );
  }, [data, banks, selection, bankByInvoice]);

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
        `Assign a "Pay from" bank to every selected bill before committing (${unassigned.length} missing).`,
      );

      return;
    }

    const total = data.duePayables
      .filter((row) => selection[row.xeroInvoiceId])
      .reduce((sum, row) => sum + row.amountDue, 0);

    // eslint-disable-next-line no-alert
    if (
      !window.confirm(
        `Commit this payment run? This deducts ${selectedCount} bill(s) totalling about ${total.toFixed(0)} from the chosen bank balances and marks the bills paid. This cannot be undone from the app.`,
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
        `Payment run committed: ${res.billsPaid} bill(s) paid, balances updated.`,
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

  const handleAddAdjustment = async () => {
    if (!tokenPair) return;
    const amount = Number(newAdj.amount);

    if (!newAdj.label.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError(t`Enter a label and a positive amount for the adjustment.`);

      return;
    }
    setIsAddingAdj(true);
    setError(null);
    try {
      await xeroFetch('/finance/adjustments', tokenPair, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fridayDate: friday,
          direction: newAdj.direction,
          label: newAdj.label.trim(),
          currencyCode: newAdj.currencyCode || 'NZD',
          amount,
          bankAccountId: newAdj.bankAccountId || undefined,
          note: newAdj.note.trim() || undefined,
        }),
      });
      setNewAdj((prev) => ({ ...prev, label: '', amount: '', note: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add adjustment failed');
    } finally {
      setIsAddingAdj(false);
    }
  };

  const handleDeleteAdjustment = async (id: string) => {
    if (!tokenPair) return;
    try {
      await xeroFetch(`/finance/adjustments/${id}`, tokenPair, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete adjustment failed');
    }
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

        <StyledStepper>
          {([
            [1, t`Review money`, t`Cash, incoming & adjustments`],
            [2, t`Pick bills`, t`Tick what to pay this Friday`],
            [3, t`Banks & commit`, t`Assign banks, top up, commit`],
          ] as Array<[1 | 2 | 3, string, string]>).map(([n, title, sub]) => (
            <StyledStepTab
              key={n}
              active={step === n}
              done={step > n}
              onClick={() => setStep(n)}
            >
              <StyledStepBadge active={step === n} done={step > n}>
                {step > n ? '✓' : n}
              </StyledStepBadge>
              <div>
                <strong style={{ fontSize: 13, color: 'var(--t-font-color-primary)' }}>{title}</strong>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--t-font-color-tertiary)' }}>{sub}</p>
              </div>
            </StyledStepTab>
          ))}
        </StyledStepper>

        {step > 1 && Object.keys(tallies).length > 0 && (
          <StyledPositionStrip>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--t-font-color-tertiary)' }}>
              <Trans>Ending balance</Trans>
            </span>
            {Object.entries(tallies).map(([currency, tt]) => (
              <StyledPositionChip key={currency} negative={tt.postFriday < 0}>
                <span style={{ fontSize: 11, color: 'var(--t-font-color-tertiary)' }}>{currency}</span>
                <span style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: tt.postFriday < 0 ? 'var(--t-font-color-danger)' : 'var(--t-font-color-primary)' }}>
                  {fmt(tt.postFriday, currency)}
                </span>
              </StyledPositionChip>
            ))}
            {anyNegative && (
              <span style={{ fontSize: 12, color: 'var(--t-font-color-danger)', fontWeight: 500 }}>
                ⚠ <Trans>a currency goes negative</Trans>
              </span>
            )}
          </StyledPositionStrip>
        )}

        {step > 1 && bankProjection.length > 0 && (
          <StyledSection>
            <StyledSectionHeader>
              <StyledSectionTitle>
                <Trans>Projected balance per bank</Trans>
              </StyledSectionTitle>
            </StyledSectionHeader>
            <StyledSectionDescription>
              <Trans>
                Each bank's balance after the bills, mandatory payments and
                adjustments you assigned to it. Change a bill's "Pay from" bank
                and that bank's projection moves.
              </Trans>
            </StyledSectionDescription>
            <StyledSummary>
              {bankProjection.map(({ bank, start, projected }) => {
                const negative = projected < 0;
                const changed = Math.abs(projected - start) > 0.005;
                return (
                  <StyledSummaryCard
                    key={bank.id}
                    style={negative ? { borderLeftColor: 'var(--t-font-color-danger)' } : undefined}
                  >
                    <StyledSummaryLabel>
                      {bank.bankName}{bank.accountLabel ? ` · ${bank.accountLabel}` : ''} · {bank.currencyCode}
                    </StyledSummaryLabel>
                    <div style={{ fontSize: 13, color: 'var(--t-font-color-tertiary)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                      {fmt(start, bank.currencyCode)}
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                        marginTop: 2,
                        color: negative
                          ? 'var(--t-font-color-danger)'
                          : changed
                            ? 'var(--t-accent-primary)'
                            : 'var(--t-font-color-primary)',
                      }}
                    >
                      → {fmt(projected, bank.currencyCode)}
                    </div>
                  </StyledSummaryCard>
                );
              })}
            </StyledSummary>
          </StyledSection>
        )}

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

        {step === 1 && (
        <>
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
                {tt.mandatoryOut > 0 && (
                  <StyledMathRow>
                    <span style={{ color: 'var(--t-font-color-danger)' }}>− {fmt(tt.mandatoryOut, currency)}</span>
                    <span style={{ color: 'var(--t-font-color-tertiary)' }}>Mandatory</span>
                  </StyledMathRow>
                )}
                {tt.adjustIn > 0 && (
                  <StyledMathRow>
                    <span style={{ color: 'var(--t-color-green)' }}>+ {fmt(tt.adjustIn, currency)}</span>
                    <span style={{ color: 'var(--t-font-color-tertiary)' }}>Manual In</span>
                  </StyledMathRow>
                )}
                {tt.adjustOut > 0 && (
                  <StyledMathRow>
                    <span style={{ color: 'var(--t-font-color-danger)' }}>− {fmt(tt.adjustOut, currency)}</span>
                    <span style={{ color: 'var(--t-font-color-tertiary)' }}>Manual Out</span>
                  </StyledMathRow>
                )}
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
          <StyledScrollCard>
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
          </StyledScrollCard>
        </StyledSection>

        <StyledSection>
          <StyledSectionHeader>
            <StyledSectionTitle>
              <Trans>Mandatory payments</Trans>
            </StyledSectionTitle>
            <StyledSyncBadge>
              {(data?.mandatoryPayments ?? []).length} due
            </StyledSyncBadge>
          </StyledSectionHeader>
          <StyledSectionDescription>
            <Trans>
              Recurring obligations due on or before {friday} — payroll, GST,
              loan, rent, credit card, Trust Account, Inland Revenue. Always
              counted as outflow in the position above. Manage amounts and
              schedules in Reminders settings.
            </Trans>
          </StyledSectionDescription>
          <StyledCard>
            <StyledTable>
              <thead>
                <tr>
                  <th><Trans>Due</Trans></th>
                  <th><Trans>Type</Trans></th>
                  <th><Trans>Label</Trans></th>
                  <th>CCY</th>
                  <th className="num"><Trans>Amount</Trans></th>
                  <th><Trans>Pay from</Trans></th>
                </tr>
              </thead>
              <tbody>
                {(data?.mandatoryPayments ?? []).map((row) => {
                  const bank = banks.find((b) => b.id === row.bankAccountId);
                  return (
                    <tr key={row.id} className="mustPay">
                      <td>{row.dueDate}</td>
                      <td>
                        <StyledPill style={PILL_STYLES.blue}>{MANDATORY_TYPE_LABELS[row.type] ?? row.type}</StyledPill>
                      </td>
                      <td>{row.label}</td>
                      <td>{row.currencyCode}</td>
                      <td className="num" style={{ color: 'var(--t-font-color-danger)' }}>− {fmt(row.amount, row.currencyCode)}</td>
                      <td>{bank ? bank.bankName : '—'}</td>
                    </tr>
                  );
                })}
                {(data?.mandatoryPayments ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <StyledEmpty>
                        <Trans>No mandatory payments due by {friday}. Add them in Reminders settings.</Trans>
                      </StyledEmpty>
                    </td>
                  </tr>
                )}
              </tbody>
            </StyledTable>
          </StyledCard>
        </StyledSection>

        <StyledSection>
          <StyledSectionHeader>
            <StyledSectionTitle>
              <Trans>Manual adjustments</Trans>
            </StyledSectionTitle>
            <StyledSyncBadge>
              {(data?.adjustments ?? []).length} item(s)
            </StyledSyncBadge>
          </StyledSectionHeader>
          <StyledSectionDescription>
            <Trans>
              Add unexpected cash movements Xero doesn't know about yet — an
              urgent supplier invoice, emergency transfer, or a customer paying
              early/late. These flow straight into the position above for {friday}.
            </Trans>
          </StyledSectionDescription>
          <StyledCard>
            <StyledTable>
              <thead>
                <tr>
                  <th style={{ width: 90 }}><Trans>Direction</Trans></th>
                  <th><Trans>Label</Trans></th>
                  <th>CCY</th>
                  <th className="num"><Trans>Amount</Trans></th>
                  <th><Trans>Bank</Trans></th>
                  <th><Trans>Note</Trans></th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {(data?.adjustments ?? []).map((adj) => {
                  const bank = banks.find((b) => b.id === adj.bankAccountId);
                  return (
                    <tr key={adj.id}>
                      <td>
                        <StyledPill style={adj.direction === 'in' ? PILL_STYLES.blue : PILL_STYLES.red}>
                          {adj.direction === 'in' ? <Trans>money in</Trans> : <Trans>money out</Trans>}
                        </StyledPill>
                      </td>
                      <td>{adj.label}</td>
                      <td>{adj.currencyCode}</td>
                      <td className="num" style={{ color: adj.direction === 'in' ? 'var(--t-color-green)' : 'var(--t-font-color-danger)' }}>
                        {adj.direction === 'in' ? '+' : '−'} {fmt(adj.amount, adj.currencyCode)}
                      </td>
                      <td>{bank ? bank.bankName : '—'}</td>
                      <td style={{ color: 'var(--t-font-color-tertiary)' }}>{adj.note ?? '—'}</td>
                      <td>
                        <StyledSecondaryButton
                          onClick={() => handleDeleteAdjustment(adj.id)}
                          title={t`Remove adjustment`}
                          style={{ padding: '2px 8px' }}
                        >
                          ✕
                        </StyledSecondaryButton>
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td>
                    <StyledSelect
                      value={newAdj.direction}
                      onChange={(e) => setNewAdj((prev) => ({ ...prev, direction: e.target.value as 'in' | 'out' }))}
                    >
                      <option value="out">Money out</option>
                      <option value="in">Money in</option>
                    </StyledSelect>
                  </td>
                  <td>
                    <StyledInput
                      style={{ width: '100%' }}
                      placeholder={t`e.g. Urgent supplier invoice`}
                      value={newAdj.label}
                      onChange={(e) => setNewAdj((prev) => ({ ...prev, label: e.target.value }))}
                    />
                  </td>
                  <td>
                    <StyledInput
                      style={{ width: 64 }}
                      value={newAdj.currencyCode}
                      onChange={(e) => setNewAdj((prev) => ({ ...prev, currencyCode: e.target.value.toUpperCase() }))}
                    />
                  </td>
                  <td className="num">
                    <StyledInput
                      type="number"
                      min="0"
                      step="0.01"
                      style={{ width: 110, textAlign: 'right' }}
                      placeholder="0.00"
                      value={newAdj.amount}
                      onChange={(e) => setNewAdj((prev) => ({ ...prev, amount: e.target.value }))}
                    />
                  </td>
                  <td>
                    <StyledSelect
                      value={newAdj.bankAccountId}
                      onChange={(e) => setNewAdj((prev) => ({ ...prev, bankAccountId: e.target.value }))}
                    >
                      <option value="">— optional —</option>
                      {banks.map((b) => (
                        <option key={b.id} value={b.id}>{b.bankName}{b.accountLabel ? ` · ${b.accountLabel}` : ''} ({b.currencyCode})</option>
                      ))}
                    </StyledSelect>
                  </td>
                  <td>
                    <StyledInput
                      style={{ width: '100%' }}
                      placeholder={t`optional`}
                      value={newAdj.note}
                      onChange={(e) => setNewAdj((prev) => ({ ...prev, note: e.target.value }))}
                    />
                  </td>
                  <td>
                    <StyledPrimaryButton
                      onClick={handleAddAdjustment}
                      disabled={isAddingAdj}
                      style={{ padding: '4px 10px' }}
                    >
                      +
                    </StyledPrimaryButton>
                  </td>
                </tr>
              </tbody>
            </StyledTable>
          </StyledCard>
        </StyledSection>
        <StyledWizardFooter>
          <span />
          <StyledPrimaryButton onClick={() => setStep(2)}>
            <Trans>Next: pick bills →</Trans>
          </StyledPrimaryButton>
        </StyledWizardFooter>
        </>
        )}

        {step === 2 && (
        <>
        {(() => {
          const billCurrencies = [...new Set((data?.duePayables ?? []).map((r) => r.currencyCode))].sort();
          const searchLower = billSearch.trim().toLowerCase();
          const matchesFilter = (row: Invoice) =>
            (!billCcyFilter || row.currencyCode === billCcyFilter) &&
            (!searchLower ||
              (row.contactName ?? '').toLowerCase().includes(searchLower) ||
              (row.invoiceNumber ?? '').toLowerCase().includes(searchLower));
          const visiblePayables = (data?.duePayables ?? []).filter(matchesFilter);
          const plannedPayables = visiblePayables.filter(row => selection[row.xeroInvoiceId]);
          const otherPayables = visiblePayables.filter(row => !selection[row.xeroInvoiceId]);

          const renderTable = (payables: Invoice[], emptyMessage: React.ReactNode) => (
            <StyledScrollCard>
              <StyledTable>
                <thead>
                  <tr>
                    <th style={{ width: 36 }} />
                    <th><Trans>Supplier</Trans></th>
                    <th style={{ width: 130 }}><Trans>Due</Trans></th>
                    <th style={{ width: 90 }}><Trans>Priority</Trans></th>
                    <th className="num" style={{ width: 110 }}><Trans>Amount</Trans></th>
                    <th style={{ width: 170 }}><Trans>Pay from</Trans></th>
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
                          <div style={{ fontWeight: 500, color: 'var(--t-font-color-primary)' }}>{row.contactName ?? '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--t-font-color-tertiary)' }}>
                            {row.invoiceNumber ?? t`no bill #`}
                            {' · '}
                            <button
                              type="button"
                              onClick={() => { const checked = !isMustPay; setMustPay((prev) => ({ ...prev, [row.xeroInvoiceId]: checked })); if (checked) setSelection((prev) => ({ ...prev, [row.xeroInvoiceId]: true })); savePriority(row.tenantId, row.xeroInvoiceId); }}
                              title={t`Lock as must-pay`}
                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: isMustPay ? 'var(--t-accent-primary)' : 'var(--t-font-color-tertiary)', fontSize: 11 }}
                            >
                              {isMustPay ? '🔒 must-pay' : '🔓 lock'}
                            </button>
                          </div>
                        </td>
                        <td>
                          <div>{row.dueDate ?? '—'}</div>
                          {row.overdue && <StyledPill style={PILL_STYLES.red}><Trans>overdue</Trans></StyledPill>}
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
                        <td className="num" style={{ fontWeight: 500 }}>{fmt(row.amountDue, row.currencyCode)}</td>
                        <td>
                          {(() => {
                            // Route-by-provider (accountant's model): NZD bills
                            // pay from BNZ (NZD banks); every other currency pays
                            // from Wise/Statrys, which convert. Same-currency
                            // banks are always eligible; a foreign-currency
                            // provider bank shows a live FX estimate and is
                            // converted at commit.
                            const isNzd = row.currencyCode === 'NZD';
                            const eligibleBanks = isNzd
                              ? banks.filter((b) => b.currencyCode === 'NZD')
                              : banks.filter(
                                  (b) =>
                                    b.currencyCode === row.currencyCode ||
                                    b.bankName === 'Wise' ||
                                    b.bankName === 'Statrys',
                                );

                            if (eligibleBanks.length === 0) {
                              return (
                                <span style={{ fontSize: 12, color: 'var(--t-font-color-danger)' }}>
                                  <Trans>
                                    No bank to pay {row.currencyCode} — add{' '}
                                    {isNzd ? 'BNZ' : 'Wise or Statrys'}
                                  </Trans>
                                </span>
                              );
                            }

                            const selectedId = bankByInvoice[row.xeroInvoiceId] ?? '';
                            const selectedBank = eligibleBanks.find((b) => b.id === selectedId);
                            const needsFx =
                              isDefined(selectedBank) &&
                              selectedBank.currencyCode !== row.currencyCode;

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <StyledSelect
                                  style={{ width: '100%' }}
                                  value={selectedId}
                                  onChange={(e) =>
                                    setBankByInvoice((prev) => ({
                                      ...prev,
                                      [row.xeroInvoiceId]: e.target.value,
                                    }))
                                  }
                                >
                                  <option value="">— pick bank —</option>
                                  {eligibleBanks.map((b) => (
                                    <option key={b.id} value={b.id}>
                                      {b.bankName}
                                      {b.accountLabel ? ` · ${b.accountLabel}` : ''} ({b.currencyCode})
                                      {b.currencyCode !== row.currencyCode ? ' — FX' : ''}
                                    </option>
                                  ))}
                                </StyledSelect>
                                {needsFx && (
                                  <FxEstimate
                                    tokenPair={tokenPair}
                                    amount={row.amountDue}
                                    from={row.currencyCode}
                                    to={selectedBank.currencyCode}
                                  />
                                )}
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                  {payables.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <StyledEmpty>{emptyMessage}</StyledEmpty>
                      </td>
                    </tr>
                  )}
                </tbody>
              </StyledTable>
            </StyledScrollCard>
          );

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <StyledInput
                  placeholder={t`Search supplier or bill #`}
                  value={billSearch}
                  onChange={(e) => setBillSearch(e.target.value)}
                  style={{ flex: 1, minWidth: 200 }}
                />
                <StyledSelect
                  value={billCcyFilter}
                  onChange={(e) => setBillCcyFilter(e.target.value)}
                >
                  <option value="">{t`All currencies`}</option>
                  {billCurrencies.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </StyledSelect>
                {(billCcyFilter || billSearch) && (
                  <StyledSecondaryButton onClick={() => { setBillCcyFilter(''); setBillSearch(''); }}>
                    <Trans>Clear</Trans>
                  </StyledSecondaryButton>
                )}
              </div>
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
        <StyledWizardFooter>
          <StyledSecondaryButton onClick={() => setStep(1)}>
            <Trans>← Back</Trans>
          </StyledSecondaryButton>
          <StyledPrimaryButton onClick={() => setStep(3)}>
            <Trans>Next: banks & commit →</Trans>
          </StyledPrimaryButton>
        </StyledWizardFooter>
        </>
        )}

        {step === 3 && (
        <>
        <StyledSection>
          <StyledSectionHeader>
            <StyledSectionTitle>
              <Trans>Recommended bank transfers</Trans>
            </StyledSectionTitle>
            <StyledSecondaryButton onClick={handleAutoAssignBanks} disabled={!data}>
              <Trans>Auto-assign banks</Trans>
            </StyledSecondaryButton>
          </StyledSectionHeader>
          <StyledSectionDescription>
            <Trans>
              Based on each bank's role — international payments route to Wise /
              Statrys, expenses to UOB / BNZ, BNZ is the fallback. "Auto-assign
              banks" fills the Pay-from column for selected bills. When a bank
              can't cover its assigned total, top up from BNZ:
            </Trans>
          </StyledSectionDescription>
          <StyledCard>
            <StyledTable>
              <thead>
                <tr>
                  <th><Trans>Top up from</Trans></th>
                  <th><Trans>Into</Trans></th>
                  <th>CCY</th>
                  <th className="num"><Trans>Amount</Trans></th>
                </tr>
              </thead>
              <tbody>
                {routing.transfers.map((tr, i) => {
                  const from = banks.find((b) => b.id === tr.fromBankId);
                  const to = banks.find((b) => b.id === tr.toBankId);
                  return (
                    <tr key={`${tr.toBankId}-${i}`}>
                      <td>{from ? from.bankName : t`No main (BNZ) bank set`}</td>
                      <td><strong>{to ? to.bankName : '—'}</strong>{to?.accountLabel ? ` · ${to.accountLabel}` : ''}</td>
                      <td>{tr.currencyCode}</td>
                      <td className="num" style={{ color: 'var(--t-accent-primary)' }}>
                        {fmt(tr.amount, tr.currencyCode)}
                      </td>
                    </tr>
                  );
                })}
                {routing.transfers.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <StyledEmpty>
                        <Trans>
                          No top-ups needed — every assigned bank can cover its
                          share, or nothing is selected yet.
                        </Trans>
                      </StyledEmpty>
                    </td>
                  </tr>
                )}
              </tbody>
            </StyledTable>
          </StyledCard>
        </StyledSection>

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
            <StyledSecondaryButton onClick={() => setStep(2)}>
              <Trans>← Back</Trans>
            </StyledSecondaryButton>
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
        </>
        )}
      </StyledContainer>
    </>
  );
};
