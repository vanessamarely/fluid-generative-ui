// Tools que Rumbo expone a agentes del navegador con WebMCP.
// La misma superficie la usa la propia UI (así la consola muestra todo el tráfico).
import { getModelContext } from './polyfill';
import { toolLog } from './log';
import type { ToolResult } from './types';

export interface TripActions {
  plan(args: { request: string; days?: number; people?: number; style?: string; month?: number }): Promise<string>;
  refine(instruction: string): Promise<string>;
  itineraryText(): string;
  selectLodging(id: string): Promise<string>;
  setPeople(n: number): string;
  ask(question: string): Promise<string>;
  /** Puerta de confirmación humana para acciones sensibles. */
  confirm(message: string): Promise<boolean>;
}

const ok = (text: string): ToolResult => ({ content: [{ type: 'text', text }] });
const fail = (text: string): ToolResult => ({ content: [{ type: 'text', text }], isError: true });

let registered: AbortController | null = null;

export function registerTripTools(actions: TripActions) {
  registered?.abort();
  registered = new AbortController();
  const { ctx } = getModelContext();
  const signal = registered.signal;

  const tool = <A extends Record<string, unknown>>(
    name: string,
    description: string,
    inputSchema: Record<string, unknown>,
    run: (args: A) => Promise<string> | string,
    readOnly = false,
  ) =>
    ctx.registerTool(
      {
        name,
        description,
        inputSchema,
        annotations: { readOnlyHint: readOnly },
        async execute(args: A) {
          const id = toolLog.start(name, args, 'agente');
          const t = performance.now();
          try {
            const text = await run(args ?? ({} as A));
            toolLog.finish(id, text, false, performance.now() - t);
            return ok(text);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            toolLog.finish(id, msg, true, performance.now() - t);
            return fail(msg);
          }
        },
      } as never,
      { signal },
    );

  tool<{ request: string; days?: number; people?: number; style?: string; month?: number }>(
    'plan_trip',
    'Planifica una escapada por República Dominicana. Ejecuta el workflow de agentes (intención → itinerario ∥ hospedaje → verificación) y devuelve el itinerario verificado.',
    {
      type: 'object',
      properties: {
        request: { type: 'string', description: 'Qué quiere la persona, ej. "playa y naturaleza en Samaná"' },
        days: { type: 'integer', minimum: 2, maximum: 5 },
        people: { type: 'integer', minimum: 1, maximum: 8 },
        style: { type: 'string', enum: ['económico', 'equilibrado', 'premium'] },
        month: { type: 'integer', minimum: 1, maximum: 12, description: 'Mes del viaje' },
      },
      required: ['request'],
    },
    (a) => actions.plan(a),
  );

  tool<{ instruction: string }>(
    'refine_trip',
    'Ajusta el itinerario actual sin rehacerlo todo, ej. "más barato" o "agrega un día de playa".',
    { type: 'object', properties: { instruction: { type: 'string' } }, required: ['instruction'] },
    (a) => actions.refine(a.instruction),
  );

  tool('get_itinerary', 'Devuelve el itinerario actual en texto, con hospedaje y presupuesto.', { type: 'object', properties: {} }, () => actions.itineraryText(), true);

  tool<{ lodging_id: string }>(
    'select_lodging',
    'Elige un hospedaje de las opciones recomendadas. Requiere confirmación de la persona.',
    { type: 'object', properties: { lodging_id: { type: 'string' } }, required: ['lodging_id'] },
    async (a) => {
      if (!(await actions.confirm(`Un agente quiere seleccionar el hospedaje "${a.lodging_id}". ¿Lo permites?`))) throw new Error('La persona rechazó la acción.');
      return actions.selectLodging(a.lodging_id);
    },
  );

  tool<{ people: number }>(
    'set_travelers',
    'Cambia el número de personas; el presupuesto se recalcula al instante.',
    { type: 'object', properties: { people: { type: 'integer', minimum: 1, maximum: 8 } }, required: ['people'] },
    (a) => actions.setPeople(a.people),
  );

  tool<{ question: string }>(
    'ask_travel_assistant',
    'Pregunta algo sobre el viaje al asistente contextual (Gemini Nano en el dispositivo).',
    { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] },
    (a) => actions.ask(a.question),
    true,
  );
}

/** La UI llama a sus propias tools por el mismo camino (y quedan en la consola). */
export async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const { ctx } = getModelContext();
  if (ctx.executeTool) return ctx.executeTool(name, args);
  return fail('Este navegador no permite invocar tools desde la página.');
}
