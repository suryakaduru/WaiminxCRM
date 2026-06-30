import { styled } from '@linaria/react';
import { Trans, useLingui } from '@lingui/react/macro';

import { PageTitle } from '@/ui/utilities/page-title/components/PageTitle';
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

type WidgetCard = {
  label: string;
  value: string;
  hint: string;
};

const BANK_CARDS: WidgetCard[] = [
  { label: 'BNZ', value: '—', hint: 'Manual entry — coming soon' },
  { label: 'Wise', value: '—', hint: 'Auto-sync (Phase 2)' },
  { label: 'Statrys', value: '—', hint: 'Auto-sync (Phase 2)' },
  { label: 'UOB', value: '—', hint: 'Manual entry — coming soon' },
];

const KPI_CARDS: WidgetCard[] = [
  { label: 'Total cash', value: '—', hint: 'Sum across banks' },
  { label: 'Accounts receivable', value: '—', hint: 'From Xero (Phase 1)' },
  { label: 'Accounts payable', value: '—', hint: 'From Xero (Phase 1)' },
  { label: 'Net 30-day forecast', value: '—', hint: 'Cash flow projection' },
];

export const FinanceDashboard = () => {
  const { t } = useLingui();

  return (
    <>
      <PageTitle title={t`Finance Dashboard | Waimin`} />
      <StyledContainer>
        <StyledHeader>
          <StyledTitle>
            <Trans>Finance Dashboard</Trans>
          </StyledTitle>
          <StyledSubtitle>
            <Trans>
              Real-time cash position, receivables, payables and bank balances.
              Phase 0 skeleton — data wiring lands in Phase 1.
            </Trans>
          </StyledSubtitle>
        </StyledHeader>

        <StyledSection>
          <StyledSectionTitle>
            <Trans>Cash position</Trans>
          </StyledSectionTitle>
          <StyledGrid>
            {KPI_CARDS.map((card) => (
              <StyledCard key={card.label}>
                <StyledCardLabel>{card.label}</StyledCardLabel>
                <StyledCardValue>{card.value}</StyledCardValue>
                <StyledCardHint>{card.hint}</StyledCardHint>
              </StyledCard>
            ))}
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
                <StyledCardValue>{card.value}</StyledCardValue>
                <StyledCardHint>{card.hint}</StyledCardHint>
              </StyledCard>
            ))}
          </StyledGrid>
        </StyledSection>

        <StyledSection>
          <StyledSectionTitle>
            <Trans>Upcoming</Trans>
          </StyledSectionTitle>
          <StyledGrid>
            <StyledCard>
              <StyledCardLabel>
                <Trans>Xero sync</Trans>
              </StyledCardLabel>
              <StyledCardValue>Phase 1</StyledCardValue>
              <StyledCardHint>
                <Trans>Invoices, bills, payments, contacts</Trans>
              </StyledCardHint>
            </StyledCard>
            <StyledCard>
              <StyledCardLabel>
                <Trans>Reminders</Trans>
              </StyledCardLabel>
              <StyledCardValue>Phase 4</StyledCardValue>
              <StyledCardHint>
                <Trans>Payroll, GST, rent, reconciliation</Trans>
              </StyledCardHint>
            </StyledCard>
            <StyledCard>
              <StyledCardLabel>
                <Trans>Cash flow forecast</Trans>
              </StyledCardLabel>
              <StyledCardValue>Phase 3</StyledCardValue>
              <StyledCardHint>
                <Trans>Weekly + monthly projection</Trans>
              </StyledCardHint>
            </StyledCard>
            <StyledCard>
              <StyledCardLabel>
                <Trans>Aging reports</Trans>
              </StyledCardLabel>
              <StyledCardValue>Phase 3</StyledCardValue>
              <StyledCardHint>
                <Trans>Receivables + payables by bucket</Trans>
              </StyledCardHint>
            </StyledCard>
          </StyledGrid>
        </StyledSection>
      </StyledContainer>
    </>
  );
};
