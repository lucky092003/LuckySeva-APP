import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/services/googleMaps';
import type { LatLng } from '@/components/mapTypes';

export const GOOGLE_MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || undefined;

type GMap = Record<string, any>; // google.maps.Map — kept loose to avoid bundling types

const pinIcon = (gm: any, body: string, size = 44) => ({
  url:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`,
    ),
  scaledSize: new gm.Size(size, size),
  anchor: new gm.Point(size / 2, size / 2 + 4),
});

const CAR_BODY =
  '<circle cx="22" cy="22" r="10" fill="#10b981" opacity="0.35">' +
  '<animate attributeName="r" from="10" to="20" dur="1.6s" repeatCount="indefinite"/>' +
  '<animate attributeName="opacity" from="0.45" to="0" dur="1.6s" repeatCount="indefinite"/>' +
  '</circle>' +
  '<circle cx="22" cy="22" r="9" fill="#10b981" stroke="#ffffff" stroke-width="2.5"/>' +
  '<text x="22" y="26.5" font-size="10.5" text-anchor="middle">🚙</text>';

const HOME_BODY =
  '<circle cx="22" cy="22" r="9" fill="#ffffff" stroke="#ef4444" stroke-width="2.5"/>' +
  '<text x="22" y="26.5" font-size="10.5" text-anchor="middle">🏠</text>';

/** Google Maps renderer (chosen when a key is configured). */
const GoogleMapImpl = ({ customer, professional, className }: { customer: LatLng; professional: LatLng | null; className?: string }) => {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<GMap | null>(null);
  const customerM = useRef<GMap | null>(null);
  const proM = useRef<GMap | null>(null);
  const line = useRef<GMap | null>(null);
  // Latest props for the async loader callback.
  const latest = useRef({ customer, professional });
  latest.current = { customer, professional };

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps(GOOGLE_MAPS_KEY!).then((gm) => {
      if (cancelled || !el.current) return;
      const g = gm as any;
      const m: GMap = new g.Map(el.current, {
        center: { lat: customer.latitude, lng: customer.longitude },
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: false,
        clickableIcons: false,
        gestureHandling: 'cooperative',
      });
      map.current = m;
      const c = latest.current.customer;
      const p = latest.current.professional;
      customerM.current = new g.Marker({
        position: { lat: c.latitude, lng: c.longitude },
        map: m,
        icon: pinIcon(g, HOME_BODY),
        zIndex: 100,
      });
      if (p) {
        proM.current = new g.Marker({
          position: { lat: p.latitude, lng: p.longitude },
          map: m,
          icon: pinIcon(g, CAR_BODY),
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
      const pts = p ? [c, p] : [c];
      const bounds = new g.LatLngBounds();
      pts.forEach((x) => bounds.extend(new g.LatLng(x.latitude, x.longitude)));
      m.fitBounds(bounds, 40);
      g.event.addListenerOnce(m, 'idle', () => {
        if ((m.getZoom() as number) > 17) m.setZoom(17);
      });
    });
    return () => {
      cancelled = true;
      customerM.current?.setMap(null);
      proM.current?.setMap(null);
      line.current?.setMap(null);
      map.current = null;
      customerM.current = proM.current = line.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const g = (window.google?.maps as any) || null;
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
    const pts = professional ? [customer, professional] : [customer];
    const bounds = new g.LatLngBounds();
    pts.forEach((p) => bounds.extend(new g.LatLng(p.latitude, p.longitude)));
    m.fitBounds(bounds, 40);
    // Don't zoom into the pavement when both markers sit close together.
    g.event.addListenerOnce(m, 'idle', () => {
      if ((m.getZoom() as number) > 17) m.setZoom(17);
    });
  }, [customer.latitude, customer.longitude, professional?.latitude, professional?.longitude]);

  return <div ref={el} className={`min-h-0 overflow-hidden ${className ?? ''}`} />;
};

export { GoogleMapImpl };
