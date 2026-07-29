import { Img } from '@react-email/components';

const logoStyle = {
  marginBottom: '40px',
};

type LogoProps = {
  src?: string;
  alt?: string;
};

export const Logo = ({
  src = 'https://waimincrm.duckdns.org/images/waimin-logo.png',
  alt = 'Waimin',
}: LogoProps) => {
  return <Img src={src} alt={alt} width="40" height="40" style={logoStyle} />;
};
