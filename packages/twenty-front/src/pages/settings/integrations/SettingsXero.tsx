import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { styled } from '@linaria/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath, isDefined } from 'twenty-shared/utils';
import { H2Title } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type XeroConnection = {
  tenantId: string;
  tenantName: string | null;
  tenantType: string | null;
  scopes: string;
  accessTokenExpiresAt: string;
  createdAt: string;
  updatedAt: string;
};

type XeroStatus = {
  enabled: boolean;
  connections: XeroConnection[];
};

const StyledList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  list-style: none;
  margin: 0;
  padding: 0;
`;

const StyledConnectionRow = styled.li`
  align-items: center;
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  gap: ${themeCssVariables.spacing[4]};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
`;

const StyledConnectionInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const StyledConnectionTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: 14px;
  font-weight: 500;
`;

const StyledConnectionMeta = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 12px;
`;

const StyledEmpty = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 14px;
  margin: 0;
`;

const StyledDisabledBanner = styled.div`
  background: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${themeCssVariables.font.color.secondary};
  font-size: 14px;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
`;

const StyledActions = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const formatDate = (value: string) => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

export const SettingsXero = () => {
  const { t } = useLingui();
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);
  const workspaceId = currentWorkspace?.id;
  const [status, setStatus] = useState<XeroStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!isDefined(workspaceId)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/auth/xero/status?workspaceId=${workspaceId}`,
      );

      if (!response.ok) {
        throw new Error(`Status request failed: ${response.status}`);
      }

      const data = (await response.json()) as XeroStatus;

      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handleConnect = () => {
    if (!isDefined(workspaceId)) {
      return;
    }
    window.location.href = `${REACT_APP_SERVER_BASE_URL}/auth/xero/connect?workspaceId=${workspaceId}`;
  };

  const handleDisconnect = async (tenantId: string) => {
    if (!isDefined(workspaceId)) {
      return;
    }

    await fetch(
      `${REACT_APP_SERVER_BASE_URL}/auth/xero/connections/${tenantId}?workspaceId=${workspaceId}`,
      { method: 'DELETE' },
    );

    await fetchStatus();
  };

  return (
    <SettingsPageLayout
      title={t`Xero`}
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.General),
        },
        { children: <Trans>Integrations</Trans> },
        { children: <Trans>Xero</Trans> },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <H2Title
            title={t`Xero accounting`}
            description={t`Connect your Xero organisation to sync invoices, bills, payments and contacts into Waimin.`}
          />

          {status && !status.enabled && (
            <StyledDisabledBanner>
              <Trans>
                Xero integration is not enabled on this server. Set
                XERO_INTEGRATION_ENABLED=true and provide XERO_CLIENT_ID +
                XERO_CLIENT_SECRET in the server env.
              </Trans>
            </StyledDisabledBanner>
          )}

          {error && (
            <StyledDisabledBanner>
              <Trans>Failed to load Xero status: {error}</Trans>
            </StyledDisabledBanner>
          )}

          <StyledActions>
            <Button
              variant="primary"
              accent="blue"
              title={t`Connect Xero`}
              onClick={handleConnect}
              disabled={!isDefined(workspaceId) || status?.enabled === false}
            />
            <Button
              variant="secondary"
              title={t`Refresh`}
              onClick={() => void fetchStatus()}
              disabled={isLoading}
            />
          </StyledActions>
        </Section>

        <Section>
          <H2Title
            title={t`Connected organisations`}
            description={t`Each Xero organisation authorized for this workspace.`}
          />
          {status && status.connections.length > 0 ? (
            <StyledList>
              {status.connections.map((connection) => (
                <StyledConnectionRow key={connection.tenantId}>
                  <StyledConnectionInfo>
                    <StyledConnectionTitle>
                      {connection.tenantName ?? connection.tenantId}
                    </StyledConnectionTitle>
                    <StyledConnectionMeta>
                      <Trans>Type:</Trans>{' '}
                      {connection.tenantType ?? '—'} ·{' '}
                      <Trans>Token expires:</Trans>{' '}
                      {formatDate(connection.accessTokenExpiresAt)}
                    </StyledConnectionMeta>
                  </StyledConnectionInfo>
                  <Button
                    variant="secondary"
                    accent="danger"
                    title={t`Disconnect`}
                    onClick={() => void handleDisconnect(connection.tenantId)}
                  />
                </StyledConnectionRow>
              ))}
            </StyledList>
          ) : (
            <StyledEmpty>
              <Trans>No Xero organisations connected yet.</Trans>
            </StyledEmpty>
          )}
        </Section>
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
