import { ReactNode } from 'react';
import { Star, BadgeCheck } from 'lucide-react';
import { inr } from '@/lib/format';

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

export const Badge = ({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'info';
}) => {
  const tones: Record<string, string> = {
    neutral: 'bg-gray-100 text-gray-600',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    info: 'bg-sky-50 text-sky-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
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

export const Card = ({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) => (
  <div
    onClick={onClick}
    className={`rounded-2xl border border-gray-100 bg-white ${onClick ? 'cursor-pointer transition-all hover:shadow-md hover:border-gray-200' : ''} ${className}`}
  >
    {children}
  </div>
);

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
