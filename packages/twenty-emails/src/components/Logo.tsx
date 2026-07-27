import { Img } from '@react-email/components';

const logoStyle = {
  marginBottom: '40px',
};

type LogoProps = {
  src?: string;
  alt?: string;
};

export const Logo = ({
  src = 'https://app.twenty.com/images/icons/windows11/Square150x150Logo.scale-100.png',
  alt = 'Logo',
}: LogoProps) => {
  return <Img src={src} alt={alt} width="40" height="40" style={logoStyle} />;
};
