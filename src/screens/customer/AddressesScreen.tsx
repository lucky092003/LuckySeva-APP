import * as Icons from 'lucide-react';
import { useState } from 'react';
import { TopBar } from '@/components/PhoneShell';
import { Card, Button, EmptyState } from '@/components/ui';

type Address = {
  id: string;
  label: string;
  full: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
};

const SAVED: Address[] = [
  { id: '1', label: 'Home', full: '12, Green Park Apartments, Koramangala 5th Block, Bangalore - 560095', icon: Icons.Home },
  { id: '2', label: 'Work', full: 'Prestige Tech Park, Tower B, Marathahalli, Bangalore - 560103', icon: Icons.Building2 },
  { id: '3', label: 'Other', full: '45, Indiranagar 2nd Stage, 100 Feet Road, Bangalore - 560038', icon: Icons.MapPin },
];

export const AddressesScreen = () => {
  const [addresses, setAddresses] = useState<Address[]>(SAVED);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [full, setFull] = useState('');

  const add = () => {
    if (!label.trim() || !full.trim()) return;
    setAddresses([...addresses, { id: Date.now().toString(), label, full, icon: Icons.MapPin }]);
    setLabel('');
    setFull('');
    setAdding(false);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar
        title="Saved Addresses"
        right={
          <button onClick={() => setAdding(!adding)} className="flex h-9 w-9 items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-50">
            <Icons.Plus size={20} />
          </button>
        }
      />
      <div className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
        {adding && (
          <Card className="mb-4 space-y-3 border-emerald-200 p-4">
            <h3 className="text-sm font-bold text-gray-900">Add New Address</h3>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (Home, Work, Other)"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            <textarea
              value={full}
              onChange={(e) => setFull(e.target.value)}
              rows={3}
              placeholder="Full address"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAdding(false)} className="flex-1 py-2.5 text-xs">Cancel</Button>
              <Button onClick={add} disabled={!label.trim() || !full.trim()} className="flex-1 py-2.5 text-xs">Save Address</Button>
            </div>
          </Card>
        )}

        {addresses.length === 0 ? (
          <EmptyState icon={<Icons.MapPin size={28} />} title="No saved addresses" subtitle="Tap + to add your first address." />
        ) : (
          <div className="space-y-3">
            {addresses.map((addr) => {
              const Icon = addr.icon;
              return (
                <Card key={addr.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900">{addr.label}</p>
                        <button
                          onClick={() => setAddresses(addresses.filter((a) => a.id !== addr.id))}
                          className="ml-auto text-[11px] font-semibold text-red-400"
                        >
                          Remove
                        </button>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{addr.full}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
