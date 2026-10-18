import { useEffect, useRef } from 'react';
import { loadGoogleMaps, googleMapsKey } from '@/services/googleMaps';
import type { LatLng } from '@/components/mapTypes';

/* Minimal structural types for the pieces of the Google Maps namespace we
   touch — keeps the bundle light and lint clean without official typings. */
interface GBounds {
  extend: (point: object) => void;
}
interface GMap {
  fitBounds: (bounds: GBounds, padding?: number | string) => void;
  getZoom: () => number;
  setZoom: (zoom: number) => void;
}
interface GMarker {
  setPosition: (position: object) => void;
  setMap: (map: null) => void;
}
interface GPolyline {
  setPath: (path: object[]) => void;
  setMap: (map: null) => void;
}
interface MapsNamespace {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap;
  Marker: new (opts: Record<string, unknown>) => GMarker;
  Polyline: new (opts: Record<string, unknown>) => GPolyline;
  LatLng: new (lat: number, lng: number) => object;
  LatLngBounds: new () => GBounds;
  Size: new (w: number, h: number) => object;
  Point: new (x: number, y: number) => object;
  event: { addListenerOnce: (target: GMap, event: string, fn: () => void) => void };
}

const CAR_ICON_BODY =
  '<circle cx="22" cy="22" r="10" fill="#10b981" opacity="0.35">' +
  '<animate attributeName="r" from="10" to="20" dur="1.6s" repeatCount="indefinite"/>' +
  '<animate attributeName="opacity" from="0.45" to="0" dur="1.6s" repeatCount="indefinite"/>' +
  '</circle>' +
  '<circle cx="22" cy="22" r="9" fill="#10b981" stroke="#ffffff" stroke-width="2.5"/>' +
  '<text x="22" y="26.5" font-size="10.5" text-anchor="middle">🚙</text>';

const HOME_ICON_BODY =
  '<circle cx="22" cy="22" r="9" fill="#ffffff" stroke="#ef4444" stroke-width="2.5"/>' +
  '<text x="22" y="26.5" font-size="10.5" text-anchor="middle">🏠</text>';

const pinIcon = (ns: MapsNamespace, body: string, size = 44) => ({
  url:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`,
    ),
  scaledSize: new ns.Size(size, size),
  anchor: new ns.Point(size / 2, size / 2 + 4),
});

/** Google Maps renderer (chosen when a key is configured). */
export const GoogleMapImpl = ({
  customer,
  professional,
  className,
}: {
  customer: LatLng;
  professional: LatLng | null;
  className?: string;
}) => {
  const el = useRef<HTMLDivElement | null>(null);
  const ns = useRef<MapsNamespace | null>(null);
  const map = useRef<GMap | null>(null);
  const customerM = useRef<GMarker | null>(null);
  const proM = useRef<GMarker | null>(null);
  const line = useRef<GPolyline | null>(null);
  // Latest props, read by the async loader callback once the script lands.
  const props = useRef<{ customer: LatLng; professional: LatLng | null }>({ customer, professional });

  useEffect(() => {
    props.current = { customer, professional };
  });

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps(googleMapsKey!).then((gm) => {
      if (cancelled || !el.current) return;
      const g = gm as unknown as MapsNamespace;
      ns.current = g;
      const m = new g.Map(el.current, {
        center: { lat: customer.latitude, lng: customer.longitude },
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: false,
        clickableIcons: false,
        gestureHandling: 'cooperative',
      });
      map.current = m;
      const c = props.current.customer;
      const p = props.current.professional;
      customerM.current = new g.Marker({
        position: { lat: c.latitude, lng: c.longitude },
        map: m,
        icon: pinIcon(g, HOME_ICON_BODY),
        zIndex: 100,
      });
      if (p) {
        proM.current = new g.Marker({
          position: { lat: p.latitude, lng: p.longitude },
          map: m,
          icon: pinIcon(g, CAR_ICON_BODY),
          zIndex: 200,
        });
        line.current = new g.Polyline({
          path: [
            { lat: p.latitude, lng: p.longitude },
            { lat: c.latitude, lng: c.longitude },
          ],
          strokeOpacity: 0,
          icons: [
            {
              icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, strokeColor: '#10b981', strokeWeight: 2, scale: 2 },
              offset: '0',
              repeat: '12px',
            },
          ],
          map: m,
        });
      }
      applyBounds(g, m, c, p);
    });
    return () => {
      cancelled = true;
      customerM.current?.setMap(null);
      proM.current?.setMap(null);
      line.current?.setMap(null);
      map.current = null;
      ns.current = null;
      customerM.current = null;
      proM.current = null;
      line.current = null;
    };
    // Mount-only setup; later positions flow through the update effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyBounds = (g: MapsNamespace, m: GMap, c: LatLng, p: LatLng | null) => {
    const pts = p ? [c, p] : [c];
    const bounds = new g.LatLngBounds();
    pts.forEach((x) => bounds.extend(new g.LatLng(x.latitude, x.longitude)));
    m.fitBounds(bounds, 40);
    // Don't zoom into the pavement when both markers sit close together.
    g.event.addListenerOnce(m, 'idle', () => {
      if (m.getZoom() > 17) m.setZoom(17);
    });
  };

  useEffect(() => {
    const g = ns.current;
    const m = map.current;
    if (!g || !m) return;
    customerM.current?.setPosition(new g.LatLng(customer.latitude, customer.longitude));
    if (professional && proM.current && line.current) {
      proM.current.setPosition(new g.LatLng(professional.latitude, professional.longitude));
      line.current.setPath([
        { lat: professional.latitude, lng: professional.longitude },
        { lat: customer.latitude, lng: customer.longitude },
      ]);
    }
    applyBounds(g, m, customer, professional);
    // Primitive deps keep this stable across renders even though the parent
    // recreates the position objects inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.latitude, customer.longitude, professional?.latitude, professional?.longitude]);

  return <div ref={el} className={`min-h-0 overflow-hidden ${className ?? ''}`} />;
};
