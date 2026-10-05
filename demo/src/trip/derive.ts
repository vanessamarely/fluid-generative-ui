// Estado DERIVADO: se calcula en el cliente a partir de lo que generaron los agentes.
// La IA decide qué hacer; el código hace las cuentas (y nunca se equivoca sumando).
import { monthName, type ItineraryDoc, type LodgingDoc, type TripRequest } from './agents';
import { FOOD_PER_DAY, LODGING_BY_ID, PLACE_BY_ID, REGIONS, type Lodging, type Place, type RegionId } from './places';

export interface Budget {
  lodging: number;
  activities: number;
  transfer: number;
  food: number;
  total: number;
  perPerson: number;
  nights: number;
  lodgingName: string | null;
}

export function pickLodging(lodging: LodgingDoc | null, selectedId: string | null, blocked: Set<string>): Lodging | null {
  const ids = (lodging?.options ?? []).map((o) => o.lodgingId).filter(Boolean) as string[];
  const chosen = selectedId && ids.includes(selectedId) ? selectedId : ids.find((id) => !blocked.has(id));
  return chosen ? LODGING_BY_ID.get(chosen) ?? null : null;
}

export function computeBudget(req: TripRequest, itinerary: ItineraryDoc | null, lodging: Lodging | null): Budget {
  const days = itinerary?.plan?.length || req.days;
  const nights = Math.max(1, days - 1);
  const rooms = Math.ceil(req.people / 2);
  const region = REGIONS[(itinerary?.region ?? 'santo-domingo') as RegionId];
  const places = (itinerary?.plan ?? []).flatMap((d) => d.placeIds ?? []).map((id) => PLACE_BY_ID.get(id)).filter(Boolean) as Place[];
  const b = {
    lodging: (lodging?.pricePerNight ?? 0) * nights * rooms,
    activities: places.reduce((s, p) => s + p.cost, 0) * req.people,
    transfer: (region?.transfer ?? 0) * req.people,
    food: FOOD_PER_DAY * days * req.people,
  };
  const total = b.lodging + b.activities + b.transfer + b.food;
  return { ...b, total, perPerson: Math.round(total / req.people), nights, lodgingName: lodging?.name ?? null };
}

export function itineraryText(req: TripRequest, itinerary: ItineraryDoc | null, lodging: Lodging | null): string {
  if (!itinerary?.plan?.length) return 'Todavía no hay itinerario.';
  const budget = computeBudget(req, itinerary, lodging);
  const days = itinerary.plan
    .map((d, i) => `Día ${i + 1} — ${d.title}: ${(d.placeIds ?? []).map((id) => PLACE_BY_ID.get(id)?.name).filter(Boolean).join(', ')}.${d.note ? ` ${d.note}` : ''}`)
    .join('\n');
  return `${itinerary.title}\n${itinerary.subtitle ?? ''}\n${days}\nHospedaje: ${lodging?.name ?? 'por elegir'}.\nPresupuesto estimado: $${budget.total} para ${req.people} (${monthName(req.month)}).`;
}

// ── Respaldo del panel contextual (cuando no hay Gemini Nano) ─────────────
const BRING: Record<string, string> = {
  playa: 'protector solar reef-safe, sandalias y una bolsa seca',
  naturaleza: 'repelente, zapatos cerrados y agua',
  cultura: 'zapatos cómodos y algo de efectivo para guías locales',
  aventura: 'ropa que se pueda mojar y una muda extra',
  gastronomía: 'apetito y efectivo para colmados',
};

export type Selection =
  | { kind: 'trip' }
  | { kind: 'day'; index: number }
  | { kind: 'place'; id: string; day: number }
  | { kind: 'lodging'; id: string };

export function fallbackTips(sel: Selection, req: TripRequest, itinerary: ItineraryDoc | null): string {
  if (sel.kind === 'place') {
    const p = PLACE_BY_ID.get(sel.id);
    if (!p) return '';
    const lines = [
      `${p.name}: ${p.blurb.toLowerCase()}.`,
      `• Reserva unas ${p.hours} h y lleva ${BRING[p.kind]}.`,
      p.cost ? `• Cuesta ≈ $${p.cost} por persona ($${p.cost * req.people} para el grupo).` : '• Es gratis: ideal para equilibrar el presupuesto.',
      p.caution ? `• Ojo: ${p.caution.toLowerCase()}.` : '• Ve temprano: menos calor y menos gente.',
    ];
    if (req.people >= 4) lines.push('• Con grupo grande, pregunta por tarifa de grupo o transporte compartido.');
    return lines.join('\n');
  }
  if (sel.kind === 'lodging') {
    const l = LODGING_BY_ID.get(sel.id);
    if (!l) return '';
    return [
      `${l.name} · ${l.style} · ${l.rating}★ (${l.reviews} reseñas).`,
      l.verified ? '• Verificado: licencia de turismo y reseñas reales.' : '• Sin verificar: confirma licencia y ubicación antes de pagar.',
      `• Para ${req.people} ${req.people === 1 ? 'persona' : 'personas'} necesitas ${Math.ceil(req.people / 2)} habitación(es).`,
      `• Extras: ${l.perks.join(', ').toLowerCase()}.`,
    ].join('\n');
  }
  if (sel.kind === 'day') {
    const d = itinerary?.plan?.[sel.index];
    if (!d) return '';
    const places = (d.placeIds ?? []).map((id) => PLACE_BY_ID.get(id)).filter(Boolean) as Place[];
    const hours = places.reduce((s, p) => s + p.hours, 0);
    return [
      `Día ${sel.index + 1} · ${d.title}: ${places.map((p) => p.name).join(' y ')}.`,
      `• ≈${hours} h de actividades: ${hours > 7 ? 'día intenso, desayuna fuerte' : 'deja espacio para improvisar'}.`,
      `• Lleva ${BRING[places[0]?.kind ?? 'naturaleza']}.`,
      `• En ${monthName(req.month)} ${[8, 9, 10].includes(req.month) ? 'es temporada de lluvias: ten un plan B bajo techo' : 'el clima suele ser estable'}.`,
    ].join('\n');
  }
  return [
    `Tu viaje en ${monthName(req.month)} para ${req.people}.`,
    '• Toca un día, un lugar o un hospedaje y te doy sugerencias de ese contexto.',
    '• Cambia personas o estilo y el presupuesto se recalcula al instante.',
  ].join('\n');
}
