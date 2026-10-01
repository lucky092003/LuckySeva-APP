import { useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { useApp } from '@/context/app-context';
import { useIsFavourite, toggleFavourite, useCustomerCoords } from '@/hooks';
import { api } from '@/services/api';
import { haversineKm } from '@/services/location';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, Stars, Badge, Button, EmptyState, VerifiedBadge, Avatar } from '@/components/ui';
import { inr, formatDate, slugToLabel } from '@/utils/format';
import { isVerified } from '@/utils/kyc';
import type { Professional, Review, Service } from '@/types';

/** Reviews shown before the customer expands the section. */
const REVIEW_PREVIEW = 2;
/** A comment longer than this is clamped behind a Read more toggle. */
const COMMENT_CLAMP_CHARS = 140;

const ReviewCard = ({ review }: { review: Review }) => {
  const [expanded, setExpanded] = useState(false);
  const text = (review.comment || '').trim();
  const isLong = text.length > COMMENT_CLAMP_CHARS;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
            {review.customer_name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{review.customer_name}</p>
            <p className="text-[10px] text-gray-400">{formatDate(review.created_at)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Icons.Star size={12} className="fill-amber-400 text-amber-400" />
          <span className="text-xs font-semibold text-gray-700">{review.rating}</span>
        </div>
      </div>

      {text && (
        <>
          <p
            className={`mt-2 text-xs leading-relaxed text-gray-600 ${
              isLong && !expanded ? 'line-clamp-3' : ''
            }`}
          >
            {text}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-[11px] font-semibold text-emerald-600"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </>
      )}
    </Card>
  );
};

export const ProfessionalProfileScreen = ({ id }: { id: string }) => {
  const { navigate, customer } = useApp();
  const { isFav } = useIsFavourite(customer?.phone || null, id);
  const coords = useCustomerCoords();

  const [professional, setProfessional] = useState<Professional | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [fav, setFav] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  useEffect(() => {
    setFav(isFav);
  }, [isFav]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    api.catalog
      .professional(id)
      .then((res) => {
        if (!active) return;
        setProfessional(res.professional);
        setServices((res.services || []).map((r) => r.service).filter(Boolean));
        setReviews(res.reviews || []);
      })
      .catch(() => {
        if (!active) return;
        setProfessional(null);
        setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  // Recompute distance only when the customer actually has saved coordinates.
  const distanceKm = useMemo(() => {
    if (!coords || !professional) return null;
    if (professional.latitude == null || professional.longitude == null) return null;
    return (
      Math.round(
        haversineKm(coords.latitude, coords.longitude, professional.latitude, professional.longitude) * 10
      ) / 10
    );
  }, [coords, professional]);

  const ratingBuckets = useMemo(() => {
    const buckets = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: reviews.filter((r) => Math.round(r.rating) === star).length,
    }));
    const max = Math.max(1, ...buckets.map((b) => b.count));
    return buckets.map((b) => ({ ...b, width: `${Math.round((b.count / max) * 100)}%` }));
  }, [reviews]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title="Profile" />
        <Spinner className="py-20" />
      </div>
    );
  }

  if (failed || !professional) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title="Profile" />
        <EmptyState
          icon={<Icons.WifiOff size={28} />}
          title="Couldn't load this profile"
          subtitle="Check your connection and try again"
        />
      </div>
    );
  }

  const available = professional.status === 'available';
  const trade = slugToLabel(professional.category_slug);
  const lowestPrice = services.length
    ? Math.min(...services.map((s) => s.starting_price))
    : professional.starting_price;

  const toggleFav = async () => {
    const next = await toggleFavourite(customer?.phone || null, id);
    setFav(next);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar
        title={trade || 'Professional'}
        right={
          <button
            onClick={toggleFav}
            aria-label={fav ? 'Remove from favourites' : 'Add to favourites'}
            aria-pressed={fav}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
              fav ? 'bg-red-50 text-red-500' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Icons.Heart size={19} className={fav ? 'fill-red-500' : ''} />
          </button>
        }
      />

      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar pb-4">
        {/* Header */}
        <div className="border-b border-gray-100 bg-white px-5 pb-5 pt-5">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <Avatar
                src={professional.avatar_url}
                name={professional.name}
                className="h-20 w-20 rounded-2xl text-xl"
              />
              <span
                className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white ${
                  available ? 'bg-emerald-500' : 'bg-amber-400'
                }`}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <h2 className="min-w-0 flex-1 text-lg font-bold leading-tight text-gray-900">
                  {professional.name}
                </h2>
                {isVerified(professional) && <VerifiedBadge />}
              </div>

              <div className="mt-1 flex items-center gap-1.5">
                <Stars rating={professional.rating} size={14} />
                <span className="text-sm font-semibold text-gray-700">{professional.rating}</span>
                <span className="text-xs text-gray-400">
                  ({professional.reviews_count} {professional.reviews_count === 1 ? 'review' : 'reviews'})
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone={available ? 'success' : 'warning'}>
                  {available ? 'Available now' : 'Currently busy'}
                </Badge>
                <span className="text-[11px] text-gray-400">
                  Serves within {professional.service_radius_km} km
                </span>
              </div>
            </div>
          </div>

          {professional.bio && (
            <p className="mt-4 text-sm leading-relaxed text-gray-600">{professional.bio}</p>
          )}

          <div className="mt-4 flex items-center gap-2">
            {professional.phone ? (
              <a
                href={`tel:${professional.phone}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-50 py-2.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                <Icons.Phone size={14} /> Call
              </a>
            ) : (
              <span className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-50 py-2.5 text-xs font-bold text-gray-400">
                <Icons.Phone size={14} /> Call unavailable
              </span>
            )}
            <button
              onClick={() => navigate({ name: 'help' })}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-50 py-2.5 text-xs font-bold text-sky-700 transition-colors hover:bg-sky-100"
            >
              <Icons.MessageCircle size={14} /> Chat
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <StatCell label="Experience" value={`${professional.experience_years} yrs`} />
            <StatCell label="Jobs done" value={`${professional.completed_jobs}`} divider />
            <StatCell
              label="Distance"
              value={distanceKm != null ? `${distanceKm} km` : '—'}
              divider
              muted={distanceKm == null}
            />
          </div>
          {distanceKm == null && (
            <p className="mt-1.5 text-[11px] text-gray-400">
              Add an address to see how far {professional.name.split(' ')[0]} is from you.
            </p>
          )}
        </div>

        {/* Skills */}
        {professional.skills.length > 0 && (
          <div className="px-5 pt-5">
            <h3 className="mb-2 text-sm font-bold text-gray-900">Skills & Expertise</h3>
            <div className="flex flex-wrap gap-2">
              {professional.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Services offered */}
        <div className="px-5 pt-5">
          <h3 className="mb-2 text-sm font-bold text-gray-900">
            Services Offered{services.length > 0 ? ` (${services.length})` : ''}
          </h3>
          {services.length === 0 ? (
            <Card className="p-4 text-center text-sm text-gray-500">
              No services listed yet. Tap Book Now to start a booking request.
            </Card>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              {services.map((svc, i) => (
                <button
                  key={svc.id}
                  onClick={() =>
                    navigate({ name: 'booking', serviceId: svc.id, professionalId: professional.id })
                  }
                  className={`flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-gray-50 active:bg-gray-100/70 ${
                    i > 0 ? 'border-t border-gray-100' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">{svc.name}</p>
                    <p className="mt-0.5 truncate text-[11px] text-gray-400">{svc.estimated_duration}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-[10px] text-gray-400">from </span>
                    <span className="text-sm font-bold text-emerald-600">{inr(svc.starting_price)}</span>
                  </div>
                  <Icons.ChevronRight size={16} className="shrink-0 text-gray-300" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Service area */}
        <div className="px-5 pt-5">
          <h3 className="mb-2 text-sm font-bold text-gray-900">Service Area</h3>
          <Card className="flex items-center gap-3 p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Icons.MapPin size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{professional.service_area}</p>
              <p className="text-[11px] text-gray-400">
                Travels up to {professional.service_radius_km} km for a visit
              </p>
            </div>
          </Card>
        </div>

        {/* Reviews */}
        <div className="px-5 pt-5">
          <h3 className="mb-2 text-sm font-bold text-gray-900">
            Reviews ({reviews.length})
          </h3>

          {reviews.length === 0 ? (
            <Card className="flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                <Icons.MessageSquare size={17} />
              </span>
              <p className="text-sm text-gray-500">No reviews yet for this professional.</p>
            </Card>
          ) : (
            <>
              <Card className="p-4">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-gray-900">{professional.rating}</p>
                    <Stars rating={professional.rating} />
                    <p className="mt-1 text-[10px] text-gray-400">
                      {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
                    </p>
                  </div>
                  <div className="flex-1 space-y-1">
                    {ratingBuckets.map((b) => (
                      <div key={b.star} className="flex items-center gap-2">
                        <span className="w-3 text-[10px] text-gray-500">{b.star}</span>
                        <div className="h-1.5 flex-1 rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-amber-400" style={{ width: b.width }} />
                        </div>
                        <span className="w-6 text-right text-[10px] text-gray-400">{b.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <div className="mt-3 space-y-3">
                {(showAllReviews ? reviews : reviews.slice(0, REVIEW_PREVIEW)).map((rev) => (
                  <ReviewCard key={rev.id} review={rev} />
                ))}
              </div>

              {reviews.length > REVIEW_PREVIEW && (
                <button
                  onClick={() => setShowAllReviews((v) => !v)}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100/70"
                >
                  {showAllReviews ? (
                    <>
                      <Icons.ChevronUp size={14} /> Show fewer reviews
                    </>
                  ) : (
                    <>
                      Show all {reviews.length} reviews
                      <Icons.ChevronDown size={14} />
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="shrink-0 border-t border-gray-100 bg-white p-3">
        <Button
          onClick={() =>
            services.length > 0
              ? navigate({ name: 'booking', serviceId: services[0].id, professionalId: professional.id })
              : navigate({ name: 'booking', serviceId: '', professionalId: professional.id })
          }
          className="w-full"
        >
          Book Now · {inr(lowestPrice)} onwards
        </Button>
      </div>
    </div>
  );
};

const StatCell = ({
  label,
  value,
  divider = false,
  muted = false,
}: {
  label: string;
  value: string;
  divider?: boolean;
  muted?: boolean;
}) => (
  <div className={`px-2 py-3 text-center ${divider ? 'border-l border-gray-100' : ''}`}>
    <p className={`text-sm font-bold ${muted ? 'text-gray-300' : 'text-gray-900'}`}>{value}</p>
    <p className="mt-0.5 text-[10px] text-gray-400">{label}</p>
  </div>
);