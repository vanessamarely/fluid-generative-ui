// Métricas por panel, medidas con APIs reales del navegador:
//  - Layout Shift (PerformanceObserver 'layout-shift', atribuido por nodo)
//  - Nodos creados / eliminados (MutationObserver)
//  - Long tasks (PerformanceObserver 'longtask', global)
export interface PanelMetrics {
  renders: number;
  created: number;
  removed: number;
  reused: number;
  cls: number;
  announcements: number;
  firstContentMs: number | null;
  totalMs: number | null;
}

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
  sources?: { node?: Node | null }[];
}

const tracked = new Map<HTMLElement, PanelMetrics>();
let observersReady = false;
export const globalMetrics = { longTasks: 0, longTaskMs: 0 };
const listeners = new Set<() => void>();

function initObservers() {
  if (observersReady) return;
  observersReady = true;
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as LayoutShiftEntry[]) {
        if (e.hadRecentInput) continue;
        for (const [root, m] of tracked) {
          if (e.sources?.some((s) => s.node && root.contains(s.node))) m.cls += e.value;
        }
      }
      notify();
    }).observe({ type: 'layout-shift', buffered: false });
  } catch {
    /* Safari/Firefox: sin Layout Instability API */
  }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        globalMetrics.longTasks++;
        globalMetrics.longTaskMs += e.duration;
      }
      notify();
    }).observe({ type: 'longtask', buffered: false });
  } catch {
    /* noop */
  }
}

let pending = false;
function notify() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    listeners.forEach((l) => l());
  });
}

export function onMetricsChange(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function trackPanel(root: HTMLElement): { metrics: PanelMetrics; reset(): void; changed(): void } {
  initObservers();
  const metrics: PanelMetrics = { renders: 0, created: 0, removed: 0, reused: 0, cls: 0, announcements: 0, firstContentMs: null, totalMs: null };
  tracked.set(root, metrics);
  let seen = new WeakSet<Node>();
  const count = (node: Node, fn: (n: Node) => void) => {
    if (node.nodeType !== 1) return;
    fn(node);
    (node as Element).querySelectorAll('*').forEach(fn);
  };
  new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) =>
        count(n, (x) => {
          if (!seen.has(x)) {
            seen.add(x);
            metrics.created++;
          }
        }),
      );
      r.removedNodes.forEach((n) =>
        count(n, (x) => {
          if (!x.isConnected) metrics.removed++;
        }),
      );
    }
    notify();
  }).observe(root, { childList: true, subtree: true });

  return {
    metrics,
    reset() {
      Object.assign(metrics, { renders: 0, created: 0, removed: 0, reused: 0, cls: 0, announcements: 0, firstContentMs: null, totalMs: null });
      seen = new WeakSet();
      root.querySelectorAll('*').forEach((n) => seen.add(n));
      notify();
    },
    changed: notify,
  };
}
