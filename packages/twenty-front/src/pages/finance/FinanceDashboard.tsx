import { tokenPairState } from '@/auth/states/tokenPairState';
import { PageTitle } from '@/ui/utilities/page-title/components/PageTitle';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { xeroFetch } from '@/xero-integration/utils/xero-api';
import { styled } from '@linaria/react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

type AgingRow = {
  currencyCode: string;
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
  total: number;
  count: number;
};

type AgingResponse = {
  asOf: string;
  receivable: AgingRow[];
  payable: AgingRow[];
};

type CashRow = { currencyCode: string; bankCount: number; balance: number };

type CashResponse = { asOf: string; byCurrency: CashRow[] };

type BankAccount = {
  id: string;
  bankName: string;
  accountLabel: string | null;
  currencyCode: string;
  balance: string;
  source: string;
};

type SyncCursor = {
  tenantId: string;
  entityType: 'invoices' | 'contacts' | 'bankAccounts';
  status: 'idle' | 'running' | 'error';
  lastSyncedAt: string | null;
  lastError: string | null;
  recordsSyncedLastRun: number;
};

const StyledContainer = styled.div`
  background: ${themeCssVariables.background.secondary};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[6]};
  // flex sizing instead of height:100% — parent is unbounded, so a percentage
  // height made the app shell clip the bottom of the dashboard
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[6]} ${themeCssVariables.spacing[8]}
    ${themeCssVariables.spacing[10]};
  width: 100%;

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  & > * {
    animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  & > *:nth-child(2) { animation-delay: 0.04s; }
  & > *:nth-child(3) { animation-delay: 0.08s; }
  & > *:nth-child(4) { animation-delay: 0.12s; }
  & > *:nth-child(5) { animation-delay: 0.16s; }
  & > *:nth-child(6) { animation-delay: 0.2s; }

  @media (prefers-reduced-motion: reduce) {
    & > * { animation: none; }
  }
`;

const StyledHero = styled.section`
  align-items: center;
  background: linear-gradient(
    135deg,
    ${themeCssVariables.background.primary} 0%,
    ${themeCssVariables.background.secondary} 100%
  );
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04),
    0 8px 24px -12px rgba(15, 23, 42, 0.12);
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[6]};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[6]};
  position: relative;
`;

const StyledHeroMetric = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const StyledHeroLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;

const StyledHeroValue = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: 40px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.05;
`;

const StyledHeroSplit = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[6]};
`;

const StyledHeroSub = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const StyledHeroSubValue = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-size: 18px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
`;

const StyledHeader = styled.header`
  display: flex;
  gap: ${themeCssVariables.spacing[4]};
  justify-content: space-between;
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
`;

const StyledSyncRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledPill = styled.span`
  align-items: center;
  border-radius: 999px;
  display: inline-flex;
  font-size: 12px;
  font-weight: 500;
  gap: 6px;
  padding: 4px 10px;

  &::before {
    background: currentColor;
    border-radius: 50%;
    content: '';
    display: inline-block;
    height: 6px;
    width: 6px;
  }
`;

const StyledPrimaryButton = styled.button`
  background: #2563eb;
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};

  &:hover { background: #1d4ed8; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const StyledSecondaryButton = styled.button`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-size: 13px;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};

  &:hover { background: ${themeCssVariables.background.secondary}; }
`;

const StyledKPIGrid = styled.section`
  display: grid;
  gap: ${themeCssVariables.spacing[4]};
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
`;

const StyledKPI = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  overflow: hidden;
  padding: ${themeCssVariables.spacing[4]};
  position: relative;
  transition: box-shadow 0.2s ease, transform 0.2s ease,
    border-color 0.2s ease;

  /* Accent stripe — colour supplied per card via --accent. */
  &::before {
    background: var(--accent, ${themeCssVariables.border.color.medium});
    content: '';
    height: 3px;
    left: 0;
    position: absolute;
    right: 0;
    top: 0;
  }

  &:hover {
    border-color: ${themeCssVariables.border.color.medium};
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04),
      0 12px 28px -16px rgba(15, 23, 42, 0.25);
    transform: translateY(-2px);
  }
`;

const StyledKPILabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  margin-top: 4px;
  text-transform: uppercase;
`;

const StyledKPIValue = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
`;

const StyledKPIHint = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 12px;
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
`;

const StyledCard = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  overflow: hidden;
`;

const StyledTableScroll = styled.div`
  overflow-x: auto;
  width: 100%;
`;

const StyledTable = styled.table`
  border-collapse: collapse;
  min-width: 760px;
  width: 100%;

  & thead { background: ${themeCssVariables.background.secondary}; }

  & th,
  & td {
    border-bottom: 1px solid ${themeCssVariables.border.color.light};
    font-size: 13px;
    padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
    text-align: left;
  }

  & th {
    color: ${themeCssVariables.font.color.tertiary};
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  & tr:last-child td { border-bottom: none; }

  & td.num,
  & th.num {
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
`;

const StyledBankGrid = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[3]};
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledBankBlock = styled.div`
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledEmpty = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  padding: ${themeCssVariables.spacing[8]};
  text-align: center;
`;

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

const formatRelative = (iso: string | null): string => {
  if (!iso) return 'never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);

  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
};

const syncTone = (
  lastSyncedAt: string | null,
  hasError: boolean,
): 'ok' | 'warn' | 'err' => {
  if (hasError) return 'err';
  if (!lastSyncedAt) return 'warn';
  const ageMin = (Date.now() - new Date(lastSyncedAt).getTime()) / 60000;

  if (ageMin > 60) return 'warn';

  return 'ok';
};

const AgingBar = ({ row }: { row: AgingRow }) => {
  const buckets = [
    { v: row.current, c: '#10b981' },
    { v: row.d1_30, c: '#facc15' },
    { v: row.d31_60, c: '#f97316' },
    { v: row.d61_90, c: '#ef4444' },
    { v: row.d90_plus, c: '#7f1d1d' },
  ];
  const total = row.total || 1;

  return (
    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
      {buckets.map((b, i) => (
        <div
          key={i}
          title={fmt(b.v, row.currencyCode)}
          style={{ background: b.c, flex: b.v / total }}
        />
      ))}
    </div>
  );
};

export const FinanceDashboard = () => {
  const { t } = useLingui();
  const navigate = useNavigate();
  const tokenPair = useAtomStateValue(tokenPairState);
  const [aging, setAging] = useState<AgingResponse | null>(null);
  const [cash, setCash] = useState<CashResponse | null>(null);
  const [nzdTotal, setNzdTotal] = useState<{
    totalNzd: number;
    hasErrors: boolean;
  } | null>(null);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [syncCursors, setSyncCursors] = useState<SyncCursor[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!isDefined(tokenPair?.accessOrWorkspaceAgnosticToken?.token)) return;
    try {
      setError(null);
      const [a, c, b, s, nzd] = await Promise.all([
        xeroFetch<AgingResponse>('/finance/aging', tokenPair),
        xeroFetch<CashResponse>('/finance/cash-position', tokenPair),
        xeroFetch<BankAccount[]>('/finance/bank-accounts', tokenPair),
        xeroFetch<{ cursors: SyncCursor[] }>(
          '/finance/xero/sync/status',
          tokenPair,
        ),
        xeroFetch<{ totalNzd: number; hasErrors: boolean }>(
          '/finance/cash-position/nzd',
          tokenPair,
        ).catch(() => null),
      ]);

      setAging(a);
      setCash(c);
      setBanks(b);
      setSyncCursors(s.cursors);
      setNzdTotal(nzd);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [tokenPair]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleSync = async () => {
    if (!tokenPair) return;
    setIsSyncing(true);
    try {
      await xeroFetch('/finance/xero/sync', tokenPair, { method: 'POST' });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  // Group banks by bank name (a bank has multiple currency accounts)
  const banksByBank = new Map<string, BankAccount[]>();

  for (const account of banks) {
    const list = banksByBank.get(account.bankName) ?? [];

    list.push(account);
    banksByBank.set(account.bankName, list);
  }

  const lastSyncedAt =
    syncCursors
      .map((c) => c.lastSyncedAt)
      .filter(Boolean)
      .sort()
      .pop() ?? null;
  const hasSyncError = syncCursors.some((c) => c.status === 'error');
  const tone = syncTone(lastSyncedAt, hasSyncError);

  // Top-level KPIs (per currency roll-up).
  const arTotal = new Map<string, number>();
  const apTotal = new Map<string, number>();
  const arOverdue = new Map<string, number>();

  aging?.receivable.forEach((r) => {
    arTotal.set(r.currencyCode, r.total);
    arOverdue.set(
      r.currencyCode,
      r.d1_30 + r.d31_60 + r.d61_90 + r.d90_plus,
    );
  });
  aging?.payable.forEach((r) => apTotal.set(r.currencyCode, r.total));

  const currencies = Array.from(
    new Set([
      ...(cash?.byCurrency.map((c) => c.currencyCode) ?? []),
      ...arTotal.keys(),
      ...apTotal.keys(),
    ]),
  ).sort();

  // Default to the currency with the most activity (cash + A/R + A/P),
  // so all-zero currencies don't hide the real numbers.
  const activityOf = (ccy: string) =>
    (cash?.byCurrency.find((c) => c.currencyCode === ccy)?.balance ?? 0) +
    (arTotal.get(ccy) ?? 0) +
    (apTotal.get(ccy) ?? 0);
  const busiestCurrency = [...currencies].sort(
    (a, b) => activityOf(b) - activityOf(a),
  )[0];
  const primaryCurrency = selectedCurrency ?? busiestCurrency ?? 'NZD';
  const primaryCash =
    cash?.byCurrency.find((c) => c.currencyCode === primaryCurrency)?.balance ??
    0;
  const primaryAr = arTotal.get(primaryCurrency) ?? 0;
  const primaryAp = apTotal.get(primaryCurrency) ?? 0;
  const primaryOverdue = arOverdue.get(primaryCurrency) ?? 0;

  // Currencies that have invoice activity (A/R or A/P) but NO bank account.
  // Without a matching bank, the planner can't show a real cash runway for them.
  const bankCurrencies = new Set(
    cash?.byCurrency.map((c) => c.currencyCode) ?? [],
  );
  const invoiceCurrencies = new Set<string>([
    ...arTotal.keys(),
    ...apTotal.keys(),
  ]);
  const missingBankCurrencies = [...invoiceCurrencies].filter(
    (ccy) => !bankCurrencies.has(ccy),
  );

  return (
    <>
      <PageTitle title={t`Finance Dashboard | Waimin`} />
      <StyledContainer>
        <StyledHeader>
          <StyledHeadings>
            <StyledTitle>
              <Trans>Finance Dashboard</Trans>
            </StyledTitle>
            <StyledSubtitle>
              <Trans>
                Live snapshot of your cash, receivables and payables. Data comes
                from Xero (invoices, contacts) and manual bank balances. Use
                this to answer "how are we doing right now?" — for "what should
                we pay Friday?" open the Weekly Planner.
              </Trans>
            </StyledSubtitle>
          </StyledHeadings>
          <StyledSyncRow>
            <StyledPill
              style={{
                background:
                  tone === 'ok'
                    ? 'rgba(16,185,129,0.12)'
                    : tone === 'warn'
                      ? 'rgba(234,179,8,0.15)'
                      : 'rgba(220,38,38,0.12)',
                color:
                  tone === 'ok'
                    ? '#059669'
                    : tone === 'warn'
                      ? '#a16207'
                      : '#b91c1c',
              }}
            >
              <Trans>Xero {formatRelative(lastSyncedAt)}</Trans>
            </StyledPill>
            <StyledSecondaryButton onClick={handleSync} disabled={isSyncing}>
              {isSyncing ? <Trans>Syncing…</Trans> : <Trans>Sync now</Trans>}
            </StyledSecondaryButton>
            <StyledPrimaryButton
              onClick={() => navigate(AppPath.FinanceWeeklyPlanner)}
            >
              <Trans>Open Weekly Planner →</Trans>
            </StyledPrimaryButton>
          </StyledSyncRow>
        </StyledHeader>

        {error && (
          <StyledCard style={{ padding: 16, color: '#b91c1c' }}>{error}</StyledCard>
        )}

        {missingBankCurrencies.length > 0 && (
          <StyledCard
            style={{
              padding: '14px 18px',
              background: 'rgba(234,179,8,0.10)',
              borderColor: 'rgba(234,179,8,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div style={{ fontSize: 13, color: '#854d0e' }}>
              <strong>
                <Trans>Missing bank accounts</Trans>
              </strong>
              <div style={{ marginTop: 2 }}>
                <Trans>
                  You have invoices in {missingBankCurrencies.join(', ')} but no
                  bank account in {missingBankCurrencies.length > 1 ? 'those currencies' : 'that currency'}.
                  Add one so the Weekly Planner can show your real cash position.
                </Trans>
              </div>
            </div>
            <StyledPrimaryButton onClick={() => navigate(AppPath.FinanceBanks)}>
              <Trans>Add bank →</Trans>
            </StyledPrimaryButton>
          </StyledCard>
        )}

        <StyledHero>
          <StyledHeroMetric>
            <StyledHeroLabel>
              <Trans>Net cash position</Trans>
            </StyledHeroLabel>
            <StyledHeroValue
              style={{
                color:
                  primaryCash + primaryAr - primaryAp < 0 ? '#b91c1c' : undefined,
              }}
            >
              {fmt(primaryCash + primaryAr - primaryAp, primaryCurrency)}
            </StyledHeroValue>
            <StyledKPIHint>
              <Trans>Cash + money owed to you − money you owe</Trans>
            </StyledKPIHint>
          </StyledHeroMetric>
          <StyledHeroSplit>
            {isDefined(nzdTotal) && (
              <StyledHeroSub>
                <StyledHeroLabel>
                  <Trans>Total cash (all currencies → NZD)</Trans>
                </StyledHeroLabel>
                <StyledHeroSubValue style={{ color: '#2563eb' }}>
                  {fmt(nzdTotal.totalNzd, 'NZD')}
                </StyledHeroSubValue>
                <StyledKPIHint>
                  {nzdTotal.hasErrors ? (
                    <Trans>Live rate · some currencies could not be converted</Trans>
                  ) : (
                    <Trans>Live mid-market rate · for weekly reporting</Trans>
                  )}
                </StyledKPIHint>
              </StyledHeroSub>
            )}
            <StyledHeroSub>
              <StyledHeroLabel>
                <Trans>Cash on hand</Trans>
              </StyledHeroLabel>
              <StyledHeroSubValue>
                {fmt(primaryCash, primaryCurrency)}
              </StyledHeroSubValue>
            </StyledHeroSub>
            <StyledHeroSub>
              <StyledHeroLabel>
                <Trans>Incoming (A/R)</Trans>
              </StyledHeroLabel>
              <StyledHeroSubValue style={{ color: '#059669' }}>
                {fmt(primaryAr, primaryCurrency)}
              </StyledHeroSubValue>
            </StyledHeroSub>
            <StyledHeroSub>
              <StyledHeroLabel>
                <Trans>Outgoing (A/P)</Trans>
              </StyledHeroLabel>
              <StyledHeroSubValue style={{ color: '#b45309' }}>
                {fmt(primaryAp, primaryCurrency)}
              </StyledHeroSubValue>
            </StyledHeroSub>
          </StyledHeroSplit>
        </StyledHero>

        <StyledSection>
          <StyledSectionHeader>
            <div>
              <StyledSectionTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trans>At a glance</Trans>
                {currencies.length > 0 && (
                  <select
                    value={primaryCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    style={{
                      background: themeCssVariables.background.secondary,
                      border: `1px solid ${themeCssVariables.border.color.medium}`,
                      borderRadius: themeCssVariables.border.radius.sm,
                      color: themeCssVariables.font.color.primary,
                      fontSize: 13,
                      padding: '2px 6px',
                    }}
                  >
                    {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </StyledSectionTitle>
              <StyledSectionDescription>
                <Trans>
                  Headline numbers in your primary currency. Full multi-currency
                  breakdown is below.
                </Trans>
              </StyledSectionDescription>
            </div>
          </StyledSectionHeader>
          <StyledKPIGrid>
            <StyledKPI style={{ '--accent': '#3b82f6' } as CSSProperties}>
              <StyledKPILabel>
                <Trans>Cash on hand</Trans>
              </StyledKPILabel>
              <StyledKPIValue>{fmt(primaryCash, primaryCurrency)}</StyledKPIValue>
              <StyledKPIHint>
                <Trans>Sum of your bank balances</Trans>
              </StyledKPIHint>
            </StyledKPI>
            <StyledKPI style={{ '--accent': '#10b981' } as CSSProperties}>
              <StyledKPILabel>
                <Trans>Money owed to you</Trans>
              </StyledKPILabel>
              <StyledKPIValue>{fmt(primaryAr, primaryCurrency)}</StyledKPIValue>
              <StyledKPIHint>
                <Trans>Unpaid customer invoices (A/R)</Trans>
              </StyledKPIHint>
            </StyledKPI>
            <StyledKPI style={{ '--accent': '#f59e0b' } as CSSProperties}>
              <StyledKPILabel>
                <Trans>You owe</Trans>
              </StyledKPILabel>
              <StyledKPIValue>{fmt(primaryAp, primaryCurrency)}</StyledKPIValue>
              <StyledKPIHint>
                <Trans>Unpaid supplier bills (A/P)</Trans>
              </StyledKPIHint>
            </StyledKPI>
            <StyledKPI
              style={
                {
                  '--accent': primaryOverdue > 0 ? '#ef4444' : '#94a3b8',
                } as CSSProperties
              }
            >
              <StyledKPILabel>
                <Trans>Overdue receivables</Trans>
              </StyledKPILabel>
              <StyledKPIValue style={{ color: primaryOverdue > 0 ? '#b91c1c' : undefined }}>
                {fmt(primaryOverdue, primaryCurrency)}
              </StyledKPIValue>
              <StyledKPIHint>
                <Trans>Chase these first</Trans>
              </StyledKPIHint>
            </StyledKPI>
          </StyledKPIGrid>
        </StyledSection>

        <StyledSection>
          <StyledSectionHeader>
            <div>
              <StyledSectionTitle>
                <Trans>Cash by currency</Trans>
              </StyledSectionTitle>
              <StyledSectionDescription>
                <Trans>
                  One card per currency. Update balances on the Bank Accounts
                  page.
                </Trans>
              </StyledSectionDescription>
            </div>
            <StyledSecondaryButton
              onClick={() => navigate(AppPath.FinanceBanks)}
            >
              <Trans>Manage banks →</Trans>
            </StyledSecondaryButton>
          </StyledSectionHeader>
          <StyledKPIGrid>
            {cash?.byCurrency.length ? (
              cash.byCurrency.map((row) => (
                <StyledKPI key={row.currencyCode}>
                  <StyledKPILabel>{row.currencyCode}</StyledKPILabel>
                  <StyledKPIValue>{fmt(row.balance, row.currencyCode)}</StyledKPIValue>
                  <StyledKPIHint>
                    <Trans>{row.bankCount} account(s)</Trans>
                  </StyledKPIHint>
                </StyledKPI>
              ))
            ) : (
              <StyledCard style={{ gridColumn: '1 / -1' }}>
                <StyledEmpty>
                  <p style={{ marginBottom: 8 }}>
                    <Trans>No bank balances yet.</Trans>
                  </p>
                  <StyledPrimaryButton onClick={() => navigate(AppPath.FinanceBanks)}>
                    + <Trans>Add your first bank</Trans>
                  </StyledPrimaryButton>
                </StyledEmpty>
              </StyledCard>
            )}
          </StyledKPIGrid>
        </StyledSection>

        <StyledSection>
          <StyledSectionHeader>
            <div>
              <StyledSectionTitle>
                <Trans>Banks</Trans>
              </StyledSectionTitle>
              <StyledSectionDescription>
                <Trans>
                  Each bank grouped with its currency accounts. Real banks often
                  hold multiple currencies — track them separately here.
                </Trans>
              </StyledSectionDescription>
            </div>
          </StyledSectionHeader>
          <StyledCard>
            {banksByBank.size === 0 ? (
              <StyledEmpty>
                <Trans>Add banks on the Bank Accounts page.</Trans>
              </StyledEmpty>
            ) : (
              <StyledBankGrid>
                {Array.from(banksByBank.entries()).map(([bankName, accounts]) => (
                  <StyledBankBlock key={bankName}>
                    <strong>{bankName}</strong>
                    {accounts.map((account) => (
                      <div
                        key={account.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 13,
                        }}
                      >
                        <span>
                          {account.currencyCode}
                          {account.accountLabel ? ` · ${account.accountLabel}` : ''}
                        </span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(Number(account.balance), account.currencyCode)}
                        </span>
                      </div>
                    ))}
                  </StyledBankBlock>
                ))}
              </StyledBankGrid>
            )}
          </StyledCard>
        </StyledSection>

        <StyledSection>
          <StyledSectionHeader>
            <div>
              <StyledSectionTitle>
                <Trans>A/R aging — who owes you</Trans>
              </StyledSectionTitle>
              <StyledSectionDescription>
                <Trans>
                  Customer invoices grouped by how overdue they are. Green =
                  not-yet-due, red = 90+ days overdue. Chase the red first.
                </Trans>
              </StyledSectionDescription>
            </div>
          </StyledSectionHeader>
          <StyledCard>
            <StyledTableScroll>
            <StyledTable>
              <thead>
                <tr>
                  <th>
                    <Trans>CCY</Trans>
                  </th>
                  <th style={{ width: '25%' }}>
                    <Trans>Aging distribution</Trans>
                  </th>
                  <th className="num">
                    <Trans>Current</Trans>
                  </th>
                  <th className="num">1–30</th>
                  <th className="num">31–60</th>
                  <th className="num">61–90</th>
                  <th className="num">90+</th>
                  <th className="num">
                    <Trans>Total</Trans>
                  </th>
                  <th className="num">#</th>
                </tr>
              </thead>
              <tbody>
                {aging?.receivable.map((row) => (
                  <tr key={row.currencyCode}>
                    <td>
                      <strong>{row.currencyCode}</strong>
                    </td>
                    <td>
                      <AgingBar row={row} />
                    </td>
                    <td className="num">{fmt(row.current, row.currencyCode)}</td>
                    <td className="num">{fmt(row.d1_30, row.currencyCode)}</td>
                    <td className="num">{fmt(row.d31_60, row.currencyCode)}</td>
                    <td className="num">{fmt(row.d61_90, row.currencyCode)}</td>
                    <td className="num">{fmt(row.d90_plus, row.currencyCode)}</td>
                    <td className="num">
                      <strong>{fmt(row.total, row.currencyCode)}</strong>
                    </td>
                    <td className="num">{row.count}</td>
                  </tr>
                ))}
                {aging?.receivable.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <StyledEmpty>
                        <Trans>No receivables.</Trans>
                      </StyledEmpty>
                    </td>
                  </tr>
                )}
              </tbody>
            </StyledTable>
            </StyledTableScroll>
          </StyledCard>
        </StyledSection>

        <StyledSection>
          <StyledSectionHeader>
            <div>
              <StyledSectionTitle>
                <Trans>A/P aging — what you owe</Trans>
              </StyledSectionTitle>
              <StyledSectionDescription>
                <Trans>
                  Supplier bills grouped by how overdue they are. Red totals =
                  suppliers waiting on payment. Prioritise these in the Weekly
                  Planner.
                </Trans>
              </StyledSectionDescription>
            </div>
          </StyledSectionHeader>
          <StyledCard>
            <StyledTableScroll>
            <StyledTable>
              <thead>
                <tr>
                  <th>
                    <Trans>CCY</Trans>
                  </th>
                  <th style={{ width: '25%' }}>
                    <Trans>Aging distribution</Trans>
                  </th>
                  <th className="num">
                    <Trans>Current</Trans>
                  </th>
                  <th className="num">1–30</th>
                  <th className="num">31–60</th>
                  <th className="num">61–90</th>
                  <th className="num">90+</th>
                  <th className="num">
                    <Trans>Total</Trans>
                  </th>
                  <th className="num">#</th>
                </tr>
              </thead>
              <tbody>
                {aging?.payable.map((row) => (
                  <tr key={row.currencyCode}>
                    <td>
                      <strong>{row.currencyCode}</strong>
                    </td>
                    <td>
                      <AgingBar row={row} />
                    </td>
                    <td className="num">{fmt(row.current, row.currencyCode)}</td>
                    <td className="num">{fmt(row.d1_30, row.currencyCode)}</td>
                    <td className="num">{fmt(row.d31_60, row.currencyCode)}</td>
                    <td className="num">{fmt(row.d61_90, row.currencyCode)}</td>
                    <td className="num">{fmt(row.d90_plus, row.currencyCode)}</td>
                    <td className="num">
                      <strong>{fmt(row.total, row.currencyCode)}</strong>
                    </td>
                    <td className="num">{row.count}</td>
                  </tr>
                ))}
                {aging?.payable.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <StyledEmpty>
                        <Trans>No payables.</Trans>
                      </StyledEmpty>
                    </td>
                  </tr>
                )}
              </tbody>
            </StyledTable>
            </StyledTableScroll>
          </StyledCard>
        </StyledSection>

      </StyledContainer>
    </>
  );
};
