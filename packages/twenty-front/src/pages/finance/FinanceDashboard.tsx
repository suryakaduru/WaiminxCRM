import { tokenPairState } from '@/auth/states/tokenPairState';
import { PageTitle } from '@/ui/utilities/page-title/components/PageTitle';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { xeroFetch } from '@/xero-integration/utils/xero-api';
import { styled } from '@linaria/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[6]};
  height: 100%;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[6]} ${themeCssVariables.spacing[8]};
  width: 100%;
`;

const StyledHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledTitle = styled.h1`
  color: ${themeCssVariables.font.color.primary};
  font-size: 24px;
  font-weight: 500;
  letter-spacing: -0.01em;
  margin: 0;
`;

const StyledSubtitle = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 14px;
  margin: 0;
`;

const StyledSectionTitle = styled.h2`
  color: ${themeCssVariables.font.color.secondary};
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.04em;
  margin: 0;
  text-transform: uppercase;
`;

const StyledSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;

const StyledGrid = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[4]};
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
`;

const StyledCard = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledCardLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: uppercase;
`;

const StyledCardValue = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: 22px;
  font-weight: 500;
`;

const StyledCardHint = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 12px;
`;

const StyledBanner = styled.div`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${themeCssVariables.font.color.secondary};
  font-size: 13px;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
`;

const StyledTable = styled.table`
  border-collapse: collapse;
  width: 100%;

  & th,
  & td {
    border-bottom: 1px solid ${themeCssVariables.border.color.light};
    font-size: 13px;
    padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
    text-align: left;
  }

  & th {
    color: ${themeCssVariables.font.color.tertiary};
    font-weight: 500;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.04em;
  }

  & td {
    color: ${themeCssVariables.font.color.primary};
  }
`;

type Invoice = {
  invoiceID: string;
  invoiceNumber: string;
  type: 'ACCREC' | 'ACCPAY';
  status: string;
  date: string;
  dueDate: string;
  contactName: string;
  total: number;
  amountDue: number;
  amountPaid: number;
  currencyCode: string;
};

type DebugResponse = {
  tenantId: string;
  tenantName: string | null;
  count: number;
  invoices: Invoice[];
};

const BANK_CARDS = [
  { label: 'BNZ', hint: 'Manual entry — coming soon' },
  { label: 'Wise', hint: 'Auto-sync (Phase 2)' },
  { label: 'Statrys', hint: 'Auto-sync (Phase 2)' },
  { label: 'UOB', hint: 'Manual entry — coming soon' },
];

const formatMoney = (amount: number, currency = 'USD'): string => {
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

const formatDate = (value: string): string => {
  try {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
};

export const FinanceDashboard = () => {
  const { t } = useLingui();
  const tokenPair = useAtomStateValue(tokenPairState);
  const [data, setData] = useState<DebugResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDefined(tokenPair?.accessOrWorkspaceAgnosticToken?.token)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    xeroFetch<DebugResponse>(
      '/auth/xero/debug/invoices?limit=100',
      tokenPair,
    )
      .then((json) => setData(json))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Unknown error'),
      )
      .finally(() => setIsLoading(false));
  }, [tokenPair]);

  const invoices = data?.invoices ?? [];
  const currency = invoices[0]?.currencyCode ?? 'USD';

  const accountsReceivable = invoices
    .filter((inv) => inv.type === 'ACCREC' && inv.status === 'AUTHORISED')
    .reduce((sum, inv) => sum + (inv.amountDue ?? 0), 0);

  const accountsPayable = invoices
    .filter((inv) => inv.type === 'ACCPAY' && inv.status === 'AUTHORISED')
    .reduce((sum, inv) => sum + (inv.amountDue ?? 0), 0);

  const netForecast = accountsReceivable - accountsPayable;

  const totalCash = '—';

  const recentInvoices = [...invoices]
    .sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
    .slice(0, 8);

  const hasXeroData = isDefined(data) && data.count > 0;

  return (
    <>
      <PageTitle title={t`Finance Dashboard | Waimin`} />
      <StyledContainer>
        <StyledHeader>
          <StyledTitle>
            <Trans>Finance Dashboard</Trans>
          </StyledTitle>
          <StyledSubtitle>
            {hasXeroData ? (
              <Trans>
                Live data from {data?.tenantName ?? 'Xero'} · {data?.count}{' '}
                invoices loaded
              </Trans>
            ) : (
              <Trans>
                Real-time cash position, receivables, payables and bank
                balances.
              </Trans>
            )}
          </StyledSubtitle>
        </StyledHeader>

        {error && (
          <StyledBanner>
            <Trans>
              Could not load Xero data: {error}. Connect Xero in Settings →
              Integrations.
            </Trans>
          </StyledBanner>
        )}

        {isLoading && !data && (
          <StyledBanner>
            <Trans>Loading Xero data…</Trans>
          </StyledBanner>
        )}

        <StyledSection>
          <StyledSectionTitle>
            <Trans>Cash position</Trans>
          </StyledSectionTitle>
          <StyledGrid>
            <StyledCard>
              <StyledCardLabel>
                <Trans>Total cash</Trans>
              </StyledCardLabel>
              <StyledCardValue>{totalCash}</StyledCardValue>
              <StyledCardHint>
                <Trans>Sum across banks (Phase 2)</Trans>
              </StyledCardHint>
            </StyledCard>
            <StyledCard>
              <StyledCardLabel>
                <Trans>Accounts receivable</Trans>
              </StyledCardLabel>
              <StyledCardValue>
                {hasXeroData ? formatMoney(accountsReceivable, currency) : '—'}
              </StyledCardValue>
              <StyledCardHint>
                <Trans>Outstanding from customers</Trans>
              </StyledCardHint>
            </StyledCard>
            <StyledCard>
              <StyledCardLabel>
                <Trans>Accounts payable</Trans>
              </StyledCardLabel>
              <StyledCardValue>
                {hasXeroData ? formatMoney(accountsPayable, currency) : '—'}
              </StyledCardValue>
              <StyledCardHint>
                <Trans>Owed to suppliers</Trans>
              </StyledCardHint>
            </StyledCard>
            <StyledCard>
              <StyledCardLabel>
                <Trans>Net position (A/R − A/P)</Trans>
              </StyledCardLabel>
              <StyledCardValue>
                {hasXeroData ? formatMoney(netForecast, currency) : '—'}
              </StyledCardValue>
              <StyledCardHint>
                <Trans>Receivables minus payables</Trans>
              </StyledCardHint>
            </StyledCard>
          </StyledGrid>
        </StyledSection>

        <StyledSection>
          <StyledSectionTitle>
            <Trans>Bank balances</Trans>
          </StyledSectionTitle>
          <StyledGrid>
            {BANK_CARDS.map((card) => (
              <StyledCard key={card.label}>
                <StyledCardLabel>{card.label}</StyledCardLabel>
                <StyledCardValue>—</StyledCardValue>
                <StyledCardHint>{card.hint}</StyledCardHint>
              </StyledCard>
            ))}
          </StyledGrid>
        </StyledSection>

        {recentInvoices.length > 0 && (
          <StyledSection>
            <StyledSectionTitle>
              <Trans>Recent invoices</Trans>
            </StyledSectionTitle>
            <StyledCard>
              <StyledTable>
                <thead>
                  <tr>
                    <th>
                      <Trans>Date</Trans>
                    </th>
                    <th>
                      <Trans>Number</Trans>
                    </th>
                    <th>
                      <Trans>Type</Trans>
                    </th>
                    <th>
                      <Trans>Contact</Trans>
                    </th>
                    <th>
                      <Trans>Status</Trans>
                    </th>
                    <th style={{ textAlign: 'right' }}>
                      <Trans>Total</Trans>
                    </th>
                    <th style={{ textAlign: 'right' }}>
                      <Trans>Due</Trans>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((invoice) => (
                    <tr key={invoice.invoiceID}>
                      <td>{formatDate(invoice.date)}</td>
                      <td>{invoice.invoiceNumber || '—'}</td>
                      <td>{invoice.type === 'ACCREC' ? 'Sales' : 'Bill'}</td>
                      <td>{invoice.contactName || '—'}</td>
                      <td>{invoice.status}</td>
                      <td style={{ textAlign: 'right' }}>
                        {formatMoney(invoice.total ?? 0, invoice.currencyCode)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {formatMoney(
                          invoice.amountDue ?? 0,
                          invoice.currencyCode,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </StyledTable>
            </StyledCard>
          </StyledSection>
        )}
      </StyledContainer>
    </>
  );
};
