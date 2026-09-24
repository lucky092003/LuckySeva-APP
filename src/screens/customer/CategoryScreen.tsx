import * as Icons from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { api } from '@/lib/api';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, EmptyState } from '@/components/ui';
import { inr } from '@/lib/format';
import { useEffect, useState } from 'react';
import type { Category, Service } from '@/lib/types';

export const CategoryScreen = ({ slug }: { slug: string }) => {
  const { navigate } = useApp();
  const [category, setCategory] = useState<Category | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    api.catalog
      .category(slug)
      .then((res) => {
        setCategory(res.category);
        setServices(res.services);
      })
      .catch(() => {
        setCategory(null);
        setServices([]);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const color = category?.color || '#10b981';
  const Icon = category
    ? (Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[category.icon] || Icons.Circle
    : Icons.Circle;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title={category?.name || 'Category'} />
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar">
        {category && (
          <div className="flex items-center gap-3 bg-white px-5 py-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: color + '18' }}>
              <Icon size={28} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{category.name}</h2>
              <p className="text-xs text-gray-500">{category.description}</p>
            </div>
          </div>
        )}
        <div className="px-5 py-4">
          <h3 className="mb-3 text-sm font-bold text-gray-900">All Services</h3>
          {loading ? (
            <Spinner className="py-10" />
          ) : services.length === 0 ? (
            <EmptyState icon={<Icons.Wrench size={28} />} title="No services yet" subtitle="Check back soon for new offerings." />
          ) : (
            <div className="space-y-3">
              {services.map((svc) => (
                <Card
                  key={svc.id}
                  onClick={() => navigate({ name: 'service', id: svc.id })}
                  className="flex items-center gap-4 p-4"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: color + '18' }}>
                    <Icon size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">{svc.name}</p>
                    <p className="truncate text-xs text-gray-500">{svc.description}</p>
                    <div className="mt-1 flex items-center gap-3">
                      <span className="text-[11px] text-gray-400">
                        <Icons.Clock size={11} className="mr-1 inline" />
                        {svc.estimated_duration}
                      </span>
                      {svc.popular && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">Popular</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400">from</p>
                    <p className="text-sm font-bold" style={{ color }}>{inr(svc.starting_price)}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
