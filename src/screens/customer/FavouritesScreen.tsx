import * as Icons from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { useFavourites, useProfessional } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, Button } from '@/components/ui';
import { inr } from '@/lib/format';
import type { Professional } from '@/lib/types';

export const FavouritesScreen = () => {
  const { navigate, customer } = useApp();
  const { favourites, loading, reload } = useFavourites(customer?.phone || null);

  const remove = async (professionalId: string) => {
    await supabase.from('favourites').delete().eq('customer_phone', customer?.phone || '').eq('professional_id', professionalId);
    reload();
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="Favourite Professionals" />
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
        {loading ? (
          <Spinner className="py-16" />
        ) : favourites.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-400">
              <Icons.Heart size={28} />
            </div>
            <p className="text-sm font-semibold text-gray-800">No favourites yet</p>
            <p className="text-xs text-gray-500">Tap the heart on a professional's profile to save them here.</p>
            <Button className="mt-4" onClick={() => navigate({ name: 'home' })}>Explore professionals</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {favourites.map((f) => (
              <FavCard
                key={f.id}
                pro={f.professional as Professional}
                onOpen={() => navigate({ name: 'professional', id: (f.professional as Professional).id })}
                onRemove={() => remove((f.professional as Professional).id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const FavCard = ({ pro, onOpen, onRemove }: { pro: Professional; onOpen: () => void; onRemove: () => void }) => {
  const { professional } = useProfessional(pro.id);
  const current = professional || pro;
  return (
    <Card className="flex items-center gap-3 p-3">
      <img src={current.avatar_url} alt={current.name} className="h-12 w-12 rounded-full bg-gray-100 object-cover" />
      <div className="min-w-0 flex-1 cursor-pointer" onClick={onOpen}>
        <p className="truncate text-sm font-bold text-gray-900">{current.name}</p>
        <p className="text-[11px] text-gray-500">{current.skills.join(', ')}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-400">
          <span className="flex items-center gap-0.5"><Icons.Star size={11} className="fill-amber-400 text-amber-400" />{current.rating}</span>
          <span>· {inr(current.starting_price)} onwards</span>
          {current.service_area && <span className="truncate">· {current.service_area.split(',')[0]}</span>}
        </div>
      </div>
      <button onClick={onRemove} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
        <Icons.Heart size={16} className="fill-red-500" />
      </button>
    </Card>
  );
};