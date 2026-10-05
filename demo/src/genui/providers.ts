// Proveedores de generación: todos exponen un stream de texto (deltas).
//   nano  → Prompt API de Chrome (Gemini Nano en el dispositivo; estable desde Chrome 148)
//   cloud → Gemini API (respaldo cuando el equipo no tiene Nano)
//   mock  → red de seguridad automática: sin red ni Nano la demo sigue funcionando
import { GEMINI_API_KEY, GEMINI_MODEL, hasCloud } from '../shared/config';

export type ProviderId = 'nano' | 'cloud' | 'mock';

export interface AgentSpec {
  system: string;
  schema: object;
}

export interface GenRequest {
  prompt: string;
  signal: AbortSignal;
  onStatus?: (msg: string) => void;
}

export interface GenProvider {
  id: ProviderId;
  label: string;
  stream(req: GenRequest): AsyncGenerator<string>;
}

// ── Gemini Nano (Prompt API) ─────────────────────────────────────────────
interface LanguageModelSession {
  prompt(input: string, opts?: { responseConstraint?: object; signal?: AbortSignal }): Promise<string>;
  promptStreaming(input: string, opts?: { responseConstraint?: object; signal?: AbortSignal }): ReadableStream<string> & AsyncIterable<string>;
  clone(opts?: { signal?: AbortSignal }): Promise<LanguageModelSession>;
  destroy(): void;
}
interface LanguageModelStatic {
  availability(opts?: object): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>;
  create(opts?: object): Promise<LanguageModelSession>;
}
export const LanguageModelApi = (globalThis as { LanguageModel?: LanguageModelStatic }).LanguageModel;

export const LANG_OPTS = {
  expectedInputs: [{ type: 'text', languages: ['es', 'en'] }],
  expectedOutputs: [{ type: 'text', languages: ['es'] }],
};

export async function nanoAvailability(): Promise<string> {
  if (!LanguageModelApi) return 'no-api';
  try {
    return await LanguageModelApi.availability(LANG_OPTS);
  } catch {
    return 'unavailable';
  }
}

// Una sesión base por agente: el system prompt (con el catálogo) se procesa una sola vez.
const baseSessions = new Map<string, Promise<LanguageModelSession>>();

export async function nanoSession(system: string, onStatus?: (m: string) => void): Promise<LanguageModelSession> {
  if (!LanguageModelApi) throw new Error('Prompt API no disponible');
  if (!baseSessions.has(system)) {
    baseSessions.set(
      system,
      LanguageModelApi.create({
        ...LANG_OPTS,
        initialPrompts: [{ role: 'system', content: system }],
        monitor(m: EventTarget) {
          m.addEventListener('downloadprogress', (e) => onStatus?.(`Descargando Gemini Nano… ${Math.round((e as ProgressEvent).loaded * 100)}%`));
        },
      }),
    );
  }
  return baseSessions.get(system)!;
}

export function nanoProvider(agent: AgentSpec): GenProvider {
  return {
    id: 'nano',
    label: 'Gemini Nano · en tu dispositivo',
    async *stream({ prompt, signal, onStatus }) {
      // clone(): reutiliza el contexto del system prompt sin acumular historial entre pedidos.
      const session = await (await nanoSession(agent.system, onStatus)).clone({ signal });
      try {
        for await (const chunk of session.promptStreaming(prompt, { responseConstraint: agent.schema, signal })) yield chunk;
      } finally {
        session.destroy();
      }
    },
  };
}

// ── Gemini API en la nube (respaldo) ─────────────────────────────────────
/** Streaming por SSE contra la Gemini API, con el MISMO JSON Schema que usa Nano. */
export function cloudProvider(agent: AgentSpec): GenProvider {
  return {
    id: 'cloud',
    label: `Gemini API · ${GEMINI_MODEL}`,
    async *stream({ prompt, signal }) {
      if (!GEMINI_API_KEY) throw new Error('Falta VITE_GEMINI_API_KEY');
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: agent.system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', responseJsonSchema: agent.schema, temperature: 0.4 },
        }),
      });
      if (!res.ok || !res.body) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          const json = JSON.parse(line.slice(5));
          for (const part of json.candidates?.[0]?.content?.parts ?? []) if (part.text) yield part.text as string;
        }
      }
    },
  };
}

// ── Simulado ─────────────────────────────────────────────────────────────
export function mockProvider(text: () => string, tokensPerSecond = 60, thinkMs = 400): GenProvider {
  return {
    id: 'mock',
    label: 'Simulado · sin red',
    async *stream({ signal }) {
      const json = text();
      await sleep(thinkMs, signal);
      // "Tokens" de 2 a 6 caracteres, como un LLM real (determinista: mismo stream siempre).
      let i = 0;
      let seed = 7;
      while (i < json.length) {
        seed = (seed * 9301 + 49297) % 233280;
        const size = 2 + (seed % 5);
        yield json.slice(i, i + size);
        i += size;
        await sleep(1000 / tokensPerSecond, signal);
      }
    },
  };
}

export function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });
}

export type ProviderChoice = 'auto' | 'nano' | 'cloud';
export type Engine = 'nano' | 'cloud' | 'mock';

/** Local primero, nube de respaldo; si no hay ninguno, el simulado (plan B del escenario). */
export async function resolveEngine(choice: ProviderChoice | 'mock'): Promise<Engine> {
  if (choice === 'mock') return 'mock';
  const a = await nanoAvailability();
  const nano = a === 'available' || a === 'downloadable';
  if (choice === 'nano') return nano ? 'nano' : hasCloud ? 'cloud' : 'mock';
  if (choice === 'cloud') return hasCloud ? 'cloud' : nano ? 'nano' : 'mock';
  return nano ? 'nano' : hasCloud ? 'cloud' : 'mock';
}
