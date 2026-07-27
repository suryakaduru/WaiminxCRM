import { Trans } from '@lingui/react';
import { I18nProvider } from '@lingui/react';
import {
  Body,
  Button,
  Container,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Section,
  Text,
} from '@react-email/components';
import { emailTheme } from 'src/common-style';

import { BaseHead } from 'src/components/BaseHead';
import { capitalize } from 'src/utils/capitalize';
import { createI18nInstance } from 'src/utils/i18n.utils';
import { type APP_LOCALES } from 'twenty-shared/translations';
import { getImageAbsoluteURI } from 'twenty-shared/utils';

type SendInviteLinkEmailProps = {
  link: string;
  workspace: { name: string | undefined; logo: string | undefined };
  sender: {
    email: string;
    firstName: string;
    lastName: string;
  };
  serverUrl: string;
  frontendUrl: string;
  locale: keyof typeof APP_LOCALES;
};

const bodyStyle = {
  backgroundColor: '#f4f4f5',
  fontFamily: emailTheme.font.family,
  margin: 0,
  padding: '32px 0',
};

const cardStyle = {
  backgroundColor: emailTheme.font.colors.inverted,
  border: `1px solid ${emailTheme.border.color.highlighted}`,
  borderRadius: '12px',
  maxWidth: '460px',
  margin: '0 auto',
  padding: '40px 40px 32px',
};

const logoStyle = {
  display: 'block',
  margin: '0 auto 28px',
};

const titleStyle = {
  fontSize: emailTheme.font.size.xl,
  fontWeight: emailTheme.font.weight.bold,
  color: emailTheme.font.colors.highlighted,
  textAlign: 'center' as const,
  margin: '0 0 12px',
};

const introStyle = {
  fontSize: emailTheme.font.size.md,
  color: emailTheme.font.colors.primary,
  lineHeight: emailTheme.font.lineHeight,
  textAlign: 'center' as const,
  margin: '0 0 28px',
};

const inviteBoxStyle = {
  backgroundColor: emailTheme.background.colors.highlight,
  border: `1px solid ${emailTheme.border.color.highlighted}`,
  borderRadius: emailTheme.border.radius.md,
  padding: '28px 24px',
  textAlign: 'center' as const,
};

const workspaceNameStyle = {
  fontSize: emailTheme.font.size.lg,
  fontWeight: emailTheme.font.weight.bold,
  color: emailTheme.font.colors.highlighted,
  margin: '12px 0 20px',
};

const buttonStyle = {
  display: 'inline-block',
  backgroundColor: emailTheme.background.button,
  color: emailTheme.font.colors.inverted,
  fontSize: emailTheme.font.size.md,
  fontWeight: emailTheme.font.weight.bold,
  padding: '12px 40px',
  borderRadius: emailTheme.border.radius.md,
  textDecoration: 'none',
};

const noteStyle = {
  fontSize: emailTheme.font.size.sm,
  color: emailTheme.font.colors.tertiary,
  lineHeight: emailTheme.font.lineHeight,
  textAlign: 'center' as const,
  margin: '28px 0 0',
};

const dividerStyle = {
  borderColor: emailTheme.border.color.highlighted,
  margin: '24px 0 16px',
};

const footerStyle = {
  fontSize: emailTheme.font.size.sm,
  color: emailTheme.font.colors.tertiary,
  textAlign: 'center' as const,
  margin: 0,
};

export const SendInviteLinkEmail = ({
  link,
  workspace,
  sender,
  serverUrl,
  frontendUrl,
  locale,
}: SendInviteLinkEmailProps) => {
  const i18n = createI18nInstance(locale);
  const workspaceLogo = workspace.logo
    ? getImageAbsoluteURI({ imageUrl: workspace.logo, baseUrl: serverUrl })
    : null;

  const waiminLogo = `${frontendUrl}/images/waimin-logo.png`;

  const senderName = capitalize(sender.firstName);
  const senderEmail = sender.email;
  const workspaceName = workspace.name;

  return (
    <I18nProvider i18n={i18n}>
      <Html lang={locale}>
        <BaseHead />
        <Body style={bodyStyle}>
          <Container style={cardStyle}>
            <Img
              src={waiminLogo}
              alt="Waimin"
              height="48"
              style={logoStyle}
            />
            <Heading as="h1" style={titleStyle}>
              {i18n._('Join our Waimin Team')}
            </Heading>
            <Text style={introStyle}>
              <Trans
                id="{senderName} (<0>{senderEmail}</0>) has invited you to join a workspace called <1>{workspaceName}</1>."
                values={{ senderName, senderEmail, workspaceName }}
                components={{
                  0: (
                    <Link
                      href={`mailto:${senderEmail}`}
                      style={{ color: emailTheme.font.colors.blue }}
                    />
                  ),
                  1: <b />,
                }}
              />
            </Text>

            <Section style={inviteBoxStyle}>
              {workspaceLogo ? (
                <Img
                  src={workspaceLogo}
                  width={48}
                  height={48}
                  alt="Workspace logo"
                  style={{ borderRadius: '8px', margin: '0 auto' }}
                />
              ) : null}
              {workspaceName ? (
                <Text style={workspaceNameStyle}>{workspaceName}</Text>
              ) : null}
              <Button href={link} style={buttonStyle}>
                {i18n._('Accept invite')}
              </Button>
            </Section>

            <Text style={noteStyle}>
              {i18n._(
                'This invitation was sent to you by {senderName}. If you were not expecting it, you can safely ignore this email.',
                { senderName },
              )}
            </Text>

            <Hr style={dividerStyle} />
            <Text style={footerStyle}>Waimin CRM</Text>
          </Container>
        </Body>
      </Html>
    </I18nProvider>
  );
};

SendInviteLinkEmail.PreviewProps = {
  link: 'https://app.twenty.com/invite/123',
  workspace: {
    name: 'Waimin',
    logo: 'https://fakeimg.pl/200x200/?text=W&font=lobster',
  },
  sender: { email: 'support@wai-min.com', firstName: 'Surya', lastName: 'K' },
  serverUrl: 'https://app.twenty.com',
  frontendUrl: 'https://app.twenty.com',
  locale: 'en',
} as SendInviteLinkEmailProps;

export default SendInviteLinkEmail;
