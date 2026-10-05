// Orquestación: un proveedor produce texto, uno o varios "sinks" (renderers) lo consumen.
// En modo comparación el MISMO stream alimenta al renderer ingenuo y al fluido.
import type { GenProvider, GenRequest } from './providers';

export type EndStatus = 'done' | 'error' | 'aborted';

export interface Sink {
  begin(): void;
  chunk(delta: string): void;
  end(status: EndStatus, error?: unknown): void;
}

/** Cede el hilo principal para que el navegador pueda pintar y responder al input (INP). */
export function yieldToMain(): Promise<void> {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (s?.yield) return s.yield();
  return new Promise((r) => setTimeout(r, 0));
}

export async function runGeneration(provider: GenProvider, req: GenRequest, sinks: Sink[]): Promise<EndStatus> {
  sinks.forEach((s) => s.begin());
  let lastYield = performance.now();
  try {
    for await (const delta of provider.stream(req)) {
      if (req.signal.aborted) break;
      for (const sink of sinks) sink.chunk(delta);
      // Si llevamos >40 ms trabajando sin pausa, dejamos respirar al navegador.
      if (performance.now() - lastYield > 40) {
        await yieldToMain();
        lastYield = performance.now();
      }
    }
    const status: EndStatus = req.signal.aborted ? 'aborted' : 'done';
    sinks.forEach((s) => s.end(status));
    return status;
  } catch (err) {
    const status: EndStatus = req.signal.aborted ? 'aborted' : 'error';
    sinks.forEach((s) => s.end(status, err));
    if (status === 'error') console.error(err);
    return status;
  }
}
