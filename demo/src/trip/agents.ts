// Los dos agentes generativos de Rumbo. Cada uno tiene su contrato (JSON Schema)
// y su system prompt. El presupuesto y el mapa NO los genera la IA: se DERIVAN del
// estado en el cliente (la IA decide, el código calcula).
import { LODGINGS, PLACES, REGIONS, REGION_IDS } from './places';

export interface TripRequest {
  text: string;
  people: number;
  days: number;
  style: 'económico' | 'equilibrado' | 'premium';
  /** mes del viaje (1-12): el verificador revisa temporadas */
  month: number;
}

export type AgentId = 'itinerary' | 'lodging';

/** Lo que entendió el agente de intención (paso 1, secuencial). */
export interface Intent {
  region: string;
  interests: string[];
  pace: 'relajado' | 'intenso';
  withKids: boolean;
}

export const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    region: { type: 'string', enum: REGION_IDS },
    interests: { type: 'array', items: { type: 'string', enum: ['playa', 'naturaleza', 'cultura', 'aventura', 'gastronomía'] }, minItems: 1, maxItems: 3 },
    pace: { type: 'string', enum: ['relajado', 'intenso'] },
    withKids: { type: 'boolean' },
  },
  required: ['region', 'interests', 'pace', 'withKids'],
} as const;

export const INTENT_PROMPT = `Eres el agente de intención de Rumbo. Lees lo que pide un viajero en República Dominicana
y devuelves SOLO JSON con la región que mejor encaja, sus intereses, el ritmo y si viaja con niños.
Regiones: ${REGION_IDS.map((r) => `${r} (${REGIONS[r].name})`).join(', ')}`;

export interface ItineraryDay {
  title?: string;
  placeIds?: string[];
  note?: string;
}

export interface ItineraryDoc {
  region?: string;
  dayCount?: number;
  title?: string;
  subtitle?: string;
  plan?: ItineraryDay[];
}

export interface LodgingOption {
  lodgingId?: string;
  reason?: string;
  badge?: string;
}

export interface LodgingDoc {
  options?: LodgingOption[];
}

// ── Agente de itinerario ─────────────────────────────────────────────────
// Orden de propiedades pensado para el streaming: primero lo que permite
// reservar espacio y arrancar al otro agente (región, número de días).
export const ITINERARY_SCHEMA = {
  type: 'object',
  properties: {
    region: { type: 'string', enum: REGION_IDS },
    dayCount: { type: 'integer', minimum: 2, maximum: 5 },
    title: { type: 'string' },
    subtitle: { type: 'string' },
    plan: {
      type: 'array',
      minItems: 2,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          placeIds: { type: 'array', items: { type: 'string', enum: PLACES.map((p) => p.id) }, minItems: 1, maxItems: 3 },
          note: { type: 'string' },
        },
        required: ['title', 'placeIds'],
      },
    },
  },
  required: ['region', 'dayCount', 'title', 'subtitle', 'plan'],
} as const;

export const ITINERARY_PROMPT = `Eres el agente de itinerarios de Rumbo, una web de escapadas por República Dominicana.
Responde SOLO JSON que cumpla el schema, en español, con frases cortas y cálidas.
Reglas:
- Primero "region" y "dayCount" (igual al número de días pedido), luego "title" (máx. 6 palabras) y "subtitle" (máx. 16 palabras).
- "plan" tiene exactamente dayCount días. Cada día: "title" (máx. 5 palabras), 1 a 3 placeIds de ESA región, "note" (máx. 14 palabras).
- No repitas lugares. Respeta el estilo y presupuesto.
Regiones: ${REGION_IDS.map((r) => `${r} (${REGIONS[r].name})`).join(', ')}
Lugares (id | región | tipo | costo USD | descripción):
${PLACES.map((p) => `${p.id} | ${p.region} | ${p.kind} | ${p.cost} | ${p.blurb}`).join('\n')}`;

// ── Agente de hospedaje ──────────────────────────────────────────────────
export const LODGING_SCHEMA = {
  type: 'object',
  properties: {
    options: {
      type: 'array',
      minItems: 2,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          lodgingId: { type: 'string', enum: LODGINGS.map((l) => l.id) },
          reason: { type: 'string' },
          badge: { type: 'string', enum: ['Mejor valor', 'Más económico', 'Experiencia única', 'Para familias'] },
        },
        required: ['lodgingId', 'reason'],
      },
    },
  },
  required: ['options'],
} as const;

export const LODGING_PROMPT = `Eres el agente de hospedaje de Rumbo. Recomiendas 2 o 3 hospedajes de la región indicada.
Responde SOLO JSON que cumpla el schema, en español. "reason": máx. 12 palabras, por qué encaja con el viajero.
Hospedajes (id | región | estilo | USD/noche | rating | extras):
${LODGINGS.map((l) => `${l.id} | ${l.region} | ${l.style} | ${l.pricePerNight} | ${l.rating} | ${l.perks.join(', ')}`).join('\n')}`;

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const monthName = (m: number) => MONTHS[(m - 1 + 12) % 12];

export interface AgentContext {
  req: TripRequest;
  intent: Intent;
  /** cambio pedido por la persona ("más barato", "agrega un día de playa") */
  instruction?: string;
  /** restricciones que agrega el verificador en el bucle de corrección */
  exclude?: string[];
  current?: Record<string, unknown> | null;
}

function constraints(ctx: AgentContext): string {
  let out = '';
  if (ctx.instruction) out += `\nCambio pedido: ${ctx.instruction}. Conserva lo que siga aplicando.`;
  if (ctx.current) out += `\nVersión actual: ${JSON.stringify(ctx.current)}`;
  if (ctx.exclude?.length) out += `\nNO uses estos ids (el verificador los rechazó): ${ctx.exclude.join(', ')}.`;
  return out;
}

export function itineraryUserPrompt(ctx: AgentContext): string {
  const { req, intent } = ctx;
  return `Viaje: ${req.text}. Región: ${intent.region}. Personas: ${req.people}. Días: ${req.days}. Mes: ${monthName(req.month)}. Estilo: ${req.style}. Intereses: ${intent.interests.join(', ')}. Ritmo: ${intent.pace}.${intent.withKids ? ' Viaja con niños.' : ''}${constraints(ctx)}`;
}

export function lodgingUserPrompt(ctx: AgentContext): string {
  const { req, intent } = ctx;
  return `Región: ${intent.region}. Personas: ${req.people}. Noches: ${Math.max(1, req.days - 1)}. Estilo: ${req.style}. Pedido: ${req.text}.${intent.withKids ? ' Viaja con niños.' : ''}${constraints(ctx)}`;
}
