import * as Icons from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { useProfessional, useReviews, useIsFavourite, toggleFavourite } from '@/lib/hooks';
import { api } from '@/lib/api';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, Stars, Badge, Button, EmptyState } from '@/components/ui';
import { inr, formatDate } from '@/lib/format';
import type { Service } from '@/lib/types';
import { useEffect, useState } from 'react';

export const ProfessionalProfileScreen = ({ id }: { id: string }) => {
  const { navigate, customer } = useApp();
  const { professional, loading } = useProfessional(id);
  const { reviews, loading: revLoading } = useReviews(id);
  const { isFav } = useIsFavourite(customer?.phone || null, id);
  const [fav, setFav] = useState(false);
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    setFav(isFav);
  }, [isFav]);

  const toggle = async () => {
    const next = await toggleFavourite(customer?.phone || null, id);
    setFav(next);
  };

  useEffect(() => {
    if (!id) return;
    api.catalog
      .professional(id)
      .then((res) => setServices(res.services.map((r) => r.service).filter(Boolean)))
      .catch(() => setServices([]));
  }, [id]);

  if (loading) return <div className="flex flex-1 flex-col"><TopBar title="Profile" /><Spinner className="py-20" /></div>;
  if (!professional) return <div className="flex flex-1 flex-col"><TopBar title="Profile" /></div>;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar
        title="Professional"
        right={
          <button onClick={toggle} className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${fav ? 'bg-red-50 text-red-500' : 'text-gray-500 hover:bg-gray-100'}`}>
            <Icons.Heart size={19} className={fav ? 'fill-red-500' : ''} />
          </button>
        }
      />
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar pb-4">
        {/* Profile header */}
        <div className="bg-white px-5 py-5">
          <div className="flex items-start gap-4">
            <div className="relative">
              <img src={professional.avatar_url} alt={professional.name} className="h-20 w-20 rounded-2xl bg-gray-100 object-cover" />
              <span className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white ${professional.status === 'available' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{professional.name}</h2>
                <Icons.BadgeCheck size={18} className="text-emerald-500" />
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <Stars rating={professional.rating} size={14} />
                <span className="text-sm font-semibold text-gray-700">{professional.rating}</span>
                <span className="text-xs text-gray-400">({professional.reviews_count} reviews)</span>
              </div>
              <Badge tone={professional.status === 'available' ? 'success' : 'warning'}>
                {professional.status === 'available' ? 'Available now' : 'Currently busy'}
              </Badge>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-600">{professional.bio}</p>
          <div className="mt-4 flex items-center gap-2">
            {professional.phone ? (
              <a href={`tel:${professional.phone}`} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-50 py-2.5 text-xs font-bold text-emerald-700">
                <Icons.Phone size={14} /> Call
              </a>
            ) : (
              <span className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-50 py-2.5 text-xs font-bold text-gray-400">
                <Icons.Phone size={14} /> Call
              </span>
            )}
            <button onClick={() => navigate({ name: 'help' })} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-50 py-2.5 text-xs font-bold text-sky-700">
              <Icons.MessageCircle size={14} /> Chat
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 px-5 pt-4">
          <Stat icon={<Icons.Briefcase size={16} />} label="Experience" value={`${professional.experience_years} yrs`} />
          <Stat icon={<Icons.CheckCircle2 size={16} />} label="Completed" value={`${professional.completed_jobs}`} />
          <Stat icon={<Icons.MapPin size={16} />} label="Distance" value={`${professional.distance_km} km`} />
        </div>

        {/* Skills */}
        <div className="px-5 pt-5">
          <h3 className="mb-2 text-sm font-bold text-gray-900">Skills & Expertise</h3>
          <div className="flex flex-wrap gap-2">
            {professional.skills.map((s) => (
              <span key={s} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700">{s}</span>
            ))}
          </div>
        </div>

        {/* Service area */}
        <div className="px-5 pt-5">
          <h3 className="mb-2 text-sm font-bold text-gray-900">Service Area</h3>
          <Card className="flex items-center gap-3 p-4">
            <Icons.MapPin size={18} className="text-emerald-500" />
            <p className="text-sm text-gray-700">{professional.service_area}</p>
          </Card>
        </div>

        {/* Services offered */}
        {services.length > 0 && (
          <div className="px-5 pt-5">
            <h3 className="mb-2 text-sm font-bold text-gray-900">Services Offered</h3>
            <Card className="divide-y divide-gray-50">
              {services.map((svc) => (
                <div key={svc.id} className="flex items-center justify-between p-3.5">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{svc.name}</p>
                    <p className="text-[11px] text-gray-400">{svc.estimated_duration}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">{inr(svc.starting_price)}</span>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* Reviews */}
        <div className="px-5 pt-5">
          <h3 className="mb-2 text-sm font-bold text-gray-900">Reviews ({reviews.length})</h3>
          {revLoading ? (
            <Spinner className="py-6" />
          ) : reviews.length === 0 ? (
            <EmptyState icon={<Icons.MessageSquare size={24} />} title="No reviews yet" />
          ) : (
            <div className="space-y-3">
              {reviews.map((rev) => (
                <Card key={rev.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                        {rev.customer_name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{rev.customer_name}</p>
                        <p className="text-[10px] text-gray-400">{formatDate(rev.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Icons.Star size={12} className="fill-amber-400 text-amber-400" />
                      <span className="text-xs font-semibold text-gray-700">{rev.rating}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-600">{rev.comment}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="shrink-0 border-t border-gray-100 bg-white p-3">
        <Button
          onClick={() => navigate({ name: 'booking', serviceId: services[0]?.id || '', professionalId: id })}
          disabled={services.length === 0}
          className="w-full"
        >
          Book Now · {inr(professional.starting_price)} onwards
        </Button>
      </div>
    </div>
  );
};

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex flex-col items-center rounded-xl bg-white p-3 text-center shadow-sm">
    <span className="text-emerald-500">{icon}</span>
    <p className="mt-1 text-sm font-bold text-gray-900">{value}</p>
    <p className="text-[10px] text-gray-400">{label}</p>
  </div>
);
