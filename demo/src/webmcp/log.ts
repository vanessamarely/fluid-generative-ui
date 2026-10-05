// Consola de llamadas a tools: quién llamó (agente del navegador o la propia UI), con qué y qué devolvió.
export interface ToolCall {
  id: number;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  source: 'agente' | 'ui';
  at: number;
  ms?: number;
}

let calls: ToolCall[] = [];
let seq = 0;
const subs = new Set<() => void>();

export const toolLog = {
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  },
  get: () => calls,
  start(name: string, args: Record<string, unknown>, source: ToolCall['source']): number {
    const id = ++seq;
    calls = [{ id, name, args, source, at: Date.now() }, ...calls].slice(0, 40);
    subs.forEach((f) => f());
    return id;
  },
  finish(id: number, result: string, isError = false, ms = 0) {
    calls = calls.map((c) => (c.id === id ? { ...c, result, isError, ms } : c));
    subs.forEach((f) => f());
  },
};
