import * as Icons from 'lucide-react';
import { useState, useEffect } from 'react';
import { useApp } from '@/lib/app-context';
import { supabase } from '@/lib/supabase';
import { fetchCurrentLocation } from '@/lib/location';
import { TopBar } from '@/components/PhoneShell';
import { Card, Button, EmptyState, Spinner } from '@/components/ui';
import type { AddressRow } from '@/lib/types';

export const AddressesScreen = () => {
  const { customer } = useApp();
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [full, setFull] = useState('');
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');

  const detectLocation = async () => {
    setLocating(true);
    setLocError('');
    try {
      const loc = await fetchCurrentLocation();
      setFull((f) => (f ? f : loc.address));
    } catch (e) {
      setLocError(e instanceof Error ? e.message : 'Could not fetch your location.');
    } finally {
      setLocating(false);
    }
  };

  const load = () => {
    if (!customer?.phone) {
      setLoading(false);
      return;
    }
    supabase
      .from('addresses')
      .select('*')
      .eq('customer_phone', customer.phone)
      .order('is_default', { ascending: false })
      .then(({ data }) => {
        setAddresses((data as AddressRow[]) || []);
        setLoading(false);
      });
  };

  useEffect(load, [customer]);

  const add = async () => {
    if (!label.trim() || !full.trim() || !customer?.phone) return;
    const isFirst = addresses.length === 0;
    if (isFirst) await supabase.from('addresses').insert({ customer_phone: customer.phone, label, full_address: full, is_default: true });
    else await supabase.from('addresses').insert({ customer_phone: customer.phone, label, full_address: full, is_default: false });
    setLabel('');
    setFull('');
    setAdding(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from('addresses').delete().eq('id', id);
    load();
  };

  const setDefault = async (id: string) => {
    if (!customer?.phone) return;
    await supabase.from('addresses').update({ is_default: false }).eq('customer_phone', customer.phone);
    await supabase.from('addresses').update({ is_default: true }).eq('id', id);
    load();
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
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-5 py-4">
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
            <button
              onClick={detectLocation}
              disabled={locating}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
            >
              <Icons.LocateFixed size={14} />
              {locating ? 'Fetching your location...' : 'Use my current location'}
            </button>
            {locError && <p className="text-xs text-red-500">{locError}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAdding(false)} className="flex-1 py-2.5 text-xs">Cancel</Button>
              <Button onClick={add} disabled={!label.trim() || !full.trim()} className="flex-1 py-2.5 text-xs">Save Address</Button>
            </div>
          </Card>
        )}

        {loading ? (
          <Spinner className="py-16" />
        ) : addresses.length === 0 ? (
          <EmptyState icon={<Icons.MapPin size={28} />} title="No saved addresses" subtitle="Tap + to add your first address." />
        ) : (
          <div className="space-y-3">
            {addresses.map((addr) => (
              <Card key={addr.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    {addr.label.toLowerCase().includes('work') ? <Icons.Building2 size={20} /> : addr.label.toLowerCase().includes('home') ? <Icons.Home size={20} /> : <Icons.MapPin size={20} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900">{addr.label}</p>
                      {addr.is_default && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-600">DEFAULT</span>}
                      <button onClick={() => remove(addr.id)} className="ml-auto text-[11px] font-semibold text-red-400">
                        Remove
                      </button>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{addr.full_address}</p>
                    {!addr.is_default && (
                      <button onClick={() => setDefault(addr.id)} className="mt-1.5 text-[11px] font-semibold text-emerald-600">
                        Set as default
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};