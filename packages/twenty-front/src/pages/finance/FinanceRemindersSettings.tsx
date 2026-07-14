import { tokenPairState } from '@/auth/states/tokenPairState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { xeroFetch } from '@/xero-integration/utils/xero-api';
import { styled } from '@linaria/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

type Reminder = {
  id: string;
  title: string;
  type: string;
  frequencyCron: string;
  nextDueDate: string;
  isActive: boolean;
  assigneeId?: string;
};

type Accountant = {
  id: string;
  name: string;
};

type MandatoryPayment = {
  id: string;
  type: string;
  label: string;
  currencyCode: string;
  amount: number;
  frequencyCron: string;
  nextDueDate: string;
  bankAccountId?: string | null;
  isActive: boolean;
};

type BankAccount = {
  id: string;
  bankName: string;
  currencyCode: string;
  accountLabel: string | null;
};

const MANDATORY_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'payroll', label: 'Payroll' },
  { value: 'gst', label: 'GST' },
  { value: 'loan', label: 'Loan' },
  { value: 'rent', label: 'Rent' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'trust_account', label: 'Trust Account' },
  { value: 'inland_revenue', label: 'Inland Revenue' },
];

const emptyMandatory = {
  type: 'payroll',
  label: '',
  currencyCode: 'NZD',
  amount: 0,
  frequencyCron: '0 8 1 * *',
  nextDueDate: new Date().toISOString().split('T')[0],
  bankAccountId: '',
  isActive: true,
};

const StyledSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;

const StyledSectionHeader = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
`;

const StyledSectionTitle = styled.h2`
  color: ${themeCssVariables.font.color.primary};
  font-size: 16px;
  font-weight: 600;
  margin: 0;
`;

const StyledSectionDescription = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 13px;
  margin: 4px 0 0;
  max-width: 600px;
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

  & th, & td {
    border-bottom: 1px solid ${themeCssVariables.border.color.light};
    font-size: 13px;
    padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
    text-align: left;
  }

  & th {
    background: ${themeCssVariables.background.secondary};
    color: ${themeCssVariables.font.color.tertiary};
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }
`;

const StyledPrimaryButton = styled.button`
  background: #2563eb;
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[3]};
  &:hover { background: #1d4ed8; }
`;

const StyledSecondaryButton = styled.button`
  background: transparent;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-size: 13px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[3]};
  &:hover { background: ${themeCssVariables.background.secondary}; }
`;

const StyledEmpty = styled.div`
  padding: ${themeCssVariables.spacing[6]};
  text-align: center;
  color: ${themeCssVariables.font.color.tertiary};
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

const getFriendlyFrequency = (cron: string) => {
  switch (cron) {
    case '0 8 * * *': return 'Daily';
    case '0 8 * * 1': return 'Weekly (Mon)';
    case '0 8 * * 5': return 'Weekly (Fri)';
    case '0 8 1 * *': return 'Monthly — 1st';
    case '0 8 15 * *': return 'Monthly — 15th';
    case '0 8 L * *': return 'Monthly — last day';
    case '0 8 1 */3 *': return 'Quarterly';
    case '0 8 1 1 *': return 'Yearly';
    default: return cron;
  }
};

const MANDATORY_SCHEDULE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '0 8 1 * *', label: 'Monthly — beginning (1st)' },
  { value: '0 8 15 * *', label: 'Monthly — middle (15th)' },
  { value: '0 8 L * *', label: 'Monthly — end (last day)' },
  { value: '0 8 * * 5', label: 'Weekly (Friday)' },
  { value: '0 8 1 */3 *', label: 'Quarterly' },
  { value: '0 8 1 1 *', label: 'Yearly' },
];

// The reminder's send time lives in the cron string (fields: "min hour ...").
// These read/write just that time so the form can expose a time picker.
const cronToTime = (cron: string): string => {
  const parts = (cron || '0 8 1 * *').split(' ');
  const min = parts[0]?.padStart(2, '0') ?? '00';
  const hour = parts[1]?.padStart(2, '0') ?? '08';

  return `${hour}:${min}`;
};

const setCronTime = (cron: string, time: string): string => {
  const parts = (cron || '0 8 1 * *').split(' ');
  const [hour, min] = time.split(':');

  parts[0] = String(Number(min));
  parts[1] = String(Number(hour));

  return parts.join(' ');
};

// Combine a date (YYYY-MM-DD or ISO) with a HH:MM time into a full ISO stamp,
// so nextDueDate fires at the chosen time, not midnight.
const stampDateWithTime = (dateIso: string, time: string): string => {
  const datePart = new Date(dateIso).toISOString().split('T')[0];
  const [hour, min] = time.split(':');
  const d = new Date(`${datePart}T00:00:00`);

  d.setHours(Number(hour), Number(min), 0, 0);

  return d.toISOString();
};

const emptyForm = {
  title: '',
  type: 'payroll',
  frequencyCron: '0 8 1 * *',
  nextDueDate: new Date().toISOString().split('T')[0],
  isActive: true,
  assigneeId: '',
};

export const FinanceRemindersSettings = () => {
  const { t } = useLingui();
  const tokenPair = useAtomStateValue(tokenPairState);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [accountants, setAccountants] = useState<Accountant[]>([]);
  const [modal, setModal] = useState<Partial<Reminder> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [teamsWebhook, setTeamsWebhook] = useState('');
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [webhookBusy, setWebhookBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mandatoryPayments, setMandatoryPayments] = useState<MandatoryPayment[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [mpModal, setMpModal] = useState<Partial<MandatoryPayment> | null>(null);
  const [isSavingMp, setIsSavingMp] = useState(false);

  const load = useCallback(async () => {
    if (!isDefined(tokenPair?.accessOrWorkspaceAgnosticToken?.token)) return;
    try {
      setError(null);
      // Reminders are the core data; accountants (assignee list) are optional —
      // don't let an assignee-lookup failure blank the whole page.
      const rows = await xeroFetch<Reminder[]>('/finance/reminders', tokenPair);

      setReminders(rows);

      const accs = await xeroFetch<Accountant[]>(
        '/finance/accountants',
        tokenPair,
      ).catch(() => [] as Accountant[]);

      setAccountants(accs);

      const settings = await xeroFetch<{ teamsWebhookUrl: string | null }>(
        '/finance/notification-settings',
        tokenPair,
      ).catch(() => ({ teamsWebhookUrl: null }));

      setTeamsWebhook(settings.teamsWebhookUrl ?? '');

      const [mps, bankList] = await Promise.all([
        xeroFetch<MandatoryPayment[]>('/finance/mandatory-payments', tokenPair).catch(
          () => [] as MandatoryPayment[],
        ),
        xeroFetch<BankAccount[]>('/finance/bank-accounts', tokenPair).catch(
          () => [] as BankAccount[],
        ),
      ]);

      setMandatoryPayments(mps);
      setBanks(bankList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    }
  }, [tokenPair]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (!modal || !tokenPair) return;
    if (!modal.title || !modal.frequencyCron) return setError(t`Title and cron required`);

    setIsSaving(true);
    try {
      // stamp nextDueDate with the send time so it fires at the chosen time,
      // and record the creator's timezone so recurrence fires at that same
      // wall-clock time regardless of the server's timezone.
      const payload = {
        ...modal,
        nextDueDate: stampDateWithTime(
          modal.nextDueDate || new Date().toISOString(),
          cronToTime(modal.frequencyCron || '0 8 1 * *'),
        ),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      await xeroFetch('/finance/reminders', tokenPair, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setModal(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWebhook = async () => {
    if (!tokenPair) return;
    setWebhookBusy(true);
    setError(null);
    setNotice(null);
    try {
      await xeroFetch('/finance/notification-settings', tokenPair, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamsWebhookUrl: teamsWebhook.trim() || null }),
      });
      setWebhookSaved(true);
      setNotice(t`Teams webhook saved.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setWebhookBusy(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!tokenPair) return;
    setWebhookBusy(true);
    setError(null);
    setNotice(null);
    try {
      await xeroFetch('/finance/notification-settings/test', tokenPair, {
        method: 'POST',
      });
      setNotice(t`Test message sent — check your Teams channel.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setWebhookBusy(false);
    }
  };

  const handleSaveMandatory = async () => {
    if (!mpModal || !tokenPair) return;
    if (!mpModal.label || !mpModal.currencyCode) {
      return setError(t`Label and currency required`);
    }
    setIsSavingMp(true);
    setError(null);
    try {
      await xeroFetch('/finance/mandatory-payments', tokenPair, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...mpModal,
          amount: Number(mpModal.amount ?? 0),
          bankAccountId: mpModal.bankAccountId || undefined,
        }),
      });
      setMpModal(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSavingMp(false);
    }
  };

  const handleDeleteMandatory = async (id: string) => {
    if (!tokenPair) return;
    if (!window.confirm(`Delete this mandatory payment?`)) return;
    try {
      await xeroFetch(`/finance/mandatory-payments/${id}`, tokenPair, {
        method: 'DELETE',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!tokenPair) return;
    if (!window.confirm(`Delete this reminder?`)) return;
    try {
      await xeroFetch(`/finance/reminders/${id}`, tokenPair, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <StyledSection>
      <StyledSectionHeader>
        <div>
          <StyledSectionTitle>
            <Trans>Automated Reminders</Trans>
          </StyledSectionTitle>
          <StyledSectionDescription>
            <Trans>Configure recurring finance tasks like Payroll, GST, or Rent. They will automatically appear in your native task list before they are due.</Trans>
          </StyledSectionDescription>
        </div>
        <StyledPrimaryButton onClick={() => setModal(emptyForm)}>
          + <Trans>Add Reminder</Trans>
        </StyledPrimaryButton>
      </StyledSectionHeader>

      {error && <StyledCard style={{ padding: 16, color: '#b91c1c' }}>{error}</StyledCard>}
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

      <StyledCard style={{ padding: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
          <Trans>Microsoft Teams alerts</Trans>
        </div>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px', maxWidth: 640 }}>
          <Trans>
            Paste a Teams Incoming Webhook URL. When a reminder is due, we post a
            message to that Teams channel (in addition to creating a CRM task).
            In Teams: channel → ⋯ → Connectors → Incoming Webhook → Create → copy URL.
          </Trans>
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <StyledInput
            style={{ flex: 1 }}
            placeholder="https://outlook.office.com/webhook/..."
            value={teamsWebhook}
            onChange={(e) => {
              setTeamsWebhook(e.target.value);
              setWebhookSaved(false);
            }}
          />
          <StyledPrimaryButton onClick={handleSaveWebhook} disabled={webhookBusy}>
            {webhookBusy ? <Trans>…</Trans> : <Trans>Save</Trans>}
          </StyledPrimaryButton>
          <StyledSecondaryButton
            onClick={handleTestWebhook}
            disabled={webhookBusy || !webhookSaved}
            title={!webhookSaved ? t`Save the webhook first` : ''}
          >
            <Trans>Send test</Trans>
          </StyledSecondaryButton>
        </div>
      </StyledCard>

      <StyledCard>
        {reminders.length === 0 ? (
          <StyledEmpty>
            <Trans>No automated reminders configured yet.</Trans>
          </StyledEmpty>
        ) : (
          <StyledTable>
            <thead>
              <tr>
                <th><Trans>Title</Trans></th>
                <th><Trans>Type</Trans></th>
                <th><Trans>Frequency</Trans></th>
                <th><Trans>Next Due</Trans></th>
                <th><Trans>Status</Trans></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reminders.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.title}</strong></td>
                  <td>{row.type}</td>
                  <td>{getFriendlyFrequency(row.frequencyCron)}</td>
                  <td>{new Date(row.nextDueDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td>{row.isActive ? <Trans>Active</Trans> : <Trans>Paused</Trans>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <StyledSecondaryButton onClick={() => setModal(row)}>
                        <Trans>Edit</Trans>
                      </StyledSecondaryButton>
                      <StyledSecondaryButton style={{ color: '#dc2626' }} onClick={() => handleDelete(row.id)}>
                        <Trans>Delete</Trans>
                      </StyledSecondaryButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </StyledTable>
        )}
      </StyledCard>

      <StyledSectionHeader style={{ marginTop: 24 }}>
        <div>
          <StyledSectionTitle>
            <Trans>Mandatory Payments</Trans>
          </StyledSectionTitle>
          <StyledSectionDescription>
            <Trans>
              Recurring obligations (Payroll, GST, Loan, Rent, Credit Card, Trust
              Account, Inland Revenue) with a set amount. Any instance due by the
              planner's Friday shows as a locked outflow in the weekly position.
            </Trans>
          </StyledSectionDescription>
        </div>
        <StyledPrimaryButton onClick={() => setMpModal(emptyMandatory)}>
          + <Trans>Add Mandatory Payment</Trans>
        </StyledPrimaryButton>
      </StyledSectionHeader>

      <StyledCard>
        {mandatoryPayments.length === 0 ? (
          <StyledEmpty>
            <Trans>No mandatory payments configured yet.</Trans>
          </StyledEmpty>
        ) : (
          <StyledTable>
            <thead>
              <tr>
                <th><Trans>Type</Trans></th>
                <th><Trans>Label</Trans></th>
                <th><Trans>Amount</Trans></th>
                <th><Trans>Frequency</Trans></th>
                <th><Trans>Next Due</Trans></th>
                <th><Trans>Bank</Trans></th>
                <th><Trans>Status</Trans></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mandatoryPayments.map((row) => {
                const bank = banks.find((b) => b.id === row.bankAccountId);
                const typeLabel =
                  MANDATORY_TYPE_OPTIONS.find((o) => o.value === row.type)?.label ??
                  row.type;
                return (
                  <tr key={row.id}>
                    <td><strong>{typeLabel}</strong></td>
                    <td>{row.label}</td>
                    <td>{row.currencyCode} {Number(row.amount).toLocaleString()}</td>
                    <td>{getFriendlyFrequency(row.frequencyCron)}</td>
                    <td>{new Date(row.nextDueDate).toLocaleDateString()}</td>
                    <td>{bank ? bank.bankName : '—'}</td>
                    <td>{row.isActive ? <Trans>Active</Trans> : <Trans>Paused</Trans>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <StyledSecondaryButton onClick={() => setMpModal(row)}>
                          <Trans>Edit</Trans>
                        </StyledSecondaryButton>
                        <StyledSecondaryButton style={{ color: '#dc2626' }} onClick={() => handleDeleteMandatory(row.id)}>
                          <Trans>Delete</Trans>
                        </StyledSecondaryButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </StyledTable>
        )}
      </StyledCard>

      {mpModal && (
        <StyledModalBackdrop onClick={() => setMpModal(null)}>
          <StyledModal onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: 18 }}>
              {mpModal.id ? <Trans>Edit Mandatory Payment</Trans> : <Trans>Add Mandatory Payment</Trans>}
            </h2>
            <StyledFormRow>
              <span><Trans>Type</Trans></span>
              <StyledSelect
                value={mpModal.type || 'payroll'}
                onChange={(e) => setMpModal({ ...mpModal, type: e.target.value })}
              >
                {MANDATORY_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </StyledSelect>
            </StyledFormRow>
            <StyledFormRow>
              <span><Trans>Label</Trans></span>
              <StyledInput
                autoFocus
                placeholder="e.g. Fortnightly payroll"
                value={mpModal.label || ''}
                onChange={(e) => setMpModal({ ...mpModal, label: e.target.value })}
              />
            </StyledFormRow>
            <div style={{ display: 'flex', gap: 12 }}>
              <StyledFormRow style={{ flex: 1 }}>
                <span><Trans>Currency</Trans></span>
                <StyledInput
                  value={mpModal.currencyCode || 'NZD'}
                  onChange={(e) => setMpModal({ ...mpModal, currencyCode: e.target.value.toUpperCase() })}
                />
              </StyledFormRow>
              <StyledFormRow style={{ flex: 2 }}>
                <span><Trans>Amount</Trans></span>
                <StyledInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={mpModal.amount ?? 0}
                  onChange={(e) => setMpModal({ ...mpModal, amount: Number(e.target.value) })}
                />
              </StyledFormRow>
            </div>
            <StyledFormRow>
              <span><Trans>Schedule</Trans></span>
              <StyledSelect
                value={mpModal.frequencyCron || '0 8 1 * *'}
                onChange={(e) => setMpModal({ ...mpModal, frequencyCron: e.target.value })}
              >
                {MANDATORY_SCHEDULE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </StyledSelect>
            </StyledFormRow>
            <StyledFormRow>
              <span><Trans>Active from (first due)</Trans></span>
              <StyledInput
                type="date"
                value={mpModal.nextDueDate ? new Date(mpModal.nextDueDate).toISOString().split('T')[0] : ''}
                onChange={(e) => setMpModal({ ...mpModal, nextDueDate: e.target.value })}
              />
            </StyledFormRow>
            <StyledFormRow>
              <span><Trans>Pay From Bank</Trans></span>
              <StyledSelect
                value={mpModal.bankAccountId || ''}
                onChange={(e) => setMpModal({ ...mpModal, bankAccountId: e.target.value || undefined })}
              >
                <option value=""><Trans>— optional —</Trans></option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>{b.bankName}{b.accountLabel ? ` · ${b.accountLabel}` : ''} ({b.currencyCode})</option>
                ))}
              </StyledSelect>
            </StyledFormRow>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <StyledSecondaryButton onClick={() => setMpModal(null)}><Trans>Cancel</Trans></StyledSecondaryButton>
              <StyledPrimaryButton onClick={handleSaveMandatory} disabled={isSavingMp}>
                {isSavingMp ? <Trans>Saving...</Trans> : <Trans>Save</Trans>}
              </StyledPrimaryButton>
            </div>
          </StyledModal>
        </StyledModalBackdrop>
      )}

      {modal && (
        <StyledModalBackdrop onClick={() => setModal(null)}>
          <StyledModal onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: 18 }}>
              {modal.id ? <Trans>Edit Reminder</Trans> : <Trans>Add Reminder</Trans>}
            </h2>
            <StyledFormRow>
              <span><Trans>Title</Trans></span>
              <StyledInput
                autoFocus
                placeholder="e.g. Monthly Payroll"
                value={modal.title || ''}
                onChange={(e) => setModal({ ...modal, title: e.target.value })}
              />
            </StyledFormRow>
            <StyledFormRow>
              <span><Trans>Type</Trans></span>
              <StyledSelect
                value={modal.type || 'payroll'}
                onChange={(e) => setModal({ ...modal, type: e.target.value })}
              >
                <option value="payroll">Payroll</option>
                <option value="gst">GST</option>
                <option value="rent">Rent</option>
                <option value="loan">Loan</option>
                <option value="credit_card">Credit Card</option>
                <option value="trust_account">Trust Account</option>
                <option value="inland_revenue">Inland Revenue</option>
                <option value="bank_recon">Bank Reconciliation</option>
                <option value="custom">Custom</option>
              </StyledSelect>
            </StyledFormRow>
            <StyledFormRow>
              <span><Trans>Frequency</Trans></span>
              <StyledSelect
                value={
                  // compare ignoring the time fields so the preset stays selected
                  setCronTime(modal.frequencyCron || '0 8 1 * *', '08:00')
                }
                onChange={(e) =>
                  // keep the chosen send time when switching frequency
                  setModal({
                    ...modal,
                    frequencyCron: setCronTime(
                      e.target.value,
                      cronToTime(modal.frequencyCron || '0 8 1 * *'),
                    ),
                  })
                }
              >
                <option value="0 8 * * *">Daily</option>
                <option value="0 8 * * 1">Weekly</option>
                <option value="0 8 1 * *">Monthly</option>
                <option value="0 8 1 */3 *">Quarterly</option>
                <option value="0 8 1 1 *">Yearly</option>
              </StyledSelect>
            </StyledFormRow>
            <StyledFormRow>
              <span><Trans>Next Due Date</Trans></span>
              <StyledInput
                type="date"
                value={modal.nextDueDate ? new Date(modal.nextDueDate).toISOString().split('T')[0] : ''}
                onChange={(e) => setModal({ ...modal, nextDueDate: new Date(e.target.value).toISOString() })}
              />
            </StyledFormRow>
            <StyledFormRow>
              <span><Trans>Send time</Trans></span>
              <StyledInput
                type="time"
                value={cronToTime(modal.frequencyCron || '0 8 1 * *')}
                onChange={(e) =>
                  setModal({
                    ...modal,
                    frequencyCron: setCronTime(
                      modal.frequencyCron || '0 8 1 * *',
                      e.target.value,
                    ),
                  })
                }
              />
            </StyledFormRow>
            <StyledFormRow>
              <span><Trans>Assign To</Trans></span>
              <StyledSelect
                value={modal.assigneeId || ''}
                onChange={(e) => setModal({ ...modal, assigneeId: e.target.value || undefined })}
              >
                <option value=""><Trans>Unassigned</Trans></option>
                {accountants.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </StyledSelect>
            </StyledFormRow>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <StyledSecondaryButton onClick={() => setModal(null)}><Trans>Cancel</Trans></StyledSecondaryButton>
              <StyledPrimaryButton onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Trans>Saving...</Trans> : <Trans>Save Reminder</Trans>}
              </StyledPrimaryButton>
            </div>
          </StyledModal>
        </StyledModalBackdrop>
      )}
    </StyledSection>
  );
};
