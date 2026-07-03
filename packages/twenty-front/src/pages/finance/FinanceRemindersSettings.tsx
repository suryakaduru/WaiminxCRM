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
    case '0 8 * * 1': return 'Weekly';
    case '0 8 1 * *': return 'Monthly';
    case '0 8 1 */3 *': return 'Quarterly';
    case '0 8 1 1 *': return 'Yearly';
    default: return cron;
  }
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
      await xeroFetch('/finance/reminders', tokenPair, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modal),
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

  const handleDelete = async (id: string) => {
    if (!tokenPair) return;
    if (!window.confirm(t`Delete this reminder?`)) return;
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
                  <td>{new Date(row.nextDueDate).toLocaleDateString()}</td>
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
                <option value="bank_recon">Bank Reconciliation</option>
                <option value="custom">Custom</option>
              </StyledSelect>
            </StyledFormRow>
            <StyledFormRow>
              <span><Trans>Frequency</Trans></span>
              <StyledSelect
                value={modal.frequencyCron || '0 8 1 * *'}
                onChange={(e) => setModal({ ...modal, frequencyCron: e.target.value })}
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
