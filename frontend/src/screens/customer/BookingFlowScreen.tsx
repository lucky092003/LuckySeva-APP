import { useState, useEffect, useMemo, useRef } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '@/context/app-context';
import { useServiceDetail, useCustomerCoords, NEARBY_LIMIT } from '@/hooks';
import { ApiError, api } from '@/services/api';
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
import { Card, Spinner, Button, Stars, Avatar, VerifiedBadge } from '@/components/ui';
import { inr, toISODate } from '@/utils/format';
import { isVerified } from '@/utils/kyc';
import type { Booking, AddressRow, Service } from '@/types';

/**
 * Slot labels double as the stored `bookings.scheduled_time` value, which every
 * screen renders verbatim — so they stay `HH:MM AM/PM` and `minutes` is only
 * used to work out whether a slot is still bookable.
 */
const TIME_SLOTS = [
  { label: '08:00 AM', minutes: 8 * 60 },
  { label: '10:00 AM', minutes: 10 * 60 },
  { label: '11:00 AM', minutes: 11 * 60 },
  { label: '12:00 PM', minutes: 12 * 60 },
  { label: '02:00 PM', minutes: 14 * 60 },
  { label: '04:00 PM', minutes: 16 * 60 },
  { label: '06:00 PM', minutes: 18 * 60 },
];

/** Days offered in the picker, starting today. */
const BOOKING_DAYS = 7;

/** Notice a professional needs before a same-day visit, in minutes. */
const MIN_LEAD_MINUTES = 120;

const COUPONS: Record<string, { discount: number; label: string; desc: string }> = {
  LUCKY20: { discount: 0.2, label: '20% OFF', desc: 'Flat 20% off (first booking)' },
  SEVA50: { discount: 50, label: '₹50 OFF', desc: 'Flat ₹50 off on any service' },
  CLEAN100: { discount: 100, label: '₹100 OFF', desc: '₹100 off on cleaning services' },
};

/** Flat fee added on top of whichever professional the customer picks. */
const VISIT_FEE = 49;

/** Surcharge for booking one of the top-5 recommended professionals. */
const PRIORITY_FEE = 99;

/** Steps: pick professional, date & time, address, review. */
const PRO_STEP = 1;
const WHEN_STEP = 2;
const ADDR_STEP = 3;
const REVIEW_STEP = 4;
const STEPS = ['Professional', 'Date & Time', 'Address', 'Review'];

const PAYMENT_METHODS = [
  { key: 'cash', label: 'Pay with Cash', icon: 'Banknote', desc: 'Pay the professional after service' },
  { key: 'upi', label: 'UPI', icon: 'Smartphone', desc: 'GPay, PhonePe, Paytm & more' },
  { key: 'card', label: 'Credit / Debit Card', icon: 'CreditCard', desc: 'Mastercard, Visa, RuPay' },
  { key: 'netbanking', label: 'Net Banking', icon: 'Landmark', desc: 'All major banks supported' },
] as const;

/** Default address first so the one the customer actually uses sits at the top. */
const sortSavedAddresses = (list: AddressRow[]) =>
  [...list].sort((a, b) => Number(b.is_default) - Number(a.is_default));

export const BookingFlowScreen = ({ serviceId, professionalId }: { serviceId: string; professionalId?: string }) => {
  const { navigate, customer } = useApp();
  const coords = useCustomerCoords();
  const { service, providers, nearby, loading, located } = useServiceDetail(serviceId, coords);

  const [step, setStep] = useState(1);
  /** Which professional the customer picked in step 1, if any. */
  const [pickedId, setPickedId] = useState<string | null>(professionalId || null);
  /** Bookable day as `YYYY-MM-DD`, so the choice survives the window moving. */
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [slot, setSlot] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [addr, setAddr] = useState<AddressParts>(EMPTY_ADDRESS);
  const [locCoords, setLocCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [savedAddrs, setSavedAddrs] = useState<AddressRow[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddrErrors, setShowAddrErrors] = useState(false);
  const defaultAppliedRef = useRef(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; label: string } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [method, setMethod] = useState<string>('cash');

  const address = composeAddress(addr);
  const addrErrors = validateAddress(addr);
  const addrValid = isAddressValid(addr);
  const missing = missingAddressFields(addrErrors);

  /** Any hand edit means the form no longer matches the selected saved address. */
  const updateAddr = (patch: Partial<AddressParts>) => {
    setSelectedAddressId(null);
    setAddr((prev) => ({ ...prev, ...patch }));
  };

  const applySavedAddress = (a: AddressRow) => {
    setAddr(splitAddress(a.full_address));
    setLocCoords(a.latitude != null && a.longitude != null ? { latitude: a.latitude, longitude: a.longitude } : null);
    setSelectedAddressId(a.id);
  };

  const fillFromDetails = (loc: { address: string; details: Record<string, string>; latitude: number; longitude: number }) => {
    setLocCoords({ latitude: loc.latitude, longitude: loc.longitude });
    setSelectedAddressId(null);
    let parts = applyDetails(loc.details);
    if (!parts.houseNo && !parts.area && !parts.city) {
      const fallback = splitAddress(loc.address);
      if (fallback.houseNo || fallback.area || fallback.city) parts = fallback;
    }
    setAddr((prev) => ({
      houseNo: parts.houseNo || prev.houseNo,
      area: parts.area || prev.area,
      city: parts.city || prev.city,
      state: parts.state || prev.state,
      pincode: parts.pincode || prev.pincode,
    }));
  };

  useEffect(() => {
    if (step !== ADDR_STEP) {
      defaultAppliedRef.current = false;
      setSavedAddrs([]);
      setSelectedAddressId(null);
      return;
    }
    api.customer
      .addresses()
      .then((data) => setSavedAddrs(sortSavedAddresses(data || [])))
      .catch(() => setSavedAddrs([]));
  }, [step]);

  useEffect(() => {
    if (step !== ADDR_STEP || defaultAppliedRef.current) return;
    const def = savedAddrs.find((a) => a.is_default);
    if (!def) return;
    defaultAppliedRef.current = true;
    applySavedAddress(def);
  }, [step, savedAddrs]);

  // Pinned once per mount. Rebuilding it every render meant that leaving the app
  // open across midnight re-labelled every chip and silently moved the selected
  // index onto a different calendar day.
  const dates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: BOOKING_DAYS }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  }, []);

  const selectedDate = dates.find((d) => toISODate(d) === date) ?? dates[0];
  const dateLabel = selectedDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  // Recomputed each render rather than memoised on purpose: the lead-time cut-off
  // moves with the wall clock, and this screen is not hot enough to care.
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayISO = toISODate(now);
  const isToday = date === todayISO;

  /**
   * Takes the day explicitly rather than closing over `date`. The date chips call
   * this for the day being *switched to*, which is not the day still in state,
   * so a closure here would silently validate the previous day's pick.
   */
  const slotPastOn = (dayISO: string, minutes: number) =>
    dayISO === todayISO && minutes < nowMinutes + MIN_LEAD_MINUTES;

  const isSlotPast = (minutes: number) => slotPastOn(date, minutes);
  const availableSlots = TIME_SLOTS.filter((s) => !isSlotPast(s.minutes));
  const nextFreeSlot = availableSlots.length ? availableSlots[0].label : '';

  /** The chosen slot, re-checked against the current time at the moment it is used. */
  const chosenSlot = TIME_SLOTS.find((s) => s.label === slot);
  const whenValid = !!chosenSlot && !isSlotPast(chosenSlot.minutes);

  // Same honesty rule as the service screen: only rank by distance when the
  // customer actually has coordinates, otherwise fall back to top rated.
  const candidates = useMemo(() => {
    const list = located ? nearby : nearby.length ? nearby : providers;
    return list.slice(0, NEARBY_LIMIT);
  }, [located, nearby, providers]);

  // A professionalId handed in from the profile screen may sit outside the top
  // 5, so resolve it from the wider list too. Falling back to null would let the
  // customer reach the review step with nobody assigned.
  const picked = useMemo(() => {
    if (!pickedId) return null;
    return (
      candidates.find((p) => p.id === pickedId) ||
      nearby.find((p) => p.id === pickedId) ||
      providers.find((p) => p.id === pickedId) ||
      null
    );
  }, [candidates, nearby, providers, pickedId]);

  /**
   * A professional's `starting_price` is one flat floor for everything they
   * offer, so charging it for every service overcharges most jobs. Read the
   * real price for THIS service out of the professional_services join instead,
   * and only fall back to the floor when the join has no row for it.
   */
  const [proServices, setProServices] = useState<Record<string, Service[]>>({});

  useEffect(() => {
    const targets = candidates.filter((p) => !proServices[p.id]);
    if (targets.length === 0) return;
    let active = true;
    Promise.all(
      targets.map((p) =>
        api.catalog
          .professional(p.id)
          .then((res) => [p.id, (res.services || []).map((r) => r.service).filter(Boolean)] as const)
          .catch(() => [p.id, [] as Service[]] as const)
      )
    ).then((pairs) => {
      if (!active) return;
      setProServices((prev) => {
        const next = { ...prev };
        for (const [pid, svcs] of pairs) next[pid] = svcs;
        return next;
      });
    });
    return () => {
      active = false;
    };
  }, [candidates, proServices]);

  /** What this professional actually charges for the selected service. */
  const priceFor = (proId: string, floor: number) => {
    const match = proServices[proId]?.find((s) => s.id === serviceId);
    return match ? Number(match.starting_price) || floor : floor;
  };

  if (loading) return <div className="flex flex-1 flex-col"><TopBar title="Book Service" /><Spinner className="py-20" /></div>;
  if (!service) return <div className="flex flex-1 flex-col"><TopBar title="Book Service" /></div>;

  const base = picked
    ? priceFor(picked.id, Number(picked.starting_price) || service.starting_price)
    : service.starting_price;
  const visitFee = VISIT_FEE;
  // Mirrors the backend: only a pick from the top-N list carries the surcharge.
  // Display only — the server recomputes and owns the real number.
  const priorityFee =
    picked && candidates.some((p) => p.id === picked.id) ? PRIORITY_FEE : 0;
  let discountAmount = 0;
  if (appliedCoupon) {
    const preDiscount = base + visitFee + priorityFee;
    if (appliedCoupon.discount < 1) {
      discountAmount = Math.round(preDiscount * appliedCoupon.discount);
    } else {
      discountAmount = Math.min(appliedCoupon.discount, preDiscount);
    }
  }
  const total = base + visitFee + priorityFee - discountAmount;

  const applyCoupon = () => {
    const code = couponCode.toUpperCase().trim();
    setCouponError('');
    if (!code) return;
    const coupon = COUPONS[code];
    if (!coupon) {
      setCouponError('Invalid coupon code');
      setAppliedCoupon(null);
      return;
    }
    if (code === 'CLEAN100' && service.name.toLowerCase().indexOf('clean') === -1) {
      setCouponError('This coupon is valid only on cleaning services');
      setAppliedCoupon(null);
      return;
    }
    setAppliedCoupon({ code, discount: coupon.discount, label: coupon.label });
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const confirm = async () => {
    if (!customer?.name || !customer?.phone) {
      navigate({ name: 'auth' });
      return;
    }
    if (!addrValid) {
      setStep(ADDR_STEP);
      setShowAddrErrors(true);
      return;
    }
    // Re-checked here because `canNext` only gates the Continue button: the
    // customer can sit on the review step long enough for a same-day slot to
    // drop inside the lead time. Send them back rather than posting a booking
    // that the server has to reject.
    if (!whenValid) {
      setSlot('');
      setStep(WHEN_STEP);
      return;
    }
    setSubmitError('');
    setSubmitting(true);
    let latitude: number | null = locCoords?.latitude ?? null;
    let longitude: number | null = locCoords?.longitude ?? null;
    if (latitude === null || longitude === null) {
      const geo = await geocodeAddress(addr);
      if (geo) {
        latitude = geo.latitude;
        longitude = geo.longitude;
      }
    }
    let booking: Booking;
    try {
      booking = await api.customer.createBooking({
        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_address: address,
        address_id: selectedAddressId,
        latitude,
        longitude,
        service_id: service.id,
        service_name: service.name,
        professional_id: picked?.id || null,
        professional_name: picked?.name || 'Auto-assign',
        scheduled_date: date,
        scheduled_time: slot,
        notes,
        base_price: base,
        visit_fee: visitFee,
        // The server recomputes this from the top-N check; sent only so the
        // displayed total and the stored total agree before the response.
        priority_fee: priorityFee,
        total_amount: total,
        payment_method: method,
        payment_status: method === 'cash' ? 'cash' : 'pending',
        status: 'confirmed',
      });
    } catch (e) {
      setSubmitting(false);
      // Swallowing this made a rejected POST look like the button had frozen.
      setSubmitError(
        e instanceof ApiError ? e.message : 'Could not place the booking. Please try again.'
      );
      return;
    }
    setSubmitting(false);
    if (method === 'cash') {
      navigate({ name: 'booking-success', bookingId: booking.id });
    } else {
      navigate({ name: 'payment', bookingId: booking.id });
    }
  };

  const fetchLocation = async () => {
    setLocating(true);
    setLocError('');
    try {
      const loc = await fetchCurrentLocation();
      fillFromDetails(loc);
    } catch (e) {
      setLocError(e instanceof Error ? e.message : 'Could not fetch your location.');
    } finally {
      setLocating(false);
    }
  };

  const goNext = () => {
    // A failed submit describes the payload they just changed, so it goes stale
    // the moment they move off the review step.
    setSubmitError('');
    if (step === ADDR_STEP && !addrValid) {
      setShowAddrErrors(true);
      return;
    }
    setShowAddrErrors(false);
    setStep(step + 1);
  };

  const canNext =
    // With nobody to choose from the flow falls through to auto-assign, so the
    // picker must not be able to block the customer on an empty list.
    step === PRO_STEP ? !picked || !!candidates.find((p) => p.id === pickedId)
      : step === WHEN_STEP ? whenValid
      : step === ADDR_STEP ? addrValid
      : true;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="Book Service" />
      {/* Stepper */}
      <div className="flex shrink-0 items-center justify-center gap-2 border-b border-gray-100 bg-white px-5 py-3">
        {STEPS.map((label, i) => {
          const n = i + 1;
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${step > n ? 'bg-emerald-500 text-white' : step === n ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {step > n ? <Icons.Check size={12} /> : n}
              </div>
              <span className={`text-[11px] font-semibold ${step >= n ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
              {i < STEPS.length - 1 && <div className="h-px w-4 bg-gray-200" />}
            </div>
          );
        })}
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-5 py-4">
        {/* Service summary */}
        <Card className="mb-4 flex items-center gap-3 p-3">
          {picked && (
            <Avatar
              src={picked.avatar_url}
              name={picked.name}
              className="h-11 w-11 rounded-xl text-xs"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-gray-900">{service.name}</p>
            {picked ? (
              <p className="text-[11px] text-gray-500">
                {picked.name} · {inr(base)} + {inr(visitFee + priorityFee)} charges
              </p>
            ) : (
              <p className="text-[11px] text-gray-500">
                {inr(service.starting_price)} onwards · pick a professional
              </p>
            )}
          </div>
          {picked && (
            <div className="flex shrink-0 items-center gap-1">
              <Stars rating={picked.rating} size={11} />
              <span className="text-[11px] font-semibold">{picked.rating}</span>
            </div>
          )}
        </Card>

        {step === PRO_STEP && (
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-bold text-gray-900">Choose a Professional</h3>
              <span className="text-[11px] text-gray-400">
                {located ? `Top ${candidates.length} within range` : `Top ${candidates.length} rated`}
              </span>
            </div>

            {candidates.length === 0 ? (
              <Card className="p-4 text-center text-sm text-gray-500">
                No professionals are offering this service right now. Continue and we
                will assign the nearest available one.
              </Card>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                {candidates.map((pro, i) => {
                  const selected = pro.id === pickedId;
                  const proPrice = priceFor(pro.id, Number(pro.starting_price) || service.starting_price);
                  return (
                    <button
                      key={pro.id}
                      onClick={() => setPickedId(pro.id)}
                      aria-pressed={selected}
                      className={`flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors ${
                        i > 0 ? 'border-t border-gray-100' : ''
                      } ${selected ? 'bg-emerald-50/60' : 'hover:bg-gray-50 active:bg-gray-100/70'}`}
                    >
                      <Avatar
                        src={pro.avatar_url}
                        name={pro.name}
                        className="h-11 w-11 rounded-full text-xs"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-bold text-gray-900">{pro.name}</p>
                          {isVerified(pro) && <VerifiedBadge />}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <Stars rating={pro.rating} size={11} />
                          <span className="text-[11px] font-semibold text-gray-700">{pro.rating}</span>
                          <span className="text-[11px] text-gray-400">
                            ({pro.reviews_count} {pro.reviews_count === 1 ? 'review' : 'reviews'})
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-gray-400">
                          {[
                            `${pro.experience_years} yrs exp`,
                            `${pro.completed_jobs} ${pro.completed_jobs === 1 ? 'job' : 'jobs'}`,
                            located ? `${pro.distance_km} km away` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="block text-[10px] leading-none text-gray-400">
                          {inr(VISIT_FEE + PRIORITY_FEE)} charges
                        </span>
                        <span className="mt-1 block text-sm font-bold leading-none text-emerald-600">
                          {inr(proPrice)}
                        </span>
                        <span className="mt-1 block text-[10px] leading-none text-gray-400">
                          = {inr(proPrice + VISIT_FEE + PRIORITY_FEE)}
                        </span>
                      </div>

                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          selected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300'
                        }`}
                      >
                        {selected && <Icons.Check size={12} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
              Every booking adds a {inr(VISIT_FEE)} visitation fee for travel and
              tools. Choosing one of these top {candidates.length} recommended
              professionals adds a {inr(PRIORITY_FEE)} priority charge on top. You
              can change your choice on the review step.
            </p>
          </div>
        )}

        {step === WHEN_STEP && (
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-bold text-gray-900">Select Date</h3>
                <span className="text-[11px] text-gray-400">Next {BOOKING_DAYS} days</span>
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" role="group" aria-label="Select a date">
                {dates.map((d) => {
                  const iso = toISODate(d);
                  const active = date === iso;
                  return (
                    <button
                      key={iso}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setDate(iso);
                        // A slot that was bookable on the old day can be inside
                        // the lead time on the new one, so drop a pick that no
                        // longer holds rather than letting `whenValid` silently
                        // fail with Continue greyed out and no explanation.
                        setSlot((prev) => {
                          const chosen = TIME_SLOTS.find((s) => s.label === prev);
                          if (!chosen) return prev;
                          return slotPastOn(iso, chosen.minutes) ? '' : prev;
                        });
                      }}
                      className={`flex shrink-0 flex-col items-center rounded-xl border px-3 py-2.5 transition-all ${active ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'}`}
                    >
                      <span className={`text-[10px] font-medium ${active ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {iso === todayISO
                          ? 'Today'
                          : d.toLocaleDateString('en-IN', { weekday: 'short' })}
                      </span>
                      <span className={`text-base font-bold ${active ? 'text-emerald-600' : 'text-gray-900'}`}>{d.getDate()}</span>
                      <span className={`text-[10px] ${active ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {d.toLocaleDateString('en-IN', { month: 'short' })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-bold text-gray-900">Select Time Slot</h3>
                {isToday && availableSlots.length > 0 && availableSlots.length < TIME_SLOTS.length && (
                  <span className="text-[11px] text-amber-600">Same-day from {nextFreeSlot}</span>
                )}
              </div>
              {availableSlots.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-center text-xs text-gray-500">
                  No slots left today — same-day bookings need {MIN_LEAD_MINUTES / 60} hours' notice.
                  Please pick another day.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Select a time slot">
                  {availableSlots.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      aria-pressed={slot === s.label}
                      onClick={() => setSlot(s.label)}
                      className={`rounded-xl border py-2.5 text-xs font-semibold transition-all ${slot === s.label ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-gray-200 bg-white text-gray-600'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === ADDR_STEP && (
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-bold text-gray-900">Service Address</h3>
                <span className="text-[11px] text-gray-400">
                  {selectedAddressId ? 'Editing deselects the saved address' : 'Tap a saved one or add new'}
                </span>
              </div>

              {savedAddrs.length > 0 && (
                <div className="space-y-2">
                  {savedAddrs.map((a) => {
                    const selected = selectedAddressId === a.id;
                    const icon = a.label.toLowerCase().includes('work')
                      ? Icons.Building2
                      : a.label.toLowerCase().includes('home')
                        ? Icons.Home
                        : Icons.MapPin;
                    const Icon = icon;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => applySavedAddress(a)}
                        aria-pressed={selected}
                        className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                          selected
                            ? 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                            selected ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className={`text-xs font-bold ${selected ? 'text-emerald-800' : 'text-gray-900'}`}>{a.label}</p>
                            {a.is_default && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-gray-600">{a.full_address}</p>
                        </div>
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            selected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300'
                          }`}
                        >
                          {selected && <Icons.Check size={12} strokeWidth={3} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {savedAddrs.length > 0 && (
                <div className="my-3 flex items-center gap-3">
                  <span className="h-px flex-1 bg-gray-200" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Or add a new address</span>
                  <span className="h-px flex-1 bg-gray-200" />
                </div>
              )}

              <AddressForm
                value={addr}
                onChange={updateAddr}
                errors={addrErrors}
                showErrors={showAddrErrors}
                onLocate={fetchLocation}
                locating={locating}
                locateError={locError}
              />
              {showAddrErrors && !addrValid && (
                <p className="mt-2.5 rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] font-medium text-amber-700">
                  Please complete: {missing.join(', ')}
                </p>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-bold text-gray-900">Add Notes / Instructions</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any specific requirements or instructions for the professional"
                className="w-full rounded-xl border border-gray-200 p-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>
        )}

        {step === REVIEW_STEP && (
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-bold text-gray-900">Choose Payment Method</h3>
              <div className="space-y-2">
                {PAYMENT_METHODS.map((pm) => {
                  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[pm.icon] || Icons.Wallet;
                  const selected = method === pm.key;
                  return (
                    <button
                      key={pm.key}
                      onClick={() => setMethod(pm.key)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${selected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'}`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${selected ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-bold ${selected ? 'text-emerald-700' : 'text-gray-900'}`}>{pm.label}</p>
                        <p className="text-[11px] text-gray-500">{pm.desc}</p>
                      </div>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-emerald-500' : 'border-gray-300'}`}>
                        {selected && <span className="h-3 w-3 rounded-full bg-emerald-500" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-bold text-gray-900">Booking Summary</h3>
              <Card className="space-y-3 p-4">
                <Row label="Service" value={service.name} />
                <Row label="Professional" value={picked?.name || 'Auto-assigned'} />
                <Row label="Date" value={dateLabel} />
                <Row label="Time" value={slot} />
                <Row label="Address" value={address} />
                <Row label="Payment" value={PAYMENT_METHODS.find((pm) => pm.key === method)?.label || method} />
                {notes && <Row label="Notes" value={notes} />}
              </Card>
            </div>

            {/* Coupon */}
            <div>
              <h3 className="mb-2 text-sm font-bold text-gray-900">Apply Coupon</h3>
              {appliedCoupon ? (
                <Card className="flex items-center gap-3 border-emerald-200 bg-emerald-50/40 p-3.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                    <Icons.TicketPercent size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-emerald-700">{appliedCoupon.code} · {appliedCoupon.label}</p>
                    <p className="text-[11px] text-gray-500">You saved {inr(discountAmount)}</p>
                  </div>
                  <button onClick={removeCoupon} className="text-xs font-semibold text-red-400">Remove</button>
                </Card>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                      placeholder="Enter coupon code"
                      className="flex-1 rounded-xl border border-gray-200 px-3.5 py-3 text-sm uppercase placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                    <Button variant="outline" onClick={applyCoupon} disabled={!couponCode.trim()} className="px-5">
                      Apply
                    </Button>
                  </div>
                  {couponError && <p className="mt-1.5 text-xs text-red-500">{couponError}</p>}
                  <div className="mt-2 space-y-1.5">
                    {Object.entries(COUPONS).map(([code, c]) => (
                      <button
                        key={code}
                        onClick={() => { setCouponCode(code); setCouponError(''); }}
                        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-200 p-2.5 text-left"
                      >
                        <Icons.TicketPercent size={15} className="text-emerald-500" />
                        <span className="text-xs font-bold text-gray-900">{code}</span>
                        <span className="text-[11px] text-gray-500">· {c.desc}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Price breakdown */}
            <div>
              <h3 className="mb-2 text-sm font-bold text-gray-900">Price Breakdown</h3>
              <Card className="space-y-2.5 p-4">
                <Row
                  label={`${service.name}${picked ? '' : ' (from'}`}
                  value={`${inr(base)}${picked ? '' : ')'}`}
                />
                <Row
                  label="Visitation fee"
                  value={`${inr(visitFee)}${picked ? '' : ' (added at checkout)'}`}
                />
                {priorityFee > 0 && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs text-gray-500">
                      Priority charge
                      <span className="block text-[10px] text-gray-400">
                        Top {candidates.length} recommended
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs font-semibold text-gray-900">
                      {inr(priorityFee)}
                    </span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-600">Discount ({appliedCoupon?.code})</span>
                    <span className="text-xs font-bold text-emerald-600">- {inr(discountAmount)}</span>
                  </div>
                )}
                <div className="border-t border-gray-100 pt-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900">Total Amount</span>
                    <span className="text-lg font-bold text-emerald-600">{inr(total)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">{method === 'cash' ? 'Pay the professional in cash after service' : `You will be redirected to pay securely via ${method === 'upi' ? 'UPI' : method === 'card' ? 'Card' : 'Net Banking'}`}</p>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-gray-100 bg-white">
        {submitError && (
          <p role="alert" className="mx-3 mb-2 mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {submitError}
          </p>
        )}
        <div className="flex items-center gap-3 p-3">
          {step > PRO_STEP && (
            <Button
            variant="outline"
            onClick={() => {
              setSubmitError('');
              setStep(step - 1);
            }}
          >
            Back
          </Button>
          )}
          {step < REVIEW_STEP ? (
            <Button onClick={goNext} disabled={!canNext} className="flex-1">
              Continue
            </Button>
          ) : (
            <Button onClick={confirm} disabled={submitting} className="flex-1">
              {submitting ? 'Confirming...' : method === 'cash' ? `Confirm · ${inr(total)}` : `Pay ${inr(total)}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3">
    <span className="text-xs text-gray-500">{label}</span>
    <span className="max-w-[60%] text-right text-xs font-semibold text-gray-900">{value}</span>
  </div>
);
