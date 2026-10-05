// Store de un documento generado en streaming (uno por agente).
//
//   fields    → valores de primer nivel ya completos  (region, dayCount, title…)
//   partial   → strings de primer nivel a medio escribir (el título letra por letra)
//   lists     → arrays de objetos, ítem por ítem, cada uno parcial o completo
//   previous  → el documento confirmado de la generación anterior: se sigue mostrando
//               hasta que llega su reemplazo (nunca pantalla en blanco al refinar)
//
// Las operaciones llegan muchas veces por segundo; los suscriptores se notifican
// UNA vez por frame con la lista de claves que cambiaron.
import type { EndStatus, Sink } from './engine';
import { createJsonStreamParser } from './json-stream';

export type DocStatus = 'idle' | 'waiting' | 'thinking' | 'streaming' | 'done' | 'error' | 'aborted';

export interface ListItem {
  value: Record<string, unknown>;
  complete: boolean;
}

export interface DocState {
  status: DocStatus;
  fields: Record<string, unknown>;
  partial: Record<string, string>;
  lists: Record<string, ListItem[]>;
  previous: Record<string, unknown> | null;
  startedAt: number;
  firstTokenAt: number | null;
}

const initial = (): DocState => ({ status: 'idle', fields: {}, partial: {}, lists: {}, previous: null, startedAt: 0, firstTokenAt: null });

export class DocStore implements Sink {
  state: DocState = initial();
  private changed = new Set<string>();
  private subs = new Set<(s: DocState, changed: Set<string>) => void>();
  private scheduled = false;
  private raf = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private parser = createJsonStreamParser({});

  /**
   * Envoltorio opcional del flush. La app lo usa para aplicar los cambios ESTRUCTURALES
   * (un nodo que cambia de lugar) dentro de document.startViewTransition + flushSync.
   */
  wrapFlush?: (run: () => void, changed: Set<string>, state: DocState) => void;

  constructor(readonly name: string) {}

  // ── Sink: lo alimenta el motor de streaming ──────────────────────────
  begin() {
    this.state = { ...initial(), status: 'thinking', previous: this.committed(), startedAt: performance.now() };
    this.parser = createJsonStreamParser({
      onField: (key, value) => {
        this.state.fields[key] = value;
        delete this.state.partial[key];
        this.mark(key);
      },
      onPartialString: (key, text) => {
        this.state.partial[key] = text;
        this.mark(key);
      },
      onItem: (key, index, value, complete) => {
        const list = (this.state.lists[key] ??= []);
        if (list[index]?.complete && !complete) return; // un parcial nunca pisa a un completo
        list[index] = { value, complete }; // objeto nuevo solo para el ítem que cambió
        this.mark(`${key}.${index}`);
        this.mark(`${key}.length`);
      },
    });
    this.mark('status');
  }

  chunk(delta: string) {
    if (this.state.status !== 'streaming') {
      this.state.status = 'streaming';
      this.state.firstTokenAt = performance.now();
      this.mark('status');
    }
    this.parser.push(delta);
  }

  end(status: EndStatus) {
    this.state.status = status;
    this.mark('status');
    this.flush();
  }

  /** Para agentes que esperan a otro (estado visible "esperando…"). */
  wait() {
    this.state = { ...this.state, status: 'waiting' };
    this.mark('status');
  }

  // ── Lectura ──────────────────────────────────────────────────────────
  /** Valor visible de un campo: completo → parcial → el de la generación anterior. */
  field<T = unknown>(key: string): T | undefined {
    const s = this.state;
    return (s.fields[key] ?? s.partial[key] ?? (busy(s) ? s.previous?.[key] : undefined)) as T | undefined;
  }

  item(key: string, index: number): ListItem | undefined {
    return this.state.lists[key]?.[index];
  }

  /** Documento solo con lo COMPLETO: es lo que se guarda o se manda de vuelta al modelo. */
  committed(): Record<string, unknown> | null {
    const s = this.state;
    if (s.status === 'idle') return s.previous;
    const doc: Record<string, unknown> = { ...s.fields };
    for (const [key, list] of Object.entries(s.lists)) doc[key] = list.filter((i) => i?.complete).map((i) => i.value);
    return Object.keys(doc).length ? doc : s.previous;
  }

  // ── Suscripción agrupada por frame ───────────────────────────────────
  subscribe = (fn: (s: DocState, changed: Set<string>) => void) => {
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
    };
  };

  private mark(key: string) {
    this.changed.add(key);
    if (this.scheduled) return;
    this.scheduled = true;
    this.raf = requestAnimationFrame(() => this.flush());
    // rAF no corre en pestañas ocultas: el timeout es la red de seguridad.
    this.timer = setTimeout(() => this.flush(), 60);
  }

  private flush() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
    this.scheduled = false;
    if (!this.changed.size) return;
    const changed = this.changed;
    this.changed = new Set();
    const run = () => this.subs.forEach((fn) => fn(this.state, changed));
    if (this.wrapFlush) this.wrapFlush(run, changed, this.state);
    else run();
  }
}

export const busy = (s: DocState) => s.status === 'thinking' || s.status === 'streaming' || s.status === 'waiting';
