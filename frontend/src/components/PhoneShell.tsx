import { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useApp } from '@/context/app-context';
import { isNative } from '@/utils/native';

const showPhoneMockup =
  isNative === false &&
  import.meta.env.VITE_PHONE_MOCKUP === 'true';

export const PhoneShell = ({ children }: { children: ReactNode }) => {
  if (isNative) {
    return (
      <div className="flex w-full flex-col overflow-hidden bg-white">
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    );
  }

  if (showPhoneMockup) {
    return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-100 py-4">
      <div className="relative flex h-[860px] max-h-[95vh] w-full max-w-[420px] flex-col overflow-hidden rounded-[44px] border-[10px] border-gray-900 bg-white shadow-2xl">
        {/* Notch */}
        <div className="absolute left-1/2 top-0 z-50 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-gray-900" />
        {/* Status bar */}
        <div className="flex h-8 shrink-0 items-center justify-between px-7 pt-1 text-[11px] font-semibold text-gray-900">
          <span>9:41</span>
          <span className="flex items-center gap-1">
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none"><path d="M1 6h2v3H1zM5 4h2v5H5zM9 2h2v7H9zM13 0h2v9h-2z" fill="currentColor"/></svg>
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M7 2.5C9 2.5 10.8 3.3 12 4.5l-1.4 1.4C9.7 5 8.4 4.5 7 4.5S4.3 5 3.4 5.9L2 4.5C3.2 3.3 5 2.5 7 2.5zM7 5.5c1 0 1.9.4 2.6 1.1L8.2 8c-.3-.3-.8-.5-1.2-.5s-.9.2-1.2.5L4.4 6.6C5.1 5.9 6 5.5 7 5.5z" fill="currentColor"/></svg>
            <svg width="24" height="11" viewBox="0 0 24 11" fill="none"><rect x="1" y="1" width="20" height="9" rx="2" stroke="currentColor" stroke-width="1"/><rect x="3" y="3" width="16" height="5" rx="1" fill="currentColor"/><rect x="22" y="4" width="1.5" height="3" rx="0.5" fill="currentColor"/></svg>
          </span>
        </div>
        {/* Content */}
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
  }

  return (
    <div className="mx-auto flex h-screen w-full max-w-lg flex-col border-x border-gray-200 bg-white md:max-w-none md:border-x-0">
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
};

export const TopBar = ({
  title,
  showBack = true,
  right,
  onBack,
}: {
  title: string;
  showBack?: boolean;
  right?: ReactNode;
  onBack?: () => void;
}) => {
  const { back } = useApp();
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-100 bg-white px-3">
      {showBack && (
        <button
          onClick={onBack || back}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100"
        >
          <ChevronLeft size={22} />
        </button>
      )}
      <h1 className="flex-1 truncate text-lg font-bold text-gray-900">{title}</h1>
      {right}
    </div>
  );
};