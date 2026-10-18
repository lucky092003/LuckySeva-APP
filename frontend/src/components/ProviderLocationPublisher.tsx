import { useEffect } from 'react';
import { useApp } from '@/context/app-context';
import { api } from '@/services/api';

/**
 * Invisible component mounted for logged-in providers. While the provider has a
 * job in motion (on_the_way / started) it streams the phone's GPS to the
 * backend heartbeat so the customer's tracking screen can show the live
 * position on the map. Polls the job list once a minute to notice status
 * changes, and only keeps the GPS watcher open while there is an active job.
 */
export const ProviderLocationPublisher = () => {
  const { role } = useApp();

  useEffect(() => {
    if (role !== 'provider') return;

    let watchId: number | null = null;
    let heartbeats: ReturnType<typeof setInterval> | null = null;
    let jobPoll: ReturnType<typeof setInterval> | null = null;
    let tracking = false;
    let latest: { latitude: number; longitude: number } | null = null;

    const stopWatcher = () => {
      if (watchId !== null && 'geolocation' in navigator) navigator.geolocation.clearWatch(watchId);
      watchId = null;
      if (heartbeats) clearInterval(heartbeats);
      heartbeats = null;
      latest = null;
      tracking = false;
    };

    const startWatcher = () => {
      if (tracking) return;
      tracking = true;
      const beat = () => {
        // Liveness stamp always; live coords ride along whenever we have them.
        api.provider.heartbeat(latest ? { ...latest } : undefined).catch(() => {});
      };
      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            latest = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            beat();
          },
          () => {
            /* permission denied or no fix — keep heartbeating without coords */
          },
          { enableHighAccuracy: true, maximumAge: 15000 },
        );
      }
      beat();
      heartbeats = setInterval(beat, 30000);
    };

    const checkForActiveJob = () => {
      api.provider
        .myBookings()
        .then((rows) => {
          const active = (rows || []).some((b) => b.status === 'on_the_way' || b.status === 'started');
          if (active) startWatcher();
          else stopWatcher();
        })
        .catch(() => stopWatcher());
    };

    checkForActiveJob();
    jobPoll = setInterval(checkForActiveJob, 60000);

    return () => {
      stopWatcher();
      if (jobPoll) clearInterval(jobPoll);
    };
  }, [role]);

  return null;
};
