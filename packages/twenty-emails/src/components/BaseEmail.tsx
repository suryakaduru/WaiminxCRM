import { I18nProvider } from '@lingui/react';
import { Container, Html } from '@react-email/components';

import { BaseHead } from 'src/components/BaseHead';
import { Logo } from 'src/components/Logo';
import { createI18nInstance } from 'src/utils/i18n.utils';
import { type APP_LOCALES } from 'twenty-shared/translations';

type BaseEmailProps = {
  children: JSX.Element | JSX.Element[] | string;
  width?: number;
  locale: keyof typeof APP_LOCALES;
  logoUrl?: string;
  logoAlt?: string;
};

export const BaseEmail = ({
  children,
  width,
  locale,
  logoUrl,
  logoAlt,
}: BaseEmailProps) => {
  const i18nInstance = createI18nInstance(locale);

  return (
    <I18nProvider i18n={i18nInstance}>
      <Html lang={locale}>
        <BaseHead />
        <Container width={width || 290}>
          <Logo src={logoUrl} alt={logoAlt} />
          {children}
        </Container>
      </Html>
    </I18nProvider>
  );
};
