// Agente VERIFICADOR: reglas deterministas en código (no en el prompt).
// La IA propone, el código verifica, la persona decide.
import { monthName, type ItineraryDoc, type LodgingDoc, type TripRequest } from './agents';
import { LODGING_BY_ID, PLACE_BY_ID, REGIONS, type RegionId } from './places';

export type CheckLevel = 'ok' | 'warn' | 'block' | 'fixed';

export interface Check {
  id: string;
  level: CheckLevel;
  title: string;
  detail: string;
  agent: 'itinerary' | 'lodging';
  /** id a excluir en el bucle de corrección (solo para 'block') */
  exclude?: string;
}

const MAX_HOURS_PER_DAY = 10;

export function verifyTrip(req: TripRequest, itinerary: ItineraryDoc | null, lodging: LodgingDoc | null): Check[] {
  const checks: Check[] = [];
  const region = REGIONS[(itinerary?.region ?? 'santo-domingo') as RegionId];

  // ── Hospedaje: seguridad, verificación, precio anómalo ──────────────
  for (const opt of lodging?.options ?? []) {
    const l = opt.lodgingId ? LODGING_BY_ID.get(opt.lodgingId) : undefined;
    if (!l) continue;
    if (!l.verified || l.safety < 3 || l.rating < 3.5) {
      checks.push({
        id: `lodging-unsafe-${l.id}`,
        level: 'block',
        agent: 'lodging',
        exclude: l.id,
        title: `${l.name} no pasa la verificación`,
        detail: `${l.rating}★ con ${l.reviews} reseñas, seguridad ${l.safety}/5${l.verified ? '' : ', sin verificar'}.${l.note ? ` ${l.note}.` : ''}`,
      });
    } else if (l.pricePerNight < region.priceFloor * 0.5) {
      checks.push({
        id: `lodging-price-${l.id}`,
        level: 'warn',
        agent: 'lodging',
        title: `Precio inusualmente bajo en ${l.name}`,
        detail: `$${l.pricePerNight}/noche cuando lo normal en la zona empieza en $${region.priceFloor}. Revisa qué incluye.`,
      });
    }
  }

  // ── Itinerario: temporada, región, días imposibles, avisos ──────────
  (itinerary?.plan ?? []).forEach((day, d) => {
    let hours = d === 0 ? region.driveHours : 0;
    for (const id of day.placeIds ?? []) {
      const p = PLACE_BY_ID.get(id);
      if (!p) continue;
      hours += p.hours;
      if (p.region !== itinerary?.region) {
        checks.push({ id: `place-region-${id}`, level: 'block', agent: 'itinerary', exclude: id, title: `${p.name} queda en otra región`, detail: `El día ${d + 1} te haría cruzar el país.` });
      }
      if (p.season && !p.season.includes(req.month)) {
        checks.push({
          id: `place-season-${id}`,
          level: 'block',
          agent: 'itinerary',
          exclude: id,
          title: `${p.name}: fuera de temporada en ${monthName(req.month)}`,
          detail: p.caution ?? 'No está disponible en esas fechas.',
        });
      } else if (p.caution) {
        checks.push({ id: `place-caution-${id}`, level: 'warn', agent: 'itinerary', title: p.name, detail: p.caution });
      }
    }
    if (hours > MAX_HOURS_PER_DAY) {
      checks.push({
        id: `day-hours-${d}`,
        level: 'warn',
        agent: 'itinerary',
        title: `Día ${d + 1} muy cargado`,
        detail: `≈${Math.round(hours)} h entre carretera y actividades${d === 0 && region.driveHours >= 4 ? ': llegarías de noche a una zona remota' : ''}.`,
      });
    }
  });

  if (!checks.some((c) => c.level !== 'ok')) {
    checks.push({ id: 'all-good', level: 'ok', agent: 'itinerary', title: 'Todo verificado', detail: 'Hospedajes con licencia, temporadas correctas y días realistas.' });
  }
  return checks;
}
