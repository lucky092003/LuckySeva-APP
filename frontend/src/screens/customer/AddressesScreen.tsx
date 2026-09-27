import * as Icons from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { fetchCurrentLocation, geocodeAddress } from '@/services/location';
import {
  EMPTY_ADDRESS,
  applyDetails,
  composeAddress,
  isAddressValid,
  missingAddressFields,
  splitAddress,
  validateAddress,
  type AddressParts,
} from '@/services/address';
import { TopBar } from '@/components/PhoneShell';
import { AddressForm } from '@/components/AddressForm';
import { Card, Button, Spinner } from '@/components/ui';
import type { AddressRow } from '@/types';

const LABEL_SUGGESTIONS = ['Home', 'Work', 'Other'];

export const AddressesScreen = ({ detected }: { detected?: string }) => {
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [addr, setAddr] = useState<AddressParts>(EMPTY_ADDRESS);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const fullAddress = composeAddress(addr);
  const addrErrors = validateAddress(addr);
  const addrValid = isAddressValid(addr);
  const canSave = Boolean(label.trim()) && addrValid && !saving;

  const resetForm = () => {
    setLabel('');
    setAddr(EMPTY_ADDRESS);
    setCoords(null);
    setLocError('');
    setShowErrors(false);
  };

  const openForm = () => {
    resetForm();
    setAdding(true);
  };

  useEffect(() => {
    if (!detected) return;
    setAddr((prev) => {
      const parts = splitAddress(detected);
      return {
        houseNo: prev.houseNo || parts.houseNo,
        area: prev.area || parts.area,
        city: prev.city || parts.city,
        state: prev.state || parts.state,
        pincode: prev.pincode || parts.pincode,
      };
    });
    setAdding(true);
    setLocError('');
  }, [detected]);

  const detectLocation = async () => {
    setLocating(true);
    setLocError('');
    try {
      const loc = await fetchCurrentLocation();
      const parts = applyDetails(loc.details);
      setAddr((prev) => ({
        houseNo: parts.houseNo || prev.houseNo,
        area: parts.area || prev.area,
        city: parts.city || prev.city,
        state: parts.state || prev.state,
        pincode: parts.pincode || prev.pincode,
      }));
      setCoords({ latitude: loc.latitude, longitude: loc.longitude });
    } catch (e) {
      setLocError(e instanceof Error ? e.message : 'Could not fetch your location.');
    } finally {
      setLocating(false);
    }
  };

  const load = () => {
    api.customer
      .addresses()
      .then((data) => {
        setAddresses(data || []);
        setLoading(false);
      })
      .catch(() => {
        setAddresses([]);
        setLoading(false);
      });
  };

  useEffect(load, []);

  const add = async () => {
    if (!canSave) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    let latitude: number | null = coords?.latitude ?? null;
    let longitude: number | null = coords?.longitude ?? null;
    if (latitude === null || longitude === null) {
      const geo = await geocodeAddress(addr);
      if (geo) {
        latitude = geo.latitude;
        longitude = geo.longitude;
      }
    }
    await api.customer.addAddress({ label: label.trim(), full_address: fullAddress, latitude, longitude }).catch(() => {});
    resetForm();
    setAdding(false);
    load();
  };

  const remove = async (id: string) => {
    await api.customer.deleteAddress(id).catch(() => {});
    load();
  };

  const setDefault = async (id: string) => {
    await api.customer.updateAddress(id, { is_default: true }).catch(() => {});
    load();
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar
        title="Saved Addresses"
        right={
          <button
            type="button"
            onClick={() => (adding ? setAdding(false) : openForm())}
            aria-label={adding ? 'Cancel adding address' : 'Add address'}
            className="flex h-9 w-9 items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-50"
          >
            {adding ? <Icons.X size={20} /> : <Icons.Plus size={20} />}
          </button>
        }
      />
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-5 py-4">
        {!adding && (
          <button
            type="button"
            onClick={openForm}
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
          <Card className="mb-4 space-y-4 border-emerald-200 p-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Add New Address</h3>
              <p className="mt-0.5 text-[11px] text-gray-500">
                Saved addresses can be picked later while booking.
              </p>
            </div>

            <div>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Label</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Home, Work, Other"
                className={`w-full rounded-xl border bg-white px-3.5 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 ${
                  showErrors && !label.trim()
                    ? 'border-red-300 bg-red-50/40 focus:border-red-400 focus:ring-red-100'
                    : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-100'
                }`}
              />
              <div className="mt-2 flex gap-1.5">
                {LABEL_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setLabel(s)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                      label.trim().toLowerCase() === s.toLowerCase()
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {showErrors && !label.trim() && (
                <p className="mt-1 text-[11px] font-medium text-red-500">Give this address a label</p>
              )}
            </div>

            <AddressForm
              value={addr}
              onChange={setAddr}
              errors={addrErrors}
              showErrors={showErrors}
              onLocate={detectLocation}
              locating={locating}
              locateError={locError}
            />

            {showErrors && !addrValid && (
              <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] font-medium text-amber-700">
                Please complete: {missingAddressFields(addrErrors).join(', ')}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setAdding(false);
                }}
                className="flex-1 py-2.5 text-xs"
              >
                Cancel
              </Button>
              <Button onClick={add} disabled={saving} className="flex-1 py-2.5 text-xs">
                {saving ? 'Saving...' : 'Save Address'}
              </Button>
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
            {addresses.map((addrRow) => (
              <Card
                key={addrRow.id}
                className={`p-4 transition-colors ${addrRow.is_default ? 'border-emerald-200 bg-emerald-50/40' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      addrRow.is_default ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {addrRow.label.toLowerCase().includes('work') ? (
                      <Icons.Building2 size={20} />
                    ) : addrRow.label.toLowerCase().includes('home') ? (
                      <Icons.Home size={20} />
                    ) : (
                      <Icons.MapPin size={20} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-bold text-gray-900">{addrRow.label}</p>
                      {addrRow.is_default && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-gray-600">{addrRow.full_address}</p>
                    <div className="mt-2 flex items-center gap-3">
                      {!addrRow.is_default && (
                        <button
                          type="button"
                          onClick={() => setDefault(addrRow.id)}
                          className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
                        >
                          Set as default
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(addrRow.id)}
                        className="text-[11px] font-semibold text-red-400 hover:text-red-500"
                      >
                        Remove
                      </button>
                    </div>
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
