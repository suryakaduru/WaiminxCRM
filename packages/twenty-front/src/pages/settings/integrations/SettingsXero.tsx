import { tokenPairState } from '@/auth/states/tokenPairState';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { xeroFetch } from '@/xero-integration/utils/xero-api';
import { styled } from '@linaria/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { H2Title } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';

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

const StyledBanner = styled.div`
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
  const tokenPair = useAtomStateValue(tokenPairState);
  const [status, setStatus] = useState<XeroStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await xeroFetch<XeroStatus>(
        '/auth/xero/status',
        tokenPair,
      );

      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [tokenPair]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handleConnect = async () => {
    try {
      const { authorizeUrl } = await xeroFetch<{ authorizeUrl: string }>(
        '/auth/xero/connect',
        tokenPair,
      );

      window.location.href = authorizeUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Xero flow');
    }
  };

  const handleDisconnect = async (tenantId: string) => {
    try {
      await xeroFetch(`/auth/xero/connections/${tenantId}`, tokenPair, {
        method: 'DELETE',
      });
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
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
            <StyledBanner>
              <Trans>
                Xero integration is not enabled on this server. Set
                XERO_INTEGRATION_ENABLED=true and provide XERO_CLIENT_ID +
                XERO_CLIENT_SECRET in the server env.
              </Trans>
            </StyledBanner>
          )}

          {error && (
            <StyledBanner>
              <Trans>Failed to load Xero status: {error}</Trans>
            </StyledBanner>
          )}

          <StyledActions>
            <Button
              variant="primary"
              accent="blue"
              title={t`Connect Xero`}
              onClick={() => void handleConnect()}
              disabled={status?.enabled === false}
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
