// "Modelos" locales deterministas para el escenario: sin wifi ni Gemini Nano la demo sigue
// funcionando, y la comparación ingenuo vs fluido recibe EXACTAMENTE el mismo stream.
// A propósito se comportan como una IA "genérica": si pides lo más barato, eligen lo más
// barato… aunque sea una trampa. Para eso existe el agente verificador.
import type { AgentContext, Intent, ItineraryDoc, LodgingDoc, TripRequest } from './agents';
import { LODGINGS, PLACES, REGIONS, type Place, type PlaceKind, type RegionId } from './places';

const REGION_WORDS: [RegionId, RegExp][] = [
  ['samana', /saman|terrenas|ballena|limón|limon|haitises/],
  ['jarabacoa', /jarabacoa|constanza|montaña|frío|frio|pico duarte|rafting/],
  ['norte', /puerto plata|cabarete|sosúa|sosua|kite|norte|charcos/],
  ['este', /punta cana|bávaro|bavaro|bayahibe|saona|resort|\beste\b/],
  ['sur', /barahona|pedernales|águilas|aguilas|enriquillo|\bsur\b|larimar/],
  ['santo-domingo', /santo domingo|zona colonial|capital|historia|museo/],
];

const KIND_WORDS: [PlaceKind, RegExp][] = [
  ['playa', /playa|mar\b|arena|snorkel/],
  ['aventura', /aventura|adrenalina|caminata|hiking|rafting|kite|cascada|salto/],
  ['naturaleza', /naturaleza|parque|animales|ballena|tranquil/],
  ['cultura', /cultura|historia|museo|arte|colonial/],
  ['gastronomía', /comida|gastronom|comer|restaurante/],
];

const DAY_TITLES: Record<PlaceKind, string[]> = {
  playa: ['Día de playa', 'Arena y mar', 'Sol sin prisa'],
  aventura: ['Modo aventura', 'Adrenalina pura', 'A explorar'],
  naturaleza: ['Naturaleza viva', 'Respira profundo', 'Verde total'],
  cultura: ['Historia a pie', 'Cultura local', 'Raíces y museos'],
  gastronomía: ['Sabores locales', 'Ruta del sabor', 'A comer rico'],
};

export function mockIntent(req: TripRequest): Intent {
  const text = req.text.toLowerCase();
  const region = REGION_WORDS.find(([, re]) => re.test(text))?.[0] ?? (/playa/.test(text) ? 'samana' : 'santo-domingo');
  const interests = KIND_WORDS.filter(([, re]) => re.test(text)).map(([k]) => k);
  return {
    region,
    interests: interests.length ? interests.slice(0, 3) : ['naturaleza', 'cultura'],
    pace: /relaj|tranquil|descans|calma/.test(text) ? 'relajado' : 'intenso',
    withKids: /niñ|hijo|familia|peque/.test(text),
  };
}

export function mockItinerary(ctx: AgentContext): ItineraryDoc {
  const { req, intent } = ctx;
  const instruction = (ctx.instruction ?? '').toLowerCase();
  const region = intent.region as RegionId;
  const extraDay = /agrega|añade|un día más|otro día/.test(instruction) ? 1 : 0;
  const dayCount = Math.min(5, Math.max(2, req.days + extraDay));
  const cheap = req.style === 'económico' || /barat|económic|menos/.test(`${req.text} ${instruction}`.toLowerCase());
  const prefs = [...intent.interests] as PlaceKind[];
  if (/playa/.test(instruction)) prefs.unshift('playa');
  if (/aventura/.test(instruction)) prefs.unshift('aventura');

  const exclude = new Set(ctx.exclude ?? []);
  const pool = PLACES.filter((p) => p.region === region && !exclude.has(p.id))
    .map((p) => ({ p, score: (prefs.includes(p.kind) ? 3 - prefs.indexOf(p.kind) * 0.5 : 0) - (cheap ? p.cost / 40 : 0) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);

  const perDay = intent.pace === 'relajado' ? 1 : 2;
  const plan = Array.from({ length: dayCount }, (_, d) => {
    const places: Place[] = [];
    const take = d === 0 ? 1 : perDay;
    for (let i = 0; i < take && pool.length; i++) places.push(pool.shift()!);
    const kind = places[0]?.kind ?? 'naturaleza';
    return {
      title: d === 0 ? 'Llegada y primer paseo' : d === dayCount - 1 ? 'Último día y regreso' : DAY_TITLES[kind][d % 3],
      placeIds: places.map((p) => p.id),
      note: places[0] ? `${places[0].blurb}.` : 'Día libre para descansar.',
    };
  }).filter((d) => d.placeIds.length);

  const regionName = REGIONS[region].name.split(' y ')[0];
  return {
    region,
    dayCount: plan.length,
    title: `${plan.length} días en ${regionName}`,
    subtitle: `Una escapada ${cheap ? 'económica' : req.style === 'premium' ? 'sin límites' : 'equilibrada'} para ${req.people} ${req.people === 1 ? 'persona' : 'personas'}, con ${intent.interests[0]} y ritmo ${intent.pace}.`,
    plan,
  };
}

export function mockLodging(ctx: AgentContext): LodgingDoc {
  const { req, intent } = ctx;
  const cheap = req.style === 'económico' || /barat|económic|menos/.test(`${req.text} ${ctx.instruction ?? ''}`.toLowerCase());
  const exclude = new Set(ctx.exclude ?? []);
  const options = LODGINGS.filter((l) => l.region === intent.region && !exclude.has(l.id)).sort((a, b) =>
    cheap ? a.pricePerNight - b.pricePerNight : req.style === 'premium' ? b.pricePerNight - a.pricePerNight : b.rating - a.rating,
  );
  return {
    options: options.slice(0, 3).map((l, i) => ({
      lodgingId: l.id,
      reason: i === 0 && cheap ? `El precio más bajo de la zona: $${l.pricePerNight} la noche.` : `${l.perks[0]} y ${l.rating}★, encaja con tu estilo.`,
      badge: i === 0 ? (cheap ? 'Más económico' : 'Mejor valor') : l.style === 'eco-lodge' ? 'Experiencia única' : intent.withKids ? 'Para familias' : undefined,
    })),
  };
}
