// Vista INGENUA (los errores típicos, todos juntos):
//  · Re-parsea TODO el texto de cada agente en cada token (O(n²)).
//  · Arma un string HTML y lo mete con dangerouslySetInnerHTML → se destruye y recrea
//    todo el DOM en cada token (se pierden foco, hover y clics a medio hacer).
//  · Las secciones aparecen en el orden en que llegan los agentes → saltan de lugar.
//  · Banners de "cargando" que desaparecen al final → el contenido salta hacia arriba.
//  · El mapa vive dentro del HTML → se vuelve a crear Leaflet en cada token.
//  · aria-live sobre todo el bloque → el lector de pantalla lo repite una y otra vez.
import { useEffect, useLayoutEffect, useRef } from 'react';
import L from 'leaflet';
import { parsePartialJson } from '../genui/json-stream';
import type { ItineraryDoc, LodgingDoc } from '../trip/agents';
import { LODGING_BY_ID, PLACE_BY_ID, REGIONS, type RegionId } from '../trip/places';
import { kindIconSvg } from './icons';
import { createMap, markerIcon } from './TripMap';

export interface NaiveState {
  itinerary: string;
  lodging: string;
  order: ('itinerary' | 'lodging')[];
  busy: { itinerary: boolean; lodging: boolean };
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function itineraryHTML(doc: ItineraryDoc | null): string {
  if (!doc) return '';
  const days = (doc.plan ?? [])
    .map(
      (d, i) => `<li class="day-slot"><article class="day-card"><div class="day-head"><span class="day-num">Día ${i + 1}</span><h3>${esc(d.title)}</h3></div>
<ul class="places">${(d.placeIds ?? [])
        .map((id) => PLACE_BY_ID.get(id))
        .filter(Boolean)
        .map((p) => `<li class="place"><button type="button"><span class="place-emoji">${kindIconSvg(p!.kind)}</span><span class="place-body"><span class="place-name">${esc(p!.name)}</span><span class="place-meta">${p!.hours} h</span></span></button></li>`)
        .join('')}</ul><p class="day-note">${esc(d.note)}</p></article></li>`,
    )
    .join('');
  return `<section class="naive-block"><h2 class="trip-title">${esc(doc.title)}</h2><p class="trip-subtitle">${esc(doc.subtitle)}</p>
<div class="trip-map naive-map"></div><ol class="days">${days}</ol></section>`;
}

function lodgingHTML(doc: LodgingDoc | null): string {
  if (!doc) return '';
  const cards = (doc.options ?? [])
    .map((o) => (o.lodgingId ? LODGING_BY_ID.get(o.lodgingId) : undefined) && { o, l: LODGING_BY_ID.get(o.lodgingId!)! })
    .filter(Boolean)
    .map(
      (x) => `<div class="lodging-slot"><article class="lodging-card">${x!.o.badge ? `<span class="badge">${esc(x!.o.badge)}</span>` : ''}<div class="lodging-head"><h3>${esc(x!.l.name)}</h3><span class="lodging-meta">${x!.l.rating}★</span></div>
<p class="lodging-reason">${esc(x!.o.reason)}</p><div class="lodging-foot"><span class="price">$${x!.l.pricePerNight}</span><button class="btn small" type="button">Elegir</button></div></article></div>`,
    )
    .join('');
  return `<section class="naive-block"><h2 class="section-title">Dónde dormir</h2><div class="lodgings">${cards}</div></section>`;
}

export function TripNaive({ state, onRender }: { state: NaiveState; onRender?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);

  const it = parsePartialJson(state.itinerary) as ItineraryDoc | null;
  const lo = parsePartialJson(state.lodging) as LodgingDoc | null;
  const html = state.order.map((a) => (a === 'itinerary' ? itineraryHTML(it) : lodgingHTML(lo))).join('');

  // Cada token: el div del mapa es nuevo → volvemos a crear el mapa entero.
  useLayoutEffect(() => {
    map.current?.remove();
    map.current = null;
    const el = box.current?.querySelector<HTMLElement>('.naive-map');
    if (!el || !it) return;
    map.current = createMap(el, false);
    const r = it.region ? REGIONS[it.region as RegionId] : null;
    if (r) map.current.setView(r.center, r.zoom, { animate: false });
    (it.plan ?? []).forEach((d, day) =>
      (d.placeIds ?? []).forEach((id) => {
        const p = PLACE_BY_ID.get(id);
        if (p) L.marker([p.lat, p.lng], { icon: markerIcon(day, kindIconSvg(p.kind, 14)) }).addTo(map.current!);
      }),
    );
    onRender?.();
  });

  useEffect(() => () => void map.current?.remove(), []);

  return (
    <div className="trip-naive">
      {state.busy.itinerary && (
        <div className="naive-banner">
          <span className="naive-spinner" aria-hidden="true" /> El agente de itinerario está pensando… esto puede tardar.
        </div>
      )}
      {state.busy.lodging && (
        <div className="naive-banner">
          <span className="naive-spinner" aria-hidden="true" /> Buscando hospedajes…
        </div>
      )}
      <div ref={box} aria-live="polite" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
