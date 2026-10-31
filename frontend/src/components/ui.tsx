import { ReactNode, useState } from 'react';
import { Star, BadgeCheck, Search, X } from 'lucide-react';
import { inr } from '@/utils/format';

export const Spinner = ({ className = '' }: { className?: string }) => (
  <div className={`flex items-center justify-center ${className}`}>
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-500 dark:border-gray-700 dark:border-t-emerald-400" />
  </div>
);

export const EmptyState = ({
  icon,
  title,
  subtitle,
  action,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) => (
  <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 text-gray-400 ring-1 ring-gray-100 dark:from-gray-800 dark:to-gray-900 dark:text-gray-500 dark:ring-gray-800">
      {icon}
    </div>
    <p className="text-base font-bold text-gray-900 dark:text-gray-100">{title}</p>
    {subtitle && <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
    {action && onAction && (
      <button
        onClick={onAction}
        className="mt-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-500/20 transition hover:shadow-md hover:shadow-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
      >
        {action}
      </button>
    )}
  </div>
);

export const ErrorState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900/60">
      !
    </div>
    <p className="text-base font-bold text-gray-900 dark:text-gray-100">Something went wrong</p>
    <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">{message}</p>
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
            : 'fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700'
        }
      />
    ))}
  </div>
);

export const CountBadge = ({ count, className = '' }: { count: number; className?: string }) => {
  if (count <= 0) return null;
  const show = String(count);
  const wide = count > 9;
  return (
    <span
      className={`pointer-events-none absolute -right-1 -top-1 flex h-[18px] items-center justify-center rounded-full bg-emerald-500 ${wide ? 'min-w-[24px] px-1.5' : 'min-w-[18px] px-1'} text-[10px] font-bold leading-none text-white shadow-sm shadow-emerald-500/40 ${className}`}
    >
      {show}
    </span>
  );
};

export const Badge = ({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'info' | 'danger';
  className?: string;
}) => {
  const tones: Record<string, string> = {
    neutral: 'bg-gray-100 text-slate-600 dark:bg-gray-800 dark:text-slate-300',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    info: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400',
    danger: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  };
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
};

export const PriceTag = ({ amount, label = 'Starts at' }: { amount: number; label?: string }) => (
  <div className="flex flex-col">
    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
    <span className="text-base font-extrabold text-gray-900 dark:text-gray-100">{inr(amount)}</span>
  </div>
);

export const VerifiedBadge = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900/60">
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
  size = 'md',
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
}) => {
  const variants: Record<string, string> = {
    primary: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-700 hover:shadow-md hover:shadow-emerald-500/30 active:scale-[0.99]',
    secondary: 'bg-gray-900 text-white hover:bg-gray-800 active:bg-gray-950 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100',
    ghost: 'text-gray-700 hover:bg-gray-100 active:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-800 dark:active:bg-gray-700',
    outline: 'border border-gray-200 text-gray-700 hover:bg-gray-50 active:bg-gray-100 bg-white dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800/60 dark:bg-gray-900',
    danger: 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-sm shadow-red-500/25 hover:from-red-600 hover:to-rose-700 hover:shadow-md hover:shadow-red-500/30 active:scale-[0.99]',
  };
  const sizes: Record<string, string> = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-base',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

export const Card = ({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) => {
  if (!onClick) {
    return <div className={`rounded-2xl border border-gray-100 bg-white shadow-sm shadow-gray-100/70 dark:border-gray-800 dark:bg-gray-900 dark:shadow-none ${className}`}>{children}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full cursor-pointer rounded-2xl border border-gray-100 bg-white text-left shadow-sm shadow-gray-100/70 transition-all duration-200 hover:-translate-y-[1px] hover:border-gray-200 hover:shadow-md hover:shadow-gray-200/70 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-gray-800 dark:bg-gray-900 dark:shadow-none dark:hover:border-gray-700 dark:hover:shadow-gray-950/40 dark:focus-visible:ring-offset-gray-950 ${className}`}
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
  <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-gray-100 transition-all focus-within:ring-2 focus-within:ring-emerald-500/40 dark:bg-gray-900 dark:ring-gray-800">
    <Search size={18} className="shrink-0 text-slate-400" />
    <input
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-slate-400 focus:outline-none dark:text-gray-100"
    />
    {value && (
      <button onClick={() => onChange('')} aria-label="Clear search" className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300">
        <X size={16} />
      </button>
    )}
  </div>
);

export const Input = ({
  value,
  onChange,
  placeholder = '',
  type = 'text',
  className = '',
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: 'text' | 'number' | 'email' | 'password' | 'date' | 'tel';
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) => (
  <input
    autoFocus={autoFocus}
    type={type}
    value={value}
    onChange={onChange}
    disabled={disabled}
    placeholder={placeholder}
    className={`w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-slate-400 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 ${className}`}
  />
);

const AVATAR_TONES = [
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400',
  'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400',
  'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
  'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400',
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
      className={`shrink-0 bg-gray-100 object-cover ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/5 ${className}`}
    />
  );
};

export const SectionTitle = ({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) => (
  <div className="mb-3 flex items-center justify-between">
    <h2 className="text-base font-extrabold tracking-tight text-gray-900 dark:text-gray-100">{title}</h2>
    {action && (
      <button onClick={onAction} className="text-xs font-semibold text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300">
        {action}
      </button>
    )}
  </div>
);
