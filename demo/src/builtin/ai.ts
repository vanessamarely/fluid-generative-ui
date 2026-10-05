// APIs de IA integradas en Chrome (Gemini Nano en el dispositivo), con detección de
// disponibilidad y un respaldo simulado para que la demo nunca se quede en blanco.
//   Prompt API       → LanguageModel   (sugerencias del panel contextual, preguntas)
//   Summarizer API   → Summarizer      (resumen del viaje para compartir)
//   Translator API   → Translator      (itinerario en inglés para quien viaja contigo)
//   Rewriter API     → Rewriter        (cambiar el tono del mensaje)
import { LANG_OPTS, LanguageModelApi, nanoSession, sleep } from '../genui/providers';

type Availability = 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'no-api';

interface StreamingApi {
  availability(opts?: object): Promise<Availability>;
  create(opts?: object): Promise<Record<string, (...args: unknown[]) => unknown> & { destroy(): void }>;
}

const g = globalThis as unknown as Record<string, StreamingApi | undefined>;

export const BUILTIN_APIS = [
  { id: 'LanguageModel', label: 'Prompt API', use: 'agentes y sugerencias' },
  { id: 'Summarizer', label: 'Summarizer', use: 'resumen para compartir' },
  { id: 'Translator', label: 'Translator', use: 'itinerario en inglés' },
  { id: 'Rewriter', label: 'Rewriter', use: 'tono del mensaje' },
] as const;

export type BuiltinId = (typeof BUILTIN_APIS)[number]['id'];

const AVAIL_OPTS: Record<BuiltinId, object> = {
  LanguageModel: LANG_OPTS,
  Summarizer: { type: 'tldr', format: 'plain-text', length: 'short', expectedInputLanguages: ['es'], outputLanguage: 'es' },
  Translator: { sourceLanguage: 'es', targetLanguage: 'en' },
  Rewriter: { expectedInputLanguages: ['es'], outputLanguage: 'es' },
};

export async function availabilityOf(id: BuiltinId): Promise<Availability> {
  const api = id === 'LanguageModel' ? (LanguageModelApi as unknown as StreamingApi | undefined) : g[id];
  if (!api) return 'no-api';
  try {
    return await api.availability(AVAIL_OPTS[id]);
  } catch {
    return 'unavailable';
  }
}

async function* simulate(text: string, signal?: AbortSignal): AsyncGenerator<string> {
  for (const word of text.split(/(\s+)/)) {
    if (signal?.aborted) return;
    yield word;
    await sleep(18, signal).catch(() => undefined);
  }
}

export interface AiResult {
  stream: AsyncGenerator<string>;
  /** true si corrió en el modelo del dispositivo; false si es el respaldo simulado */
  native: boolean;
}

/** Sugerencias / preguntas con la Prompt API (sesión reutilizada por system prompt). */
export async function promptStream(system: string, input: string, fallback: string, signal?: AbortSignal): Promise<AiResult> {
  if ((await availabilityOf('LanguageModel')) === 'available') {
    const session = await (await nanoSession(system)).clone({ signal });
    const s = session.promptStreaming(input, { signal });
    return {
      native: true,
      stream: (async function* () {
        try {
          for await (const c of s) yield c;
        } finally {
          session.destroy();
        }
      })(),
    };
  }
  return { native: false, stream: simulate(fallback, signal) };
}

export async function summarizeStream(text: string, fallback: string, signal?: AbortSignal): Promise<AiResult> {
  if ((await availabilityOf('Summarizer')) === 'available') {
    const s = await g.Summarizer!.create({ ...AVAIL_OPTS.Summarizer, signal });
    return { native: true, stream: wrap(s, s.summarizeStreaming(text, { signal }) as AsyncIterable<string>) };
  }
  return { native: false, stream: simulate(fallback, signal) };
}

export async function translateStream(text: string, fallback: string, signal?: AbortSignal): Promise<AiResult> {
  const a = await availabilityOf('Translator');
  if (a === 'available' || a === 'downloadable') {
    const t = await g.Translator!.create({ ...AVAIL_OPTS.Translator, signal });
    return { native: true, stream: wrap(t, t.translateStreaming(text, { signal }) as AsyncIterable<string>) };
  }
  return { native: false, stream: simulate(fallback, signal) };
}

export async function rewriteStream(text: string, tone: 'more-casual' | 'more-formal', fallback: string, signal?: AbortSignal): Promise<AiResult> {
  if ((await availabilityOf('Rewriter')) === 'available') {
    const r = await g.Rewriter!.create({ ...AVAIL_OPTS.Rewriter, tone, signal });
    return { native: true, stream: wrap(r, r.rewriteStreaming(text, { signal }) as AsyncIterable<string>) };
  }
  return { native: false, stream: simulate(fallback, signal) };
}

async function* wrap(owner: { destroy(): void }, source: AsyncIterable<string>): AsyncGenerator<string> {
  try {
    for await (const c of source) yield c;
  } finally {
    owner.destroy();
  }
}
