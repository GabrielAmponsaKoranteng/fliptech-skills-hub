import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { tradeById } from '../data/catalog';
import { cedi } from '../lib/format';
import type { Provider } from '../types';

interface MapViewProps {
  providers: Provider[];
  /** Id of the provider to highlight (e.g. the hovered list row) */
  highlight?: string | null;
  onSelect?: (providerId: string) => void;
  center?: L.LatLngExpression;
  zoom?: number;
  /** Single-location mode for a provider page: no numbering, popups or scroll-zoom */
  single?: boolean;
}

/**
 * Leaflet map of providers. `highlight` is the id of the hovered provider;
 * `onSelect` fires when a marker is clicked.
 */
export default function MapView({ providers, highlight, onSelect, center, zoom = 11, single = false }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<Record<string, L.Marker>>({});

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true, scrollWheelZoom: !single }).setView(center || [5.6037, -0.187], zoom);
    map.current = m;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(m);
    return () => { m.remove(); map.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    Object.values(markers.current).forEach((mk) => mk.remove());
    markers.current = {};
    providers.forEach((p, i) => {
      const icon = L.divIcon({ className: '', html: `<div class="pin" data-id="${p.id}"><span>${single ? '' : i + 1}</span></div>`, iconSize: [34, 34], iconAnchor: [17, 34] });
      const mk = L.marker(p.coords, { icon }).addTo(m);
      if (!single) {
        mk.bindPopup(`
          <div class="map-pop">
            <img src="${p.images[0]}" alt="" />
            <div style="font-size:11px;font-weight:700;color:${tradeById(p.trade).color}">${tradeById(p.trade).name.toUpperCase()}</div>
            <div style="font-weight:750;font-size:14px;margin:2px 0 4px">${p.name}</div>
            <div style="font-size:12.5px;color:#5b6b80">${p.area} · ${p.months} months</div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
              <b style="font-size:15px">From ${cedi(p.fee)}</b>
              <a href="/providers/${p.id}" data-nav="/providers/${p.id}" style="font-weight:700;font-size:13px">View →</a>
            </div>
          </div>`);
        mk.on('click', () => onSelect?.(p.id));
      }
      markers.current[p.id] = mk;
    });
    if (providers.length > 1) m.fitBounds(L.latLngBounds(providers.map((p) => p.coords)).pad(0.15));
    else if (providers.length === 1) m.setView(providers[0].coords, single ? 14 : 13);
  }, [providers, single]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Object.entries(markers.current).forEach(([id, mk]) => {
      const node = mk.getElement()?.querySelector('.pin');
      if (node) node.classList.toggle('hl', id === highlight);
      if (id === highlight) mk.setZIndexOffset(1000); else mk.setZIndexOffset(0);
    });
  }, [highlight, providers]);

  return <div ref={el} style={{ width: '100%', height: '100%', minHeight: 260 }} />;
}
