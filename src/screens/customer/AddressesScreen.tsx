import * as Icons from 'lucide-react';
import { useState, useEffect } from 'react';
import { useApp } from '@/lib/app-context';
import { supabase } from '@/lib/supabase';
import { fetchCurrentLocation } from '@/lib/location';
import { TopBar } from '@/components/PhoneShell';
import { Card, Button, Spinner } from '@/components/ui';
import type { AddressRow } from '@/lib/types';

function splitAddress(full: string): { houseNo: string; area: string; city: string; state: string; pincode: string } {
  const parts = full.split(',').map((s) => s.trim()).filter(Boolean);
  let pincode = '';
  if (parts.length && /^\d{4,6}$/.test(parts[parts.length - 1])) pincode = parts.pop() || '';
  const state = parts.pop() || '';
  const city = parts.pop() || '';
  const area = parts.pop() || '';
  return { houseNo: parts.join(', '), area, city, state, pincode };
}

export const AddressesScreen = ({ detected }: { detected?: string }) => {
  const { customer } = useApp();
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');

  const fullAddress = [houseNo, area, city, state, pincode].filter(Boolean).join(', ').trim();

  useEffect(() => {
    if (!detected) return;
    const parts = splitAddress(detected);
    setHouseNo((h) => h || parts.houseNo);
    setArea((a) => a || parts.area);
    setCity((c) => c || parts.city);
    setState((s) => s || parts.state);
    setPincode((p) => p || parts.pincode);
    setAdding(true);
    setLocError('');
  }, [detected]);

  const detectLocation = async () => {
    setLocating(true);
    setLocError('');
    try {
      const loc = await fetchCurrentLocation();
      const d = loc.details;
      setHouseNo((h) => h || [d.house_number, d.road].filter(Boolean).join(', ') || '');
      setArea((a) => a || d.suburb || d.neighbourhood || '');
      setCity((c) => c || d.city || d.town || d.village || d.city_district || '');
      setState((s) => s || d.state || '');
      setPincode((p) => p || d.postcode || '');
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
    if (!label.trim() || !fullAddress || !customer?.phone) return;
    const isFirst = addresses.length === 0;
    if (isFirst) await supabase.from('addresses').insert({ customer_phone: customer.phone, label, full_address: fullAddress, is_default: true });
    else await supabase.from('addresses').insert({ customer_phone: customer.phone, label, full_address: fullAddress, is_default: false });
    setLabel('');
    setHouseNo('');
    setArea('');
    setCity('');
    setState('');
    setPincode('');
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
        {!adding && (
          <button
            onClick={() => { setAdding(true); setLocError(''); }}
            className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 bg-white p-4 text-left transition-colors hover:border-emerald-400 hover:bg-emerald-50/40"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Icons.Plus size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">Add New Address</p>
              <p className="text-[11px] text-gray-500">House No, Area, Locality, City, State, Pincode</p>
            </div>
          </button>
        )}

        {adding && (
          <Card className="mb-4 space-y-3 border-emerald-200 p-4">
            <h3 className="text-sm font-bold text-gray-900">Add New Address</h3>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (Home, Work, Other)"
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
            <input
              value={houseNo}
              onChange={(e) => setHouseNo(e.target.value)}
              placeholder="House/Flat No, Street, Road"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Area / Locality"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City / District"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <input
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Pincode"
              inputMode="numeric"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAdding(false)} className="flex-1 py-2.5 text-xs">Cancel</Button>
              <Button onClick={add} disabled={!label.trim() || !fullAddress} className="flex-1 py-2.5 text-xs">Save Address</Button>
            </div>
          </Card>
        )}

        {loading ? (
          <Spinner className="py-16" />
        ) : addresses.length === 0 ? (
          <div className="mt-6 text-center">
            <Icons.MapPin className="mx-auto text-gray-300" size={36} />
            <p className="mt-2 text-sm font-semibold text-gray-700">No saved addresses yet</p>
            <p className="mt-0.5 text-xs text-gray-500">Add one to book services faster.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
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