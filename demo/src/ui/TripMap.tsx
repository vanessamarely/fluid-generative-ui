// Mapa del viaje (Leaflet + OpenStreetMap, sin API key).
// Versión FLUIDA: el mapa se crea UNA vez; los marcadores se agregan, mueven o quitan
// por id (reutilización), y al conocer la región se hace un flyTo animado.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { DocStore } from '../genui/doc-store';
import type { Intent, ItineraryDay } from '../trip/agents';
import { PLACE_BY_ID, REGIONS, type RegionId } from '../trip/places';
import { kindIconSvg } from './icons';

const DR_CENTER: [number, number] = [18.85, -70.2];

export function createMap(el: HTMLElement, animate = true): L.Map {
  const map = L.map(el, {
    zoomControl: false,
    attributionControl: true,
    scrollWheelZoom: false,
    // La vista ingenua destruye el mapa en cada token: sin animaciones para no romper a mitad de un zoom.
    zoomAnimation: animate,
    fadeAnimation: animate,
    markerZoomAnimation: animate,
  }).setView(DR_CENTER, 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 16,
    attribution: '© OpenStreetMap',
  }).addTo(map);
  return map;
}

export function markerIcon(day: number, iconSvg: string) {
  return L.divIcon({
    className: 'map-pin',
    html: `<span class="pin-day">${day + 1}</span><span class="pin-emoji">${iconSvg}</span>`,
    iconSize: [44, 28],
    iconAnchor: [22, 28],
  });
}

export function TripMap({ store, intent, onPick }: { store: DocStore; intent: Intent | null; onPick: (id: string, day: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, { m: L.Marker; day: number }>());
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    map.current = createMap(el.current!);
    return () => {
      map.current?.remove();
      map.current = null;
      markers.current.clear();
    };
  }, []);

  // Al conocer la región (la da la intención, antes del itinerario) volamos hacia allá.
  useEffect(() => {
    const r = intent ? REGIONS[intent.region as RegionId] : null;
    const m = map.current;
    if (!r || !m) return;
    m.invalidateSize(); // el contenedor pudo estar oculto al crear el mapa
    const size = m.getSize();
    if (!size.x || !size.y || matchMedia('(prefers-reduced-motion: reduce)').matches) m.setView(r.center, r.zoom, { animate: false });
    else m.flyTo(r.center, r.zoom, { duration: 1.2 });
  }, [intent]);

  // Marcadores: diff por id contra lo que ya está en el mapa.
  useEffect(() => {
    const sync = () => {
      if (!map.current) return;
      const wanted = new Map<string, number>();
      (store.state.lists.plan ?? []).forEach((item, day) => {
        for (const id of (item?.value as ItineraryDay)?.placeIds ?? []) if (PLACE_BY_ID.has(id) && !wanted.has(id)) wanted.set(id, day);
      });
      if (!wanted.size && store.state.status !== 'done') return; // mantenemos los anteriores mientras llega lo nuevo
      for (const [id, entry] of markers.current) {
        if (!wanted.has(id)) {
          entry.m.remove();
          markers.current.delete(id);
        }
      }
      for (const [id, day] of wanted) {
        const p = PLACE_BY_ID.get(id)!;
        const existing = markers.current.get(id);
        if (existing) {
          if (existing.day !== day) {
            existing.m.setIcon(markerIcon(day, kindIconSvg(p.kind, 14)));
            existing.day = day;
          }
          continue;
        }
        const m = L.marker([p.lat, p.lng], { icon: markerIcon(day, kindIconSvg(p.kind, 14)), title: p.name, keyboard: true })
          .addTo(map.current)
          .on('click', () => pick.current(id, markers.current.get(id)?.day ?? day));
        markers.current.set(id, { m, day });
      }
    };
    sync();
    return store.subscribe(sync);
  }, [store]);

  return <div className="trip-map" ref={el} role="region" aria-label="Mapa del itinerario" />;
}
