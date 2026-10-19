import { useEffect } from 'react';
import { useApp } from '@/context/app-context';
import { api, ApiError } from '@/services/api';
import { setLocationShareState } from '@/services/providerTracking';

/** How often the job list is re-read to notice a journey starting or ending. */
const JOB_POLL_MS = 20000;
/** Floor between two positions sent to the backend (~`watchPosition` fires far more often). */
const LOCATION_MIN_GAP_MS = 8000;
/** Runtime GPS health ping. */
const HEARTBEAT_MS = 30000;

/**
 * Invisible component mounted for logged-in providers. While the provider has a
 * journey `on_the_way` it streams the phone's GPS to the booking-scoped tracking
 * endpoint so the customer's map shows the live position. It only opens the GPS
 * watcher while such a job exists, and closes it the moment the job moves on
 * (started / completed / cancelled), which is what stops tracking on arrival.
 *
 * Errors are reported through `providerTracking` instead of being swallowed, so
 * the provider can be told their location is not reaching the customer.
 */
export const ProviderLocationPublisher = () => {
  const { role } = useApp();

  useEffect(() => {
    if (role !== 'provider') return;

    let watchId: number | null = null;
    let heartbeats: ReturnType<typeof setInterval> | null = null;
    let jobPoll: ReturnType<typeof setInterval> | null = null;
    let jobId: string | null = null;
    let watching = false;
    let latest: { latitude: number; longitude: number; accuracy?: number } | null = null;
    let lastSentAt = 0;

    const closeGps = () => {
      if (watchId !== null && 'geolocation' in navigator) navigator.geolocation.clearWatch(watchId);
      watchId = null;
      if (heartbeats) clearInterval(heartbeats);
      heartbeats = null;
      watching = false;
    };

    const stopWatcher = () => {
      closeGps();
      jobId = null;
      latest = null;
      lastSentAt = 0;
      setLocationShareState('idle');
    };

    const beat = () => {
      // Liveness stamp always; coordinates ride along whenever we have them, so
      // the provider's saved base location stays current between journeys.
      api.provider
        .heartbeat(latest ? { latitude: latest.latitude, longitude: latest.longitude } : undefined)
        .catch(() => {});
    };

    const publish = (force = false) => {
      if (!jobId || !latest) return;
      const now = Date.now();
      if (!force && now - lastSentAt < LOCATION_MIN_GAP_MS) return;
      lastSentAt = now;
      api.provider
        .updateLocation(jobId, latest)
        .then(() => setLocationShareState('active'))
        .catch((err) => {
          if (err instanceof ApiError && err.code === 'tracking_not_active') {
            // The journey ended while we were still watching it. Re-check now
            // rather than streaming into a refused endpoint until the next poll.
            stopWatcher();
            return;
          }
          setLocationShareState('unavailable', 'Could not reach the server to share your location.');
        });
    };

    const startWatcher = () => {
      if (watching) return;
      watching = true;
      if (!('geolocation' in navigator)) {
        setLocationShareState('unavailable', 'This device does not provide GPS to the app.');
        return;
      }
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          latest = Number.isFinite(accuracy)
            ? { latitude, longitude, accuracy }
            : { latitude, longitude };
          publish();
        },
        (err) => {
          // 1 = PERMISSION_DENIED (permanent until the user changes it); the
          // rest are usually "no fix yet" — indoors, or location switched off.
          setLocationShareState(
            err.code === 1 ? 'denied' : 'unavailable',
            err.code === 1
              ? 'Location permission is blocked, so the customer cannot see you on the map.'
              : 'Waiting for a GPS signal.',
          );
          // Close this attempt but keep the journey: the next job poll retries,
          // so granting permission from the app's Retry button recovers without
          // waiting for the job to change.
          closeGps();
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
      );
      beat();
      // Re-send the last fix on the heartbeat cadence: a stationary provider
      // gets no `watchPosition` callbacks on some platforms, and the customer's
      // screen treats an un-refreshed fix as lost.
      heartbeats = setInterval(() => {
        beat();
        publish(true);
      }, HEARTBEAT_MS);
    };

    const checkForActiveJob = () => {
      api.provider
        .myBookings()
        .then((rows) => {
          const active = (rows || []).find((booking) => booking.status === 'on_the_way');
          if (!active) {
            stopWatcher();
            return;
          }
          // Keep the target current even if it was reassigned mid-journey.
          jobId = active.id;
          startWatcher();
        })
        .catch(() => {
          // Offline: keep whatever we were doing — the watcher keeps trying and
          // the next successful poll decides whether the journey is still on.
        });
    };

    checkForActiveJob();
    jobPoll = setInterval(checkForActiveJob, JOB_POLL_MS);

    return () => {
      stopWatcher();
      if (jobPoll) clearInterval(jobPoll);
    };
  }, [role]);

  return null;
};
