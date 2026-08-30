import { useEffect } from 'react';
import { Logo, Wordmark } from '@/components/Logo';
import { useApp } from '@/lib/app-context';

export const SplashScreen = () => {
  const { navigate, customer } = useApp();
  useEffect(() => {
    const t = setTimeout(() => navigate({ name: customer ? 'home' : 'auth' }), 2200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-white">
      <div className="animate-[fadeIn_0.6s_ease] flex flex-col items-center">
        <div className="animate-[popIn_0.7s_cubic-bezier(0.34,1.56,0.64,1)]">
          <Logo size={84} />
        </div>
        <div className="mt-5">
          <Wordmark />
        </div>
        <p className="mt-2 text-sm font-medium text-gray-500">Trusted Services, At Your Doorstep</p>
      </div>
      <div className="absolute bottom-10 h-1 w-32 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full w-1/2 animate-[load_1.8s_ease-in-out] rounded-full bg-emerald-500" />
      </div>
    </div>
  );
};
