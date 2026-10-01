import { ReactNode, useState } from 'react';
import { Star, BadgeCheck, Search, X } from 'lucide-react';
import { inr } from '@/utils/format';

export const Spinner = ({ className = '' }: { className?: string }) => (
  <div className={`flex items-center justify-center ${className}`}>
    <div className="h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-500" />
  </div>
);

export const EmptyState = ({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
}) => (
  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
      {icon}
    </div>
    <p className="text-base font-semibold text-gray-800">{title}</p>
    {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
  </div>
);

export const ErrorState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-400">
      !
    </div>
    <p className="text-base font-semibold text-gray-800">Something went wrong</p>
    <p className="mt-1 text-sm text-gray-500">{message}</p>
  </div>
);

export const Stars = ({ rating, size = 12 }: { rating: number; size?: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        size={size}
        className={
          i <= Math.round(rating)
            ? 'fill-amber-400 text-amber-400'
            : 'fill-gray-200 text-gray-200'
        }
      />
    ))}
  </div>
);

export const CountBadge = ({ count, className = '' }: { count: number; className?: string }) => {
  if (count <= 0) return null;
  return (
    <span
      className={`pointer-events-none absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold leading-none text-gray-900 ${className}`}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
};

export const Badge = ({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'info';
  className?: string;
}) => {
  const tones: Record<string, string> = {
    neutral: 'bg-gray-100 text-gray-600',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    info: 'bg-sky-50 text-sky-700',
  };
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
};

export const PriceTag = ({ amount, label = 'Starts at' }: { amount: number; label?: string }) => (
  <div className="flex flex-col">
    <span className="text-[11px] font-medium text-gray-400">{label}</span>
    <span className="text-base font-bold text-gray-900">{inr(amount)}</span>
  </div>
);

export const VerifiedBadge = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
    <BadgeCheck size={11} /> Verified
  </span>
);

export const Button = ({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) => {
  const variants: Record<string, string> = {
    primary: 'bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700 shadow-sm shadow-emerald-500/30',
    secondary: 'bg-gray-900 text-white hover:bg-gray-800',
    ghost: 'text-gray-700 hover:bg-gray-100',
    outline: 'border border-gray-200 text-gray-700 hover:bg-gray-50 bg-white',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

export const Card = ({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) => {
  if (!onClick) {
    return <div className={`rounded-2xl border border-gray-100 bg-white ${className}`}>{children}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full cursor-pointer rounded-2xl border border-gray-100 bg-white text-left transition-all hover:border-gray-200 hover:shadow-md active:scale-[0.995] ${className}`}
    >
      {children}
    </button>
  );
};

export const SearchBar = ({
  value,
  onChange,
  placeholder = 'Search',
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) => (
  <div className="flex items-center gap-2 rounded-xl bg-gray-100 px-3.5 py-2.5">
    <Search size={18} className="shrink-0 text-gray-400" />
    <input
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
    />
    {value && (
      <button onClick={() => onChange('')} aria-label="Clear search" className="shrink-0 text-gray-400">
        <X size={16} />
      </button>
    )}
  </div>
);

const AVATAR_TONES = [
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
];

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase() || '?';

const toneFor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
};

/**
 * `avatar_url` is NOT NULL DEFAULT '' in the schema, so an empty src renders a
 * broken-image glyph. Fall back to coloured initials, and also handle the case
 * where a stored URL fails to load.
 */
export const Avatar = ({
  src,
  name,
  className = '',
  textClassName = '',
}: {
  src?: string | null;
  name: string;
  className?: string;
  textClassName?: string;
}) => {
  const [broken, setBroken] = useState(false);
  const usable = !!src && src.trim() !== '' && !broken;

  if (!usable) {
    return (
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center font-bold ${toneFor(name)} ${className}`}
      >
        <span className={textClassName}>{initials(name)}</span>
      </span>
    );
  }

  return (
    <img
      src={src as string}
      alt={name}
      onError={() => setBroken(true)}
      className={`shrink-0 bg-gray-100 object-cover ${className}`}
    />
  );
};

export const SectionTitle = ({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) => (
  <div className="mb-3 flex items-center justify-between">
    <h2 className="text-base font-bold text-gray-900">{title}</h2>
    {action && (
      <button onClick={onAction} className="text-xs font-semibold text-emerald-600">
        {action}
      </button>
    )}
  </div>
);
