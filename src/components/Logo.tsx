export const Logo = ({ size = 40 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="48" height="48" rx="12" fill="#10b981" />
    <path
      d="M31.2 12.9a6.5 6.5 0 0 0-8.5 8.3L14.6 29.3a3 3 0 0 0 4.2 4.2l8.1-8.1a6.5 6.5 0 0 0 8.3-8.5l-3.5 3.5-3.4-3.4 3.5-3.5a6.4 6.4 0 0 0-1.6-.1z"
      fill="white"
    />
    <circle cx="33.5" cy="17.5" r="2.5" fill="#fbbf24" />
  </svg>
);

export const LogoMark = ({ size = 40 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="48" height="48" rx="12" fill="#10b981" />
    <path
      d="M31.2 12.9a6.5 6.5 0 0 0-8.5 8.3L14.6 29.3a3 3 0 0 0 4.2 4.2l8.1-8.1a6.5 6.5 0 0 0 8.3-8.5l-3.5 3.5-3.4-3.4 3.5-3.5a6.4 6.4 0 0 0-1.6-.1z"
      fill="white"
    />
    <circle cx="33.5" cy="17.5" r="2.5" fill="#fbbf24" />
  </svg>
);

export const Wordmark = ({ className = 'text-black' }: { className?: string }) => (
  <span className={`text-xl font-extrabold tracking-tight ${className}`}>
    Lucky<span className="text-orange-500">Seva</span>
  </span>
);
