import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export const LiveMap = ({
  customer,
  professional,
  className = '',
}: {
  customer: LatLng;
  professional: LatLng | null;
  className?: string;
}) => {
  const el = useRef<HTMLDivElement | null>(null);
  // Leaflet instances live outside React's model — one map per mount.
  const map = useRef<L.Map | null>(null);
  const customerMarker = useRef<L.Marker | null>(null);
  const proMarker = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, {
      attributionControl: true,
      zoomControl: false,
      scrollWheelZoom: false,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      customerMarker.current = null;
      proMarker.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;

    if (!customerMarker.current) {
      customerMarker.current = L.marker([customer.latitude, customer.longitude], {
        icon: L.divIcon({
          className: '!bg-transparent !border-0',
          html: '<div style="filter:drop-shadow(0 2px 2px rgba(0,0,0,.3));font-size:26px;line-height:1">&#127968;</div>',
          iconSize: [26, 26],
          iconAnchor: [13, 24],
        }),
      }).addTo(m);
    } else {
      customerMarker.current.setLatLng([customer.latitude, customer.longitude]);
    }

    if (professional) {
      if (!proMarker.current) {
        proMarker.current = L.marker([professional.latitude, professional.longitude], {
          zIndexOffset: 500,
          icon: L.divIcon({
            className: '!bg-transparent !border-0',
            html:
              '<div style="position:relative;font-size:26px;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3))">' +
              '<span style="position:absolute;inset:6px 6px auto;border-radius:50%;height:12px;width:12px;background:rgba(16,185,129,.85);animation:pulse 1.6s infinite"></span>' +
              '&#128666;</div>' +
              '<style>@keyframes pulse{0%{transform:scale(1);opacity:.9}100%{transform:scale(2.4);opacity:0}}</style>',
            iconSize: [26, 26],
            iconAnchor: [13, 24],
          }),
        }).addTo(m);
      } else {
        proMarker.current.setLatLng([professional.latitude, professional.longitude]);
      }
    } else if (proMarker.current) {
      proMarker.current.remove();
      proMarker.current = null;
    }

    const pts: LatLng[] = professional ? [customer, professional] : [customer];
    // Fit both markers with just enough padding; skip if the view hasn't moved much.
    const bounds = L.latLngBounds(pts.map((p) => [p.latitude, p.longitude] as [number, number]));
    if (!m.getBounds().pad(-0.2).contains(bounds)) {
      m.fitBounds(bounds.pad(0.35), { animate: true });
    }
  }, [customer.latitude, customer.longitude, professional?.latitude, professional?.longitude]);

  return (
    <div
      ref={el}
      className={`min-h-0 overflow-hidden ${className}`}
    />
  );
};
