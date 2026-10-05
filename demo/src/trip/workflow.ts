// Workflow agéntico de Rumbo (patrón ADK: Sequential → Parallel → Sequential + Loop):
//
//   1. intent     (secuencial)  Gemini Nano entiende el pedido → región, intereses, ritmo
//   2. itinerary ∥ lodging (paralelo) dos agentes generan en streaming a la vez
//   3. verify     (secuencial)  reglas en código; si algo falla → bucle: solo el agente
//                               afectado regenera con la restricción (máx. 1 vuelta)
//   4. synthesis  (secuencial)  presupuesto calculado por código (la IA no hace cuentas)
//
// Todo sale como EVENTOS. La app los aplica a sus stores; /compare los reenvía por
// postMessage a dos iframes (ingenuo y fluido) → exactamente el mismo stream.
import type { EndStatus } from '../genui/engine';
import { parsePartialJson } from '../genui/json-stream';
import { trackSpan } from '../genui/perf-tracks';
import { firebaseProvider, mockProvider, nanoProvider, nanoSession, sleep, type GenProvider } from '../genui/providers';
import {
  INTENT_PROMPT,
  INTENT_SCHEMA,
  ITINERARY_PROMPT,
  ITINERARY_SCHEMA,
  LODGING_PROMPT,
  LODGING_SCHEMA,
  itineraryUserPrompt,
  lodgingUserPrompt,
  type AgentContext,
  type AgentId,
  type Intent,
  type ItineraryDoc,
  type LodgingDoc,
  type TripRequest,
} from './agents';
import { mockIntent, mockItinerary, mockLodging } from './planner';
import { verifyTrip, type Check } from './verify';

export type Engine = 'nano' | 'hybrid' | 'cloud' | 'mock';
export type NodeId = 'intent' | 'itinerary' | 'lodging' | 'verify' | 'synthesis';
export type NodeStatus = 'idle' | 'waiting' | 'running' | 'done' | 'error' | 'skipped' | 'loop';

export type WorkflowEvent =
  | { t: 'start'; req: TripRequest; instruction?: string }
  | { t: 'node'; id: NodeId; status: NodeStatus; note?: string }
  | { t: 'intent'; intent: Intent }
  | { t: 'begin'; agent: AgentId }
  | { t: 'chunk'; agent: AgentId; delta: string }
  | { t: 'end'; agent: AgentId; status: EndStatus }
  | { t: 'checks'; checks: Check[]; round: number }
  | { t: 'done'; ms: number; status: 'done' | 'aborted' | 'error' };

export interface RunOptions {
  req: TripRequest;
  instruction?: string;
  engine: Engine;
  /** tokens/s del simulado */
  speed?: number;
  /** lo confirmado de la generación anterior (para refinar) */
  current?: { intent?: Intent | null; itinerary?: ItineraryDoc | null; lodging?: LodgingDoc | null };
  /** false = sin verificador (para mostrar qué pasa con una IA "genérica") */
  verify?: boolean;
  signal: AbortSignal;
  emit: (e: WorkflowEvent) => void;
}

const SPECS = {
  itinerary: { system: ITINERARY_PROMPT, schema: ITINERARY_SCHEMA, prompt: itineraryUserPrompt, mock: mockItinerary, speed: 1, think: 300 },
  lodging: { system: LODGING_PROMPT, schema: LODGING_SCHEMA, prompt: lodgingUserPrompt, mock: mockLodging, speed: 0.6, think: 700 },
} as const;

function providerFor(engine: Engine, agent: AgentId, ctx: AgentContext, speed: number): GenProvider {
  const spec = SPECS[agent];
  switch (engine) {
    case 'nano':
      return nanoProvider(spec);
    case 'hybrid':
      return firebaseProvider(spec, 'prefer_on_device');
    case 'cloud':
      return firebaseProvider(spec, 'only_in_cloud');
    default:
      return mockProvider(() => JSON.stringify(spec.mock(ctx), null, 1), speed * spec.speed, spec.think);
  }
}

/** ¿El cambio pedido afecta al hospedaje? Si no, ese agente no se vuelve a ejecutar (se reutiliza). */
const touchesLodging = (instruction?: string) => !instruction || /barat|económ|lujo|premium|hotel|hosped|dormir|niñ|familia|persona/i.test(instruction);
const touchesItinerary = (instruction?: string) => !instruction || !/^(hotel|hospedaje)/i.test(instruction);

export async function runWorkflow(opts: RunOptions): Promise<void> {
  const { req, instruction, engine, signal, emit } = opts;
  const speed = opts.speed ?? 70;
  const t0 = performance.now();
  emit({ t: 'start', req, instruction });

  try {
    // ── 1. Intención (secuencial) ──────────────────────────────────────
    let intent: Intent;
    if (instruction && opts.current?.intent) {
      intent = opts.current.intent;
      emit({ t: 'node', id: 'intent', status: 'skipped', note: 'reutilizada' });
    } else {
      emit({ t: 'node', id: 'intent', status: 'running' });
      const s = performance.now();
      intent = await detectIntent(engine, req, signal);
      trackSpan('Intención', `región ${intent.region}`, s, performance.now(), 'tertiary');
      emit({ t: 'node', id: 'intent', status: 'done', note: intent.region });
    }
    emit({ t: 'intent', intent });

    // ── 2. Itinerario ∥ Hospedaje (paralelo) ───────────────────────────
    const docs: { itinerary: ItineraryDoc | null; lodging: LodgingDoc | null } = {
      itinerary: opts.current?.itinerary ?? null,
      lodging: opts.current?.lodging ?? null,
    };
    const run = async (agent: AgentId, ctx: AgentContext) => {
      emit({ t: 'node', id: agent, status: 'running' });
      emit({ t: 'begin', agent });
      const s = performance.now();
      let text = '';
      let status: EndStatus = 'done';
      const stream = async (provider: GenProvider) => {
        for await (const delta of provider.stream({ prompt: SPECS[agent].prompt(ctx), signal })) {
          if (signal.aborted) break;
          text += delta;
          emit({ t: 'chunk', agent, delta });
        }
      };
      try {
        await stream(providerFor(engine, agent, ctx, speed));
      } catch (err) {
        if (signal.aborted) status = 'aborted';
        else if (engine !== 'mock' && !text) {
          // Red de seguridad del escenario: si el modelo falla antes de empezar, seguimos con el simulado.
          console.warn(`[rumbo] ${agent} falló con ${engine}, usando simulado`, err);
          await stream(providerFor('mock', agent, ctx, speed));
        } else status = 'error';
      }
      if (signal.aborted) status = 'aborted';
      emit({ t: 'end', agent, status });
      emit({ t: 'node', id: agent, status: status === 'done' ? 'done' : 'error' });
      trackSpan(agent === 'itinerary' ? 'Itinerario' : 'Hospedaje', status, s, performance.now(), agent === 'itinerary' ? 'primary' : 'secondary');
      docs[agent] = (safeParse(text) as never) ?? docs[agent];
    };

    const base: AgentContext = { req, intent, instruction };
    const jobs: Promise<void>[] = [];
    if (touchesItinerary(instruction)) jobs.push(run('itinerary', { ...base, current: instruction ? (docs.itinerary as never) : null }));
    else emit({ t: 'node', id: 'itinerary', status: 'skipped', note: 'reutilizado' });
    if (touchesLodging(instruction)) jobs.push(run('lodging', { ...base, current: instruction ? (docs.lodging as never) : null }));
    else emit({ t: 'node', id: 'lodging', status: 'skipped', note: 'reutilizado' });
    await Promise.all(jobs);
    if (signal.aborted) throw signal.reason;

    // ── 3. Verificación (secuencial) + bucle de corrección ─────────────
    if (opts.verify === false) emit({ t: 'node', id: 'verify', status: 'skipped', note: 'apagado' });
    for (let round = 0; round < 2 && opts.verify !== false; round++) {
      emit({ t: 'node', id: 'verify', status: 'running' });
      const s = performance.now();
      const checks = verifyTrip(req, docs.itinerary, docs.lodging);
      emit({ t: 'checks', checks, round });
      const blocks = checks.filter((c) => c.level === 'block' && c.exclude);
      trackSpan('Verificador', `${blocks.length} bloqueos`, s, performance.now(), blocks.length ? 'error' : 'tertiary');
      if (!blocks.length || round === 1) {
        emit({ t: 'node', id: 'verify', status: 'done', note: blocks.length ? `${blocks.length} pendientes` : 'todo ok' });
        break;
      }
      emit({ t: 'node', id: 'verify', status: 'loop', note: `corrigiendo ${blocks.length}` });
      // Pausa breve: que la persona VEA qué se descartó y por qué antes de corregir.
      await sleep(1400, signal);
      const fix = (agent: AgentId) => blocks.filter((b) => b.agent === agent).map((b) => b.exclude!);
      await Promise.all(
        (['itinerary', 'lodging'] as AgentId[])
          .filter((a) => fix(a).length)
          .map((a) => run(a, { ...base, exclude: fix(a), current: docs[a] as never, instruction: instruction ?? 'corrige lo marcado por el verificador' })),
      );
      if (signal.aborted) throw signal.reason;
    }

    // ── 4. Síntesis (secuencial): el presupuesto lo calcula el código ───
    emit({ t: 'node', id: 'synthesis', status: 'running' });
    emit({ t: 'node', id: 'synthesis', status: 'done', note: 'presupuesto calculado' });
    trackSpan('Workflow', 'total', t0, performance.now(), 'primary-light');
    emit({ t: 'done', ms: performance.now() - t0, status: 'done' });
  } catch (err) {
    const status = signal.aborted ? 'aborted' : 'error';
    if (status === 'error') console.error(err);
    emit({ t: 'done', ms: performance.now() - t0, status });
  }
}

async function detectIntent(engine: Engine, req: TripRequest, signal: AbortSignal): Promise<Intent> {
  if (engine === 'nano') {
    try {
      const session = await (await nanoSession(INTENT_PROMPT)).clone({ signal });
      try {
        const raw = await session.prompt(`Pedido: ${req.text}`, { responseConstraint: INTENT_SCHEMA, signal });
        return JSON.parse(raw) as Intent;
      } finally {
        session.destroy();
      }
    } catch (err) {
      if (signal.aborted) throw err;
      console.warn('[rumbo] intención con Nano falló, uso reglas locales', err);
    }
  }
  if (engine === 'hybrid' || engine === 'cloud') {
    try {
      const provider = firebaseProvider({ system: INTENT_PROMPT, schema: INTENT_SCHEMA }, engine === 'cloud' ? 'only_in_cloud' : 'prefer_on_device');
      let text = '';
      for await (const d of provider.stream({ prompt: `Pedido: ${req.text}`, signal })) text += d;
      return JSON.parse(text) as Intent;
    } catch (err) {
      if (signal.aborted) throw err;
    }
  }
  await new Promise((r) => setTimeout(r, 350));
  return mockIntent(req);
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return parsePartialJson(text);
  }
}
