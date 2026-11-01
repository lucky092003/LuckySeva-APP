import { Sparkles } from 'lucide-react';
import { useApp } from '@/context/app-context';
import { isNative } from '@/utils/native';

/** Mobile/native shortcut; desktop web exposes the same destination in WebTopNav. */
export const AssistantLauncher = () => {
  const { role, screen, navigate } = useApp();
  const isHome = screen.name === 'home' || screen.name === 'provider-home';
  if (role === 'admin' || !isHome) {
    return null;
  }

  return (
    <button
      onClick={() => navigate({ name: 'assistant' })}
      aria-label="Open LuckySeva AI assistant"
      className={`fixed right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:-translate-y-0.5 hover:bg-emerald-800 active:translate-y-0 ${isNative ? 'bottom-[calc(var(--safe-area-bottom)+5.5rem)]' : 'bottom-[calc(var(--safe-area-bottom)+5.5rem)]'}`}
    >
      <Sparkles size={17} />
      <span className="font-semibold">Ask</span>
    </button>
  );
};
