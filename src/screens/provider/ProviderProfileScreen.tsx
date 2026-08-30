import * as Icons from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/app-context';
import { supabase } from '@/lib/supabase';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, Button, Stars, Badge } from '@/components/ui';
import { inr } from '@/lib/format';
import type { Professional, Review } from '@/lib/types';

export const ProviderProfileScreen = () => {
  const { setRole, navigate } = useApp();
  const [pro, setPro] = useState<Professional | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase
        .from('professionals')
        .select('*')
        .order('rating', { ascending: false })
        .limit(1)
        .maybeSingle();
      const prof = p as Professional;
      setPro(prof || null);
      if (prof) {
        const { data: revs } = await supabase
          .from('reviews')
          .select('*')
          .eq('professional_id', prof.id)
          .order('created_at', { ascending: false })
          .limit(3);
        setReviews((revs as Review[]) || []);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex flex-1 flex-col"><TopBar title="Profile" showBack={false} /><Spinner className="py-20" /></div>;
  if (!pro) return <div className="flex flex-1 flex-col"><TopBar title="Profile" showBack={false} /></div>;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="My Profile" showBack={false} />
      <div className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
        {/* Profile header */}
        <Card className="flex items-center gap-4 p-4">
          <img src={pro.avatar_url} alt={pro.name} className="h-16 w-16 rounded-2xl bg-gray-100 object-cover" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-base font-bold text-gray-900">{pro.name}</p>
              <Icons.BadgeCheck size={16} className="text-emerald-500" />
            </div>
            <p className="text-xs text-gray-500">{pro.skills.join(', ')}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <Stars rating={pro.rating} size={12} />
              <span className="text-xs font-semibold text-gray-700">{pro.rating}</span>
              <Badge tone="success">Verified</Badge>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatBox icon={<Icons.Briefcase size={16} />} label="Experience" value={`${pro.experience_years} yrs`} />
          <StatBox icon={<Icons.CheckCircle2 size={16} />} label="Completed" value={`${pro.completed_jobs}`} />
          <StatBox icon={<Icons.Star size={16} />} label="Reviews" value={`${pro.reviews_count}`} />
        </div>

        {/* Availability toggle */}
        <Card className="mt-3 flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Availability</p>
            <p className="text-[11px] text-gray-500">Accept new booking requests</p>
          </div>
          <Toggle defaultOn={pro.status === 'available'} />
        </Card>

        {/* Service area */}
        <Card className="mt-3 flex items-center gap-3 p-4">
          <Icons.MapPin size={18} className="text-emerald-500" />
          <div className="flex-1">
            <p className="text-[11px] text-gray-400">Service Area</p>
            <p className="text-sm font-semibold text-gray-900">{pro.service_area}</p>
          </div>
          <Icons.ChevronRight size={16} className="text-gray-300" />
        </Card>

        {/* Menu */}
        <div className="mt-4 space-y-2">
          {[
            { icon: Icons.Wrench, label: 'Services Offered', value: 'Manage' },
            { icon: Icons.Tags, label: 'Pricing', value: inr(pro.starting_price) + '+' },
            { icon: Icons.Star, label: 'Ratings & Reviews', value: `${pro.reviews_count}` },
            { icon: Icons.Banknote, label: 'Bank Details', value: 'Withdraw' },
            { icon: Icons.Settings, label: 'Settings', value: '' },
            { icon: Icons.HeadphonesIcon, label: 'Help & Support', value: '' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.label} className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 text-left">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 text-gray-600">
                  <Icon size={18} />
                </div>
                <span className="flex-1 text-sm font-medium text-gray-900">{item.label}</span>
                {item.value && <span className="text-xs text-gray-400">{item.value}</span>}
                <Icons.ChevronRight size={16} className="text-gray-300" />
              </button>
            );
          })}
        </div>

        {/* Recent reviews */}
        {reviews.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-bold text-gray-900">Recent Reviews</h3>
            <div className="space-y-2">
              {reviews.map((rev) => (
                <Card key={rev.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-900">{rev.customer_name}</p>
                    <div className="flex items-center gap-1">
                      <Icons.Star size={11} className="fill-amber-400 text-amber-400" />
                      <span className="text-[11px] font-semibold">{rev.rating}</span>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-600">{rev.comment}</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        <Button
          variant="outline"
          onClick={() => { setRole('customer'); navigate({ name: 'splash' }); }}
          className="mt-4 w-full text-red-500"
        >
          <Icons.LogOut size={16} /> Logout
        </Button>
        <p className="mt-3 text-center text-[10px] text-gray-400">LuckySeva Provider v1.0.0</p>
      </div>
    </div>
  );
};

const StatBox = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <Card className="flex flex-col items-center p-3 text-center">
    <span className="text-emerald-500">{icon}</span>
    <p className="mt-1 text-sm font-bold text-gray-900">{value}</p>
    <p className="text-[10px] text-gray-400">{label}</p>
  </Card>
);

const Toggle = ({ defaultOn }: { defaultOn: boolean }) => {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      onClick={() => setOn(!on)}
      className={`relative h-7 w-12 rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-gray-200'}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
};
