import logoImg from '@/assets/logo.png';

export const Logo = ({ size = 40 }: { size?: number }) => (
  <img
    src={logoImg}
    alt="LuckySeva logo"
    width={size}
    height={size}
    className="rounded-xl object-cover"
    style={{ width: size, height: size }}
  />
);

export const LogoMark = ({ size = 40 }: { size?: number }) => (
  <img
    src={logoImg}
    alt="LuckySeva logo"
    width={size}
    height={size}
    className="rounded-xl object-cover"
    style={{ width: size, height: size }}
  />
);

export const Wordmark = ({ className = 'text-black' }: { className?: string }) => (
  <span className={`text-xl font-extrabold tracking-tight ${className}`}>
    Lucky<span className="text-orange-500">Seva</span>
  </span>
);