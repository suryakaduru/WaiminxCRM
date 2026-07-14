import { PageTitle } from '@/ui/utilities/page-title/components/PageTitle';
import { styled } from '@linaria/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { FinanceRemindersSettings } from './FinanceRemindersSettings';

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

export const FinanceReminders = () => {
  const { t } = useLingui();
  const navigate = useNavigate();

  return (
    <>
      <PageTitle title={t`Reminders | Waimin`} />
      <StyledContainer>
        <StyledHeader>
          <StyledHeadings>
            <StyledTitle>
              <Trans>Reminders & Recurring Payments</Trans>
            </StyledTitle>
            <StyledSubtitle>
              <Trans>
                Set up recurring finance tasks — Payroll, GST, Rent, loans — and
                get a Teams alert plus a CRM task before each one is due. Nothing
                slips through.
              </Trans>
            </StyledSubtitle>
          </StyledHeadings>
          <StyledBackButton onClick={() => navigate(AppPath.FinanceDashboard)}>
            <Trans>← Back to Dashboard</Trans>
          </StyledBackButton>
        </StyledHeader>
        <FinanceRemindersSettings />
      </StyledContainer>
    </>
  );
};
