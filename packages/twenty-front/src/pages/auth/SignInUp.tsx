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

const MOBILE_BREAKPOINT = '520px';
const EASE_BRAND = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

// The auth routes render inside AuthModal, whose `fullscreen` size paints an
// opaque background at a high z-index. A position:fixed backdrop would sit
// behind that and never be seen, so the photo lives inside the page container.
const StyledBackgroundPhoto = styled.div`
  animation: authKenBurns 28s ease-in-out infinite alternate;
  background: url('/images/auth-hero-mobile.webp') center / cover no-repeat;
  inset: 0;
  position: absolute;
  will-change: transform;
  z-index: 0;

  @media (min-width: 901px) {
    background-image: url('/images/auth-hero.webp');
  }

  @keyframes authKenBurns {
    0% {
      transform: scale(1) translate(0, 0);
    }
    100% {
      transform: scale(1.06) translate(-0.5%, -0.5%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const StyledBackgroundScrim = styled.div`
  background:
    radial-gradient(
      ellipse 70% 60% at 50% 50%,
      rgba(20, 22, 24, 0.25) 0%,
      rgba(20, 22, 24, 0.5) 100%
    ),
    linear-gradient(
      180deg,
      rgba(15, 17, 20, 0.15) 0%,
      rgba(15, 17, 20, 0.45) 100%
    );
  inset: 0;
  position: absolute;
  z-index: 0;
`;

const StyledPage = styled.div`
  align-items: center;
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
  justify-content: center;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  padding: 32px;
  position: relative;
  width: 100%;

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    padding: 20px;
  }
`;

const StyledTopLogo = styled.button`
  animation: authFadeDown 0.7s ${EASE_BRAND} 0.15s forwards;
  background: url('/images/waimin-logo-horizontal.webp') center / contain
    no-repeat;
  background-color: transparent;
  border: none;
  cursor: pointer;
  filter: brightness(0) invert(1);
  height: 32px;
  left: 50%;
  opacity: 0;
  padding: 0;
  position: absolute;
  top: clamp(24px, 3vh, 40px);
  transform: translateX(-50%);
  width: 150px;
  z-index: 2;

  @keyframes authFadeDown {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-10px);
    }
    to {
      opacity: 0.9;
      transform: translateX(-50%) translateY(0);
    }
  }

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    height: 26px;
    width: 120px;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 0.9;
  }
`;

// The auth form itself is rendered by shared components (MainButton, inputs).
// Restyling those globally would affect the whole app, so the glass-card look
// is applied here via descendant selectors scoped to this container only.
const StyledGlassCard = styled.div`
  animation: authCardEnter 0.8s ${EASE_BRAND} 0.15s forwards;
  backdrop-filter: blur(40px) saturate(1.6);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 22px;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.18),
    0 8px 20px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  flex: 0 0 auto;
  max-width: 420px;
  opacity: 0;
  overflow: hidden;
  padding: clamp(32px, 4.5vw, 44px);
  position: relative;
  width: 100%;
  z-index: 1;
  -webkit-backdrop-filter: blur(40px) saturate(1.6);

  @keyframes authCardEnter {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  &::before {
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.2),
      rgba(61, 155, 143, 0.15),
      rgba(255, 255, 255, 0.2),
      transparent
    );
    content: '';
    height: 1px;
    left: 8%;
    position: absolute;
    right: 8%;
    top: 0;
  }

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    border-radius: 16px;
    padding: 24px 20px;
  }

  // Backdrop blur over a full-bleed photo is the most expensive thing on this
  // page; on phones it is the difference between a smooth and a janky entrance.
  @media (max-width: 900px) {
    backdrop-filter: blur(18px) saturate(1.4);
    -webkit-backdrop-filter: blur(18px) saturate(1.4);
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 1;
  }

  /* Primary + secondary auth buttons */
  button[type='button'],
  button[type='submit'] {
    border-radius: 10px;
    font-weight: 600;
    transition: all 0.3s ${EASE_BRAND};
  }

  button:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  button:active:not(:disabled) {
    transform: scale(0.985);
  }

  /* Text inputs sit on glass, so they need light-on-dark treatment */
  input {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.92);
  }

  input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  a {
    color: rgba(255, 255, 255, 0.55);
  }

  a:hover {
    color: #ffffff;
  }
`;

const StyledCardInner = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: relative;
  z-index: 2;

  // Stagger the header, then the auth buttons, then the footer. Targeting
  // direct children keeps this working whichever sign-in step is rendered.
  & > * {
    animation: authSlideUp 0.5s ${EASE_BRAND} forwards;
    opacity: 0;
  }

  & > *:nth-child(1) {
    animation-delay: 0.35s;
  }

  & > *:nth-child(2) {
    animation-delay: 0.45s;
  }

  & > *:nth-child(3) {
    animation-delay: 0.55s;
  }

  & > *:nth-child(n + 4) {
    animation-delay: 0.6s;
  }

  @keyframes authSlideUp {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    & > * {
      animation: none;
      opacity: 1;
    }
  }
`;

const StyledFormHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 4px;
  text-align: center;
`;

const StyledFormTitle = styled.h1`
  color: #ffffff;
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0;

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    font-size: 22px;
  }
`;

const StyledFormSubtitle = styled.p`
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
`;

const StyledFormFooter = styled.div`
  color: rgba(255, 255, 255, 0.35);
  margin-top: 12px;
  text-align: center;
`;

const StyledLoaderContainer = styled.div`
  align-items: center;
  display: flex;
  justify-content: center;
  margin-bottom: ${themeCssVariables.spacing[8]};
  margin-top: ${themeCssVariables.spacing[8]};
  width: 100%;
`;

const StyledBottomBar = styled.div`
  align-items: center;
  animation: authFadeIn 0.5s ease 1s forwards;
  bottom: clamp(20px, 2.5vh, 32px);
  display: flex;
  gap: 32px;
  left: 50%;
  opacity: 0;
  position: absolute;
  transform: translateX(-50%);
  z-index: 1;

  @keyframes authFadeIn {
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 1;
  }

  & > span {
    color: rgba(255, 255, 255, 0.2);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    display: none;
  }
`;

const StyledBottomBarLine = styled.div`
  background: rgba(255, 255, 255, 0.1);
  height: 1px;
  width: 30px;
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
    <StyledPage>
      <StyledBackgroundPhoto />
      <StyledBackgroundScrim />
      <StyledTopLogo
        type="button"
        aria-label="Waimin"
        onClick={() => onClickOnLogo?.()}
      />
      <StyledGlassCard>
        <StyledCardInner>
          <StyledFormHeader>
            <StyledFormTitle>{title}</StyledFormTitle>
            {subtitle && <StyledFormSubtitle>{subtitle}</StyledFormSubtitle>}
          </StyledFormHeader>
          {children}
          {footer && <StyledFormFooter>{footer}</StyledFormFooter>}
        </StyledCardInner>
      </StyledGlassCard>
      <StyledBottomBar>
        <span>
          <Trans>© Waimin</Trans>
        </span>
        <StyledBottomBarLine />
        <span>wai-min.com</span>
      </StyledBottomBar>
    </StyledPage>
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
