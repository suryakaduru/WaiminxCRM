import { tokenPairState } from '@/auth/states/tokenPairState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { PageTitle } from '@/ui/utilities/page-title/components/PageTitle';
import { styled } from '@linaria/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { xeroFetch } from '@/xero-integration/utils/xero-api';

type AuditLogRow = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  objectName: string | null;
  recordId: string | null;
  recordName: string | null;
  diff: Record<string, { before?: unknown; after?: unknown }> | null;
  ipAddress: string | null;
  context: Record<string, unknown> | null;
  createdAt: string;
};

type AuditLogResponse = {
  total: number;
  rows: AuditLogRow[];
};

const ACTIONS = [
  'all',
  'login',
  'created',
  'updated',
  'deleted',
  'restored',
] as const;

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

const StyledBackButton = styled.button`
  align-self: flex-start;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  font-size: 13px;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};

  &:hover {
    background: ${themeCssVariables.background.secondary};
  }
`;

const StyledFilters = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledSelect = styled.select`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-size: 13px;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledInput = styled.input`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-size: 13px;
  min-width: 200px;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledTableWrapper = styled.div`
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  overflow-x: auto;
`;

const StyledTable = styled.table`
  border-collapse: collapse;
  font-size: 13px;
  width: 100%;
`;

const StyledTh = styled.th`
  background: ${themeCssVariables.background.secondary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.tertiary};
  font-weight: 500;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  text-align: left;
  white-space: nowrap;
`;

const StyledTd = styled.td`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.secondary};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  vertical-align: top;
`;

const StyledBadge = styled.span`
  background: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-size: 12px;
  padding: 2px 8px;
  text-transform: capitalize;
`;

const StyledDiff = styled.pre`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 12px;
  margin: 0;
  max-width: 360px;
  white-space: pre-wrap;
  word-break: break-word;
`;

const StyledEmpty = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  padding: ${themeCssVariables.spacing[8]};
  text-align: center;
`;

const formatDiff = (
  diff: AuditLogRow['diff'],
): string => {
  if (!isDefined(diff)) return '';

  return Object.entries(diff)
    .map(([field, change]) => {
      const before = change?.before;
      const after = change?.after;

      if (before === undefined) return `${field}: → ${JSON.stringify(after)}`;

      return `${field}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`;
    })
    .slice(0, 8)
    .join('\n');
};

export const AuditLog = () => {
  const { t } = useLingui();
  const navigate = useNavigate();
  const tokenPair = useAtomStateValue(tokenPairState);

  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [action, setAction] = useState<string>('all');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');

  const load = useCallback(async () => {
    if (!isDefined(tokenPair?.accessOrWorkspaceAgnosticToken?.token)) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: '200' });

      if (action !== 'all') params.set('action', action);
      if (from !== '') params.set('from', new Date(from).toISOString());
      if (to !== '') params.set('to', new Date(to).toISOString());

      const data = await xeroFetch<AuditLogResponse>(
        `/audit-log/logs?${params.toString()}`,
        tokenPair,
      );

      setRows(data.rows);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [tokenPair, action, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageTitle title={t`Audit Log | Waimin`} />
      <StyledContainer>
        <StyledHeader>
          <StyledHeadings>
            <StyledTitle>
              <Trans>Audit Log</Trans>
            </StyledTitle>
            <StyledSubtitle>
              <Trans>
                Every action taken in the CRM — who logged in, and who created,
                edited or deleted a record. Read-only and retained for 90 days.
              </Trans>
            </StyledSubtitle>
          </StyledHeadings>
          <StyledBackButton onClick={() => navigate(AppPath.FinanceDashboard)}>
            <Trans>← Back to Dashboard</Trans>
          </StyledBackButton>
        </StyledHeader>

        <StyledFilters>
          <StyledSelect
            value={action}
            onChange={(event) => setAction(event.target.value)}
          >
            {ACTIONS.map((value) => (
              <option key={value} value={value}>
                {value === 'all' ? t`All actions` : value}
              </option>
            ))}
          </StyledSelect>
          <StyledInput
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            aria-label={t`From date`}
          />
          <StyledInput
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            aria-label={t`To date`}
          />
        </StyledFilters>

        {error !== null && <StyledEmpty>{error}</StyledEmpty>}

        <StyledTableWrapper>
          <StyledTable>
            <thead>
              <tr>
                <StyledTh>
                  <Trans>When</Trans>
                </StyledTh>
                <StyledTh>
                  <Trans>User</Trans>
                </StyledTh>
                <StyledTh>
                  <Trans>Action</Trans>
                </StyledTh>
                <StyledTh>
                  <Trans>Object</Trans>
                </StyledTh>
                <StyledTh>
                  <Trans>Record</Trans>
                </StyledTh>
                <StyledTh>
                  <Trans>Changes</Trans>
                </StyledTh>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <StyledTd>{new Date(row.createdAt).toLocaleString()}</StyledTd>
                  <StyledTd>{row.userEmail ?? row.userId ?? t`System`}</StyledTd>
                  <StyledTd>
                    <StyledBadge>{row.action}</StyledBadge>
                  </StyledTd>
                  <StyledTd>{row.objectName ?? '—'}</StyledTd>
                  <StyledTd>{row.recordName ?? row.recordId ?? '—'}</StyledTd>
                  <StyledTd>
                    <StyledDiff>{formatDiff(row.diff)}</StyledDiff>
                  </StyledTd>
                </tr>
              ))}
            </tbody>
          </StyledTable>
          {rows.length === 0 && !loading && (
            <StyledEmpty>
              <Trans>No activity recorded for this filter.</Trans>
            </StyledEmpty>
          )}
          {loading && (
            <StyledEmpty>
              <Trans>Loading…</Trans>
            </StyledEmpty>
          )}
        </StyledTableWrapper>

        <StyledSubtitle>
          <Trans>Showing {rows.length} of {total} entries.</Trans>
        </StyledSubtitle>
      </StyledContainer>
    </>
  );
};
