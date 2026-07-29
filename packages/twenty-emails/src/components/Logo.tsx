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
  // Waimin wordmark is ~3.49:1 — keep aspect ratio (do not force a square)
  return <Img src={src} alt={alt} width="140" height="40" style={logoStyle} />;
};
