import * as Icons from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { useService, useProfessionalsByService } from '@/lib/hooks';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, Button, Stars, Badge } from '@/components/ui';
import { inr } from '@/lib/format';

export const ServiceDetailScreen = ({ id }: { id: string }) => {
  const { navigate } = useApp();
  const { service, loading } = useService(id);
  const { professionals, loading: proLoading } = useProfessionalsByService(id);

  if (loading) return <div className="flex flex-1 flex-col"><TopBar title="Service" /><Spinner className="py-20" /></div>;
  if (!service) return <div className="flex flex-1 flex-col"><TopBar title="Service" /></div>;

  const pros = professionals.filter((p) => p.reviews_count > 0);
  const totalReviews = pros.reduce((s, p) => s + p.reviews_count, 0);
  const avgRating = pros.length
    ? (pros.reduce((s, p) => s + Number(p.rating) * p.reviews_count, 0) / totalReviews)
    : 0;
  const roundedAvg = Math.round(avgRating * 10) / 10;

  const cat = (service as unknown as { category: { color: string; icon: string; name: string } }).category;
  const color = cat?.color || '#10b981';
  const Icon = cat ? (Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[cat.icon] || Icons.Circle : Icons.Circle;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title={service.name} />
      <div className="flex flex-1 flex-col overflow-y-auto pb-4">
        {/* Hero */}
        <div className="relative px-5 py-6" style={{ backgroundColor: color + '14' }}>
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
              <Icon size={32} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900">{service.name}</h2>
              <p className="mt-1 text-sm text-gray-600">{service.description}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
              <p className="text-[10px] font-medium text-gray-400">STARTING PRICE</p>
              <p className="text-base font-bold" style={{ color }}>{inr(service.starting_price)}</p>
            </div>
            <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
              <p className="text-[10px] font-medium text-gray-400">DURATION</p>
              <p className="text-base font-bold text-gray-900">{service.estimated_duration}</p>
            </div>
          </div>
        </div>

        {/* What's included */}
        <div className="px-5 pt-5">
          <h3 className="mb-2 text-sm font-bold text-gray-900">What's included</h3>
          <Card className="p-4">
            <ul className="space-y-2.5">
              {['Professional inspection & diagnosis', 'Quality spare parts if needed', 'Workmanship guaranteed', 'Service warranty up to 30 days'].map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-gray-600">
                  <Icons.Check size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Available professionals */}
        <div className="px-5 pt-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Available Professionals</h3>
            <button onClick={() => navigate({ name: 'professionals', slug: (service as unknown as { category: { slug: string } }).category?.slug || '' })} className="text-xs font-semibold text-emerald-600">See all</button>
          </div>
          {proLoading ? (
            <Spinner className="py-6" />
          ) : professionals.length === 0 ? (
            <Card className="p-4 text-center text-sm text-gray-500">No professionals available for this service yet.</Card>
          ) : (
            <div className="space-y-3">
              {professionals.slice(0, 3).map((pro) => (
                <Card key={pro.id} onClick={() => navigate({ name: 'professional', id: pro.id })} className="flex items-center gap-3 p-3">
                  <img src={pro.avatar_url} alt={pro.name} className="h-12 w-12 rounded-full bg-gray-100 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">{pro.name}</p>
                    <div className="flex items-center gap-1.5">
                      <Stars rating={pro.rating} />
                      <span className="text-[11px] text-gray-500">{pro.rating} · {pro.completed_jobs} jobs</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-gray-400">{pro.experience_years} yrs exp · {pro.distance_km} km away</p>
                  </div>
                  <Badge tone={pro.status === 'available' ? 'success' : 'warning'}>
                    {pro.status === 'available' ? 'Available' : 'Busy'}
                  </Badge>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Reviews summary */}
        <div className="px-5 pt-5">
          <h3 className="mb-2 text-sm font-bold text-gray-900">Ratings & Reviews</h3>
          {pros.length > 0 ? (
            <>
              <Card className="flex items-center gap-4 p-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">{roundedAvg}</p>
                  <Stars rating={avgRating} />
                  <p className="mt-1 text-[10px] text-gray-400">Based on {totalReviews}+ reviews</p>
                </div>
                <div className="flex-1 space-y-1">
                  {pros.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="w-3 text-[10px] text-gray-500">{p.rating}</span>
                      <div className="h-1.5 flex-1 rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.round(p.rating * 20)}%` }} />
                      </div>
                      <span className="w-10 text-right text-[10px] text-gray-400">{p.reviews_count} rev</span>
                    </div>
                  ))}
                </div>
              </Card>
              <p className="mt-1.5 text-[10px] text-gray-400">Aggregated from {pros.length} professionals offering this service.</p>
            </>
          ) : (
            <Card className="p-4 text-center text-sm text-gray-500">No reviews yet.</Card>
          )}
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="shrink-0 border-t border-gray-100 bg-white p-3">
        <Button onClick={() => navigate({ name: 'booking', serviceId: id })} className="w-full">
          Book Now · {inr(service.starting_price)} onwards
        </Button>
      </div>
    </div>
  );
};
