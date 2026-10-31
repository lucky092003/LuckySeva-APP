import { Sparkles } from 'lucide-react';
import { useApp } from '@/context/app-context';
import { isNative } from '@/utils/native';

/** Mobile/native shortcut; desktop web exposes the same destination in WebTopNav. */
export const AssistantLauncher = () => {
  const { role, screen, navigate } = useApp();
  if (role === 'admin' || screen.name === 'splash' || screen.name === 'auth' || screen.name === 'provider-auth' || screen.name === 'assistant') {
    return null;
  }

  return (
    <button
      onClick={() => navigate({ name: 'assistant' })}
      aria-label="Open LuckySeva AI assistant"
      className={`fixed right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:-translate-y-0.5 hover:bg-emerald-800 active:translate-y-0 ${isNative ? 'bottom-[calc(var(--safe-area-bottom)+5.5rem)]' : 'bottom-[calc(var(--safe-area-bottom)+5.5rem)]'}`}
    >
      <Sparkles size={17} />
      <span>Ask Lucky</span>
    </button>
  );
};
