// Proveedores de generación: todos exponen un stream de texto (deltas).
//   nano     → Prompt API de Chrome (Gemini Nano en el dispositivo; estable desde Chrome 148)
//   firebase → Firebase AI Logic híbrido (Nano si está, Gemini en la nube si no)
//   mock     → texto pregenerado con latencia de "tokens" (sin red, siempre disponible)
import { hasFirebase, TEXT_MODEL } from '../shared/config';

export type ProviderId = 'nano' | 'firebase' | 'mock';

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

// ── Firebase AI Logic (híbrido) ──────────────────────────────────────────
export function firebaseProvider(agent: AgentSpec, mode: 'prefer_on_device' | 'only_in_cloud' = 'prefer_on_device'): GenProvider {
  return {
    id: 'firebase',
    label: mode === 'only_in_cloud' ? `Gemini en la nube · ${TEXT_MODEL}` : 'Firebase AI Logic · híbrido',
    async *stream({ prompt, signal, onStatus }) {
      const [{ getAI, getGenerativeModel, GoogleAIBackend }, { getFirebaseApp }] = await Promise.all([import('firebase/ai'), import('../shared/firebase')]);
      const ai = getAI(await getFirebaseApp(), { backend: new GoogleAIBackend() });
      const model = getGenerativeModel(ai, {
        mode,
        onDeviceParams: {
          createOptions: { ...LANG_OPTS, initialPrompts: [{ role: 'system', content: agent.system }] } as never,
          promptOptions: { responseConstraint: agent.schema },
        },
        inCloudParams: {
          model: TEXT_MODEL,
          systemInstruction: agent.system,
          generationConfig: { responseMimeType: 'application/json', responseJsonSchema: agent.schema as never, temperature: 0.4 },
        },
      });
      const result = await model.generateContentStream(prompt, { signal } as never);
      let announced = false;
      for await (const chunk of result.stream) {
        if (signal.aborted) return;
        if (!announced && chunk.inferenceSource) {
          onStatus?.(chunk.inferenceSource === 'on_device' ? 'Generando en el dispositivo' : 'Generando en la nube');
          announced = true;
        }
        yield chunk.text();
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

export type ProviderChoice = 'auto' | 'nano' | 'hybrid' | 'cloud' | 'mock';

/** Resuelve qué motor usar: Nano → Firebase híbrido → simulado. */
export async function resolveEngine(choice: ProviderChoice): Promise<'nano' | 'hybrid' | 'cloud' | 'mock'> {
  if (choice !== 'auto') return choice;
  const a = await nanoAvailability();
  if (a === 'available' || a === 'downloadable') return 'nano';
  return hasFirebase ? 'hybrid' : 'mock';
}
