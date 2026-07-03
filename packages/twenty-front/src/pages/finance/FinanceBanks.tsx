import { tokenPairState } from '@/auth/states/tokenPairState';
import { PageTitle } from '@/ui/utilities/page-title/components/PageTitle';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { xeroFetch } from '@/xero-integration/utils/xero-api';
import { styled } from '@linaria/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const CURRENCIES = ['NZD', 'HKD', 'MYR', 'INR', 'USD', 'AUD', 'SGD', 'GBP', 'EUR'];
const SOURCES = ['manual', 'wise', 'statrys', 'xero'] as const;

type BankAccount = {
  id: string;
  bankName: string;
  accountLabel: string | null;
  currencyCode: string;
  balance: string;
  balanceAsOf: string | null;
  source: 'manual' | 'xero' | 'wise' | 'statrys';
  isActive: boolean;
  sortOrder: number;
};

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
  align-items: flex-start;
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

const StyledPrimaryButton = styled.button`
  background: #2563eb;
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};

  &:hover {
    background: #1d4ed8;
  }
`;

const StyledSecondaryButton = styled.button`
  background: transparent;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-size: 13px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[3]};

  &:hover {
    background: ${themeCssVariables.background.secondary};
  }
`;

const StyledDangerButton = styled(StyledSecondaryButton)`
  color: #dc2626;
`;

const StyledCard = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  overflow: hidden;
`;

const StyledTable = styled.table`
  border-collapse: collapse;
  width: 100%;

  & thead {
    background: ${themeCssVariables.background.secondary};
  }

  & th,
  & td {
    border-bottom: 1px solid ${themeCssVariables.border.color.light};
    font-size: 13px;
    padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
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

  & tr:last-child td {
    border-bottom: none;
  }

  & td.num,
  & th.num {
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
`;

const StyledEmpty = styled.div`
  padding: ${themeCssVariables.spacing[8]};
  text-align: center;
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledPill = styled.span<{ tone?: 'blue' | 'gray' }>`
  background: ${themeCssVariables.background.secondary};
  border-radius: 999px;
  color: ${themeCssVariables.font.color.secondary};
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  text-transform: uppercase;
`;

const StyledModalBackdrop = styled.div`
  align-items: center;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 1000;
`;

const StyledModal = styled.div`
  background: ${themeCssVariables.background.primary};
  border-radius: ${themeCssVariables.border.radius.md};
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  max-width: 480px;
  padding: ${themeCssVariables.spacing[6]};
  width: 90vw;
`;

const StyledFormRow = styled.label`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  font-size: 12px;
  font-weight: 500;
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledInput = styled.input`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-size: 14px;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledSelect = styled.select`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-size: 14px;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

type FormState = {
  id?: string;
  bankName: string;
  accountLabel: string;
  currencyCode: string;
  balance: string;
  source: BankAccount['source'];
};

const emptyForm: FormState = {
  bankName: '',
  accountLabel: '',
  currencyCode: 'NZD',
  balance: '0',
  source: 'manual',
};

const fmt = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

export const FinanceBanks = () => {
  const { t } = useLingui();
  const tokenPair = useAtomStateValue(tokenPairState);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<FormState | null>(null);
  const [wiseModalOpen, setWiseModalOpen] = useState(false);
  const [wiseToken, setWiseToken] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingWise, setIsSyncingWise] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isDefined(tokenPair?.accessOrWorkspaceAgnosticToken?.token)) return;
    try {
      setError(null);
      const rows = await xeroFetch<BankAccount[]>(
        '/finance/bank-accounts',
        tokenPair,
      );

      setAccounts(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    }
  }, [tokenPair]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => setModal(emptyForm);

  const openEdit = (row: BankAccount) =>
    setModal({
      id: row.id,
      bankName: row.bankName,
      accountLabel: row.accountLabel ?? '',
      currencyCode: row.currencyCode,
      balance: String(row.balance),
      source: row.source,
    });

  const closeModal = () => setModal(null);

  const handleSave = async () => {
    if (!modal || !tokenPair) return;
    if (!modal.bankName.trim() || !modal.currencyCode) {
      setError(t`Bank name and currency required`);

      return;
    }
    setIsSaving(true);
    try {
      const parsedBalance = parseFloat(modal.balance.replace(/,/g, ''));
      const body = {
        bankName: modal.bankName.trim(),
        accountLabel: modal.accountLabel.trim() || undefined,
        currencyCode: modal.currencyCode,
        balance: !isNaN(parsedBalance) ? parsedBalance : 0,
        source: modal.source,
      };

      const path = modal.id
        ? `/finance/bank-accounts/${modal.id}`
        : '/finance/bank-accounts';
      const method = modal.id ? 'PUT' : 'POST';

      await xeroFetch(path, tokenPair, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setModal(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (row: BankAccount) => {
    if (!tokenPair) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm(t`Delete ${row.bankName} · ${row.currencyCode}?`)) return;
    try {
      await xeroFetch(`/finance/bank-accounts/${row.id}`, tokenPair, {
        method: 'DELETE',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleConnectWise = async () => {
    if (!tokenPair) return;
    const token = wiseToken.trim();

    // Wise personal tokens are UUIDs; reject obvious junk before hitting the API.
    if (token.length < 20) {
      setError(t`That doesn't look like a Wise API token. Paste the full Read-Only token from your Wise settings.`);

      return;
    }
    setIsSyncingWise(true);
    setError(null);
    setNotice(null);
    try {
      const res = await xeroFetch<{ synced: number; currencies: string[] }>(
        '/finance/wise/connect',
        tokenPair,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        },
      );

      setWiseModalOpen(false);
      setWiseToken('');
      await load();
      setNotice(
        res.synced > 0
          ? t`Wise connected — pulled ${res.synced} balance(s): ${res.currencies.join(', ')}`
          : t`Wise connected, but no balances were found on this account.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? `Wise connect failed: ${err.message}`
          : 'Failed to connect to Wise',
      );
    } finally {
      setIsSyncingWise(false);
    }
  };

  const handleSyncWise = async () => {
    if (!tokenPair) return;
    setIsSyncingWise(true);
    setError(null);
    setNotice(null);
    try {
      const res = await xeroFetch<{ synced: number; currencies: string[] }>(
        '/finance/wise/sync',
        tokenPair,
        { method: 'POST' },
      );

      await load();
      setNotice(t`Wise synced — ${res.synced} balance(s) updated.`);
    } catch (err) {
      setError(err instanceof Error ? `Wise sync failed: ${err.message}` : 'Sync failed');
    } finally {
      setIsSyncingWise(false);
    }
  };

  return (
    <>
      <PageTitle title={t`Bank Accounts | Waimin`} />
      <StyledContainer>
        <StyledHeader>
          <StyledHeadings>
            <StyledTitle>
              <Trans>Bank Accounts</Trans>
            </StyledTitle>
            <StyledSubtitle>
              <Trans>
                Track balances across banks and currencies. Wise balances will
                sync automatically once connected. Enter other balances manually.
              </Trans>
            </StyledSubtitle>
          </StyledHeadings>
          <div style={{ display: 'flex', gap: 12 }}>
            <StyledSecondaryButton onClick={() => setWiseModalOpen(true)} disabled={isSyncingWise}>
              <Trans>Connect Wise</Trans>
            </StyledSecondaryButton>
            {accounts.some((a) => a.source === 'wise') && (
              <StyledSecondaryButton onClick={handleSyncWise} disabled={isSyncingWise}>
                {isSyncingWise ? <Trans>Syncing…</Trans> : <Trans>↻ Sync Wise</Trans>}
              </StyledSecondaryButton>
            )}
            <StyledPrimaryButton onClick={openNew}>
              + <Trans>Add bank account</Trans>
            </StyledPrimaryButton>
          </div>
        </StyledHeader>

        {error && (
          <StyledCard style={{ padding: 16, color: '#b91c1c' }}>
            {error}
          </StyledCard>
        )}
        {notice && (
          <StyledCard
            style={{
              padding: 16,
              color: '#065f46',
              background: 'rgba(16,185,129,0.10)',
              borderColor: 'rgba(16,185,129,0.4)',
            }}
          >
            ✓ {notice}
          </StyledCard>
        )}

        <StyledCard>
          {accounts.length === 0 ? (
            <StyledEmpty>
              <p style={{ marginBottom: 8 }}>
                <Trans>No bank accounts yet.</Trans>
              </p>
              <p style={{ fontSize: 12 }}>
                <Trans>
                  Add each bank + currency combo you hold (e.g. BNZ NZD, UOB
                  HKD, UOB MYR, Wise USD).
                </Trans>
              </p>
            </StyledEmpty>
          ) : (
            <StyledTable>
              <thead>
                <tr>
                  <th>
                    <Trans>Bank</Trans>
                  </th>
                  <th>
                    <Trans>Label</Trans>
                  </th>
                  <th>
                    <Trans>Currency</Trans>
                  </th>
                  <th className="num">
                    <Trans>Balance</Trans>
                  </th>
                  <th>
                    <Trans>As of</Trans>
                  </th>
                  <th>
                    <Trans>Source</Trans>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.bankName}</strong>
                    </td>
                    <td>{row.accountLabel ?? '—'}</td>
                    <td>{row.currencyCode}</td>
                    <td className="num">
                      {fmt(Number(row.balance), row.currencyCode)}
                    </td>
                    <td>
                      {row.balanceAsOf
                        ? new Date(row.balanceAsOf).toLocaleDateString()
                        : '—'}
                    </td>
                    <td>
                      <StyledPill>{row.source}</StyledPill>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <StyledSecondaryButton onClick={() => openEdit(row)}>
                          <Trans>Edit</Trans>
                        </StyledSecondaryButton>
                        <StyledDangerButton onClick={() => handleDelete(row)}>
                          <Trans>Delete</Trans>
                        </StyledDangerButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </StyledTable>
          )}
        </StyledCard>
      </StyledContainer>

      {wiseModalOpen && (
        <StyledModalBackdrop onClick={() => setWiseModalOpen(false)}>
          <StyledModal onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: 18 }}>
              <Trans>Connect Wise</Trans>
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--t-font-color-tertiary)' }}>
              <Trans>
                Create a <strong>Read-Only</strong> API token in your Wise account settings and paste it here. We will securely store this token and use it to sync your multi-currency balances automatically.
              </Trans>
            </p>
            <StyledFormRow>
              <span>
                <Trans>Wise Personal API Token</Trans> *
              </span>
              <StyledInput
                autoFocus
                type="password"
                placeholder="Paste token here…"
                value={wiseToken}
                onChange={(e) => setWiseToken(e.target.value)}
              />
            </StyledFormRow>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <StyledSecondaryButton type="button" onClick={() => setWiseModalOpen(false)}>
                <Trans>Cancel</Trans>
              </StyledSecondaryButton>
              <StyledPrimaryButton onClick={handleConnectWise} disabled={isSyncingWise || !wiseToken.trim()}>
                {isSyncingWise ? <Trans>Connecting…</Trans> : <Trans>Connect & Sync</Trans>}
              </StyledPrimaryButton>
            </div>
          </StyledModal>
        </StyledModalBackdrop>
      )}

      {modal && (
        <StyledModalBackdrop onClick={closeModal}>
          <StyledModal onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: 18 }}>
              {modal.id ? <Trans>Edit bank account</Trans> : <Trans>Add bank account</Trans>}
            </h2>

            <StyledFormRow>
              <span>
                <Trans>Bank name</Trans> *
              </span>
              <StyledInput
                autoFocus
                placeholder="BNZ, UOB, Wise, Statrys…"
                value={modal.bankName}
                onChange={(e) =>
                  setModal({ ...modal, bankName: e.target.value })
                }
              />
            </StyledFormRow>

            <StyledFormRow>
              <span>
                <Trans>Account label (optional)</Trans>
              </span>
              <StyledInput
                placeholder="Main, Payroll, Reserve…"
                value={modal.accountLabel}
                onChange={(e) =>
                  setModal({ ...modal, accountLabel: e.target.value })
                }
              />
            </StyledFormRow>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
              <StyledFormRow>
                <span>
                  <Trans>Currency</Trans> *
                </span>
                <StyledSelect
                  value={modal.currencyCode}
                  onChange={(e) =>
                    setModal({ ...modal, currencyCode: e.target.value })
                  }
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </StyledSelect>
              </StyledFormRow>

              <StyledFormRow>
                <span>
                  <Trans>Current balance</Trans>
                </span>
                <StyledInput
                  type="number"
                  step="0.01"
                  value={modal.balance}
                  onChange={(e) =>
                    setModal({ ...modal, balance: e.target.value })
                  }
                />
              </StyledFormRow>
            </div>

            <StyledFormRow>
              <span>
                <Trans>Source</Trans>
              </span>
              <StyledSelect
                value={modal.source}
                onChange={(e) =>
                  setModal({
                    ...modal,
                    source: e.target.value as BankAccount['source'],
                  })
                }
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </StyledSelect>
            </StyledFormRow>

            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                marginTop: 8,
              }}
            >
              <StyledSecondaryButton onClick={closeModal}>
                <Trans>Cancel</Trans>
              </StyledSecondaryButton>
              <StyledPrimaryButton onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Trans>Saving…</Trans> : <Trans>Save</Trans>}
              </StyledPrimaryButton>
            </div>
          </StyledModal>
        </StyledModalBackdrop>
      )}
    </>
  );
};
