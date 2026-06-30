import { useSignInUp } from '@/auth/sign-in-up/hooks/useSignInUp';
import { useSignInUpForm } from '@/auth/sign-in-up/hooks/useSignInUpForm';
import {
  SignInUpStep,
  signInUpStepState,
} from '@/auth/states/signInUpStepState';
import { workspacePublicDataState } from '@/auth/states/workspacePublicDataState';
import { styled } from '@linaria/react';

import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

import { EmailVerificationSent } from '@/auth/sign-in-up/components/EmailVerificationSent';
import { FooterNote } from '@/auth/sign-in-up/components/FooterNote';
import { SignInUpGlobalScopeForm } from '@/auth/sign-in-up/components/SignInUpGlobalScopeForm';
import { SignInUpWorkspaceScopeForm } from '@/auth/sign-in-up/components/SignInUpWorkspaceScopeForm';
import { WorkspaceSelectionFooter } from '@/auth/sign-in-up/components/WorkspaceSelectionFooter';
import { SignInUpSSOIdentityProviderSelection } from '@/auth/sign-in-up/components/internal/SignInUpSSOIdentityProviderSelection';
import { SignInUpWorkspaceScopeFormEffect } from '@/auth/sign-in-up/components/internal/SignInUpWorkspaceScopeFormEffect';
import { isMultiWorkspaceEnabledState } from '@/client-config/states/isMultiWorkspaceEnabledState';
import { useGetPublicWorkspaceDataByDomain } from '@/domain-manager/hooks/useGetPublicWorkspaceDataByDomain';
import { useIsCurrentLocationOnAWorkspace } from '@/domain-manager/hooks/useIsCurrentLocationOnAWorkspace';
import { useIsCurrentLocationOnDefaultDomain } from '@/domain-manager/hooks/useIsCurrentLocationOnDefaultDomain';
import { useMemo } from 'react';

import { SignInUpGlobalScopeFormEffect } from '@/auth/sign-in-up/components/internal/SignInUpGlobalScopeFormEffect';
import { SignInUpTwoFactorAuthenticationProvision } from '@/auth/sign-in-up/components/internal/SignInUpTwoFactorAuthenticationProvision';
import { SignInUpTOTPVerification } from '@/auth/sign-in-up/components/internal/SignInUpTwoFactorAuthenticationVerification';
import { useWorkspaceFromInviteHash } from '@/auth/sign-in-up/hooks/useWorkspaceFromInviteHash';
import { clientConfigApiStatusState } from '@/client-config/states/clientConfigApiStatusState';
import { Trans, useLingui } from '@lingui/react/macro';
import { useSearchParams } from 'react-router-dom';
import { isDefined } from 'twenty-shared/utils';
import { Loader } from 'twenty-ui/feedback';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const SPLIT_BREAKPOINT = '900px';

const StyledSplitLayout = styled.div`
  display: flex;
  min-height: 100vh;
  width: 100%;

  @media (max-width: ${SPLIT_BREAKPOINT}) {
    flex-direction: column;
  }
`;

const StyledBrandPanel = styled.div`
  align-items: center;
  background:
    radial-gradient(
      circle at 20% 20%,
      rgba(255, 255, 255, 0.6) 0%,
      transparent 55%
    ),
    radial-gradient(
      circle at 80% 80%,
      rgba(255, 255, 255, 0.35) 0%,
      transparent 55%
    ),
    linear-gradient(160deg, #cfe9ed 0%, #a8d4db 60%, #8cc6cf 100%);
  display: flex;
  flex: 1;
  justify-content: center;
  padding: 64px 48px;
  position: relative;

  @media (max-width: ${SPLIT_BREAKPOINT}) {
    flex: 0 0 auto;
    min-height: 260px;
    padding: 40px 24px;
  }
`;

const StyledBrandContent = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 440px;
  text-align: center;
`;

const StyledBrandLogo = styled.button`
  background: url('/images/waimin-logo.png') center/contain no-repeat;
  background-color: transparent;
  border: none;
  border-radius: 28px;
  cursor: pointer;
  height: 200px;
  padding: 0;
  width: 200px;

  @media (max-width: ${SPLIT_BREAKPOINT}) {
    height: 120px;
    width: 120px;
  }
`;

const StyledBrandTagline = styled.h2`
  color: #0e2a2f;
  font-size: 32px;
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.2;
  margin: 0;

  @media (max-width: ${SPLIT_BREAKPOINT}) {
    font-size: 22px;
  }
`;

const StyledBrandSubtitle = styled.p`
  color: rgba(14, 42, 47, 0.7);
  font-size: 16px;
  line-height: 1.55;
  margin: 0;
  max-width: 380px;

  @media (max-width: ${SPLIT_BREAKPOINT}) {
    display: none;
  }
`;

const StyledBrandValueList = styled.ul`
  color: rgba(14, 42, 47, 0.78);
  display: flex;
  flex-direction: column;
  font-size: 14px;
  gap: 10px;
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
  text-align: left;

  & > li {
    align-items: center;
    display: flex;
    gap: 10px;
  }

  & > li::before {
    background: #0e2a2f;
    border-radius: 999px;
    content: '';
    display: inline-block;
    flex-shrink: 0;
    height: 6px;
    width: 6px;
  }

  @media (max-width: ${SPLIT_BREAKPOINT}) {
    display: none;
  }
`;

const StyledFormPanel = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  display: flex;
  flex: 1;
  justify-content: center;
  padding: 64px 24px;

  @media (max-width: ${SPLIT_BREAKPOINT}) {
    padding: 32px 20px 48px;
  }
`;

const StyledFormCard = styled.div`
  align-items: stretch;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 380px;
  width: 100%;
`;

const StyledFormHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 4px;
`;

const StyledFormTitle = styled.h1`
  color: ${themeCssVariables.font.color.primary};
  font-size: 26px;
  font-weight: 500;
  letter-spacing: -0.01em;
  margin: 0;
`;

const StyledFormSubtitle = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 14px;
  margin: 0;
`;

const StyledFormFooter = styled.div`
  margin-top: 12px;
`;

const StyledLoaderContainer = styled.div`
  align-items: center;
  display: flex;
  justify-content: center;
  margin-bottom: ${themeCssVariables.spacing[8]};
  margin-top: ${themeCssVariables.spacing[8]};
  width: 100%;
`;

const StyledBrandFootnote = styled.p`
  bottom: 24px;
  color: rgba(14, 42, 47, 0.55);
  font-size: 12px;
  letter-spacing: 0.04em;
  margin: 0;
  position: absolute;
  text-transform: uppercase;

  @media (max-width: ${SPLIT_BREAKPOINT}) {
    display: none;
  }
`;

type AuthShellProps = {
  title: string;
  subtitle?: string;
  onClickOnLogo?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

const AuthShell = ({
  title,
  subtitle,
  onClickOnLogo,
  children,
  footer,
}: AuthShellProps) => {
  return (
    <StyledSplitLayout>
      <StyledBrandPanel>
        <StyledBrandContent>
          <StyledBrandLogo
            type="button"
            aria-label="Waimin"
            onClick={() => onClickOnLogo?.()}
          />
          <StyledBrandTagline>
            <Trans>Water as nature intended.</Trans>
          </StyledBrandTagline>
          <StyledBrandSubtitle>
            <Trans>
              The CRM built for Waimin — manage customers, sales, finance and
              tasks from a single, focused workspace.
            </Trans>
          </StyledBrandSubtitle>
          <StyledBrandValueList>
            <li>
              <Trans>Real-time finance dashboard</Trans>
            </li>
            <li>
              <Trans>Xero-ready accounting workflows</Trans>
            </li>
            <li>
              <Trans>Customer pipeline + deal tracking</Trans>
            </li>
          </StyledBrandValueList>
        </StyledBrandContent>
        <StyledBrandFootnote>
          <Trans>© Waimin · wai-min.com</Trans>
        </StyledBrandFootnote>
      </StyledBrandPanel>
      <StyledFormPanel>
        <StyledFormCard>
          <StyledFormHeader>
            <StyledFormTitle>{title}</StyledFormTitle>
            {subtitle && <StyledFormSubtitle>{subtitle}</StyledFormSubtitle>}
          </StyledFormHeader>
          {children}
          {footer && <StyledFormFooter>{footer}</StyledFormFooter>}
        </StyledFormCard>
      </StyledFormPanel>
    </StyledSplitLayout>
  );
};

export const SignInUp = () => {
  const { t } = useLingui();
  const setSignInUpStep = useSetAtomState(signInUpStepState);
  const clientConfigApiStatus = useAtomStateValue(clientConfigApiStatusState);

  const { form } = useSignInUpForm();
  const { signInUpStep } = useSignInUp(form);
  const { isDefaultDomain } = useIsCurrentLocationOnDefaultDomain();
  const { isOnAWorkspace } = useIsCurrentLocationOnAWorkspace();
  const workspacePublicData = useAtomStateValue(workspacePublicDataState);
  const { loading: getPublicWorkspaceDataLoading } =
    useGetPublicWorkspaceDataByDomain();
  const isMultiWorkspaceEnabled = useAtomStateValue(
    isMultiWorkspaceEnabledState,
  );
  const { workspaceInviteHash, workspace: workspaceFromInviteHash } =
    useWorkspaceFromInviteHash();

  const [searchParams] = useSearchParams();

  const onClickOnLogo = () => {
    setSignInUpStep(SignInUpStep.Init);
  };

  const isGlobalScope = isDefaultDomain && isMultiWorkspaceEnabled;

  const title = useMemo(() => {
    if (isDefined(workspaceInviteHash)) {
      const workspaceName = workspaceFromInviteHash?.displayName ?? '';
      return t`Join ${workspaceName} team`;
    }

    if (signInUpStep === SignInUpStep.WorkspaceSelection) {
      return t`Choose a Workspace`;
    }

    if (signInUpStep === SignInUpStep.TwoFactorAuthenticationProvision) {
      return t`Setup your 2FA`;
    }

    if (signInUpStep === SignInUpStep.TwoFactorAuthenticationVerification) {
      return t`Verify code from the app`;
    }

    if (isGlobalScope) {
      return t`Welcome to Waimin`;
    }

    const workspaceName = workspacePublicData?.displayName;

    if (!workspaceName) {
      return t`Welcome to your workspace`;
    }

    return t`Welcome, ${workspaceName}.`;
  }, [
    workspaceInviteHash,
    signInUpStep,
    workspacePublicData?.displayName,
    isGlobalScope,
    t,
    workspaceFromInviteHash?.displayName,
  ]);

  const subtitle = useMemo(() => {
    if (signInUpStep === SignInUpStep.WorkspaceSelection) {
      return t`Pick the workspace you want to sign into.`;
    }
    if (signInUpStep === SignInUpStep.TwoFactorAuthenticationProvision) {
      return t`Scan the QR code with your authenticator app.`;
    }
    if (signInUpStep === SignInUpStep.TwoFactorAuthenticationVerification) {
      return t`Enter the 6-digit code from your authenticator app.`;
    }
    return t`Sign in with your work email to continue.`;
  }, [signInUpStep, t]);

  const signInUpForm = useMemo(() => {
    if (getPublicWorkspaceDataLoading || !clientConfigApiStatus.isLoadedOnce) {
      return (
        <StyledLoaderContainer>
          <Loader color="gray" />
        </StyledLoaderContainer>
      );
    }

    if (isDefaultDomain && isMultiWorkspaceEnabled) {
      return (
        <>
          <SignInUpGlobalScopeFormEffect />
          <SignInUpGlobalScopeForm />
        </>
      );
    }

    if (
      isOnAWorkspace &&
      signInUpStep === SignInUpStep.SSOIdentityProviderSelection
    ) {
      return <SignInUpSSOIdentityProviderSelection />;
    }

    if (signInUpStep === SignInUpStep.TwoFactorAuthenticationProvision) {
      return <SignInUpTwoFactorAuthenticationProvision />;
    }

    if (signInUpStep === SignInUpStep.TwoFactorAuthenticationVerification) {
      return <SignInUpTOTPVerification />;
    }

    if (isDefined(workspacePublicData) && isOnAWorkspace) {
      return (
        <>
          <SignInUpWorkspaceScopeFormEffect />
          <SignInUpWorkspaceScopeForm />
        </>
      );
    }

    return (
      <>
        <SignInUpGlobalScopeFormEffect />
        <SignInUpGlobalScopeForm />
      </>
    );
  }, [
    clientConfigApiStatus.isLoadedOnce,
    isDefaultDomain,
    isMultiWorkspaceEnabled,
    isOnAWorkspace,
    getPublicWorkspaceDataLoading,
    signInUpStep,
    workspacePublicData,
  ]);

  if (signInUpStep === SignInUpStep.EmailVerification) {
    return (
      <AuthShell
        title={t`Check your inbox`}
        subtitle={t`We sent a verification link to your email.`}
      >
        <EmailVerificationSent email={searchParams.get('email')} />
      </AuthShell>
    );
  }

  const showWorkspaceSelectionFooter =
    signInUpStep === SignInUpStep.WorkspaceSelection;

  const showFooterNote = ![
    SignInUpStep.Password,
    SignInUpStep.TwoFactorAuthenticationProvision,
    SignInUpStep.TwoFactorAuthenticationVerification,
    SignInUpStep.WorkspaceSelection,
  ].includes(signInUpStep);

  return (
    <AuthShell
      title={title}
      subtitle={subtitle}
      onClickOnLogo={onClickOnLogo}
      footer={
        <>
          {showWorkspaceSelectionFooter && <WorkspaceSelectionFooter />}
          {showFooterNote && <FooterNote />}
        </>
      }
    >
      {signInUpForm}
    </AuthShell>
  );
};
