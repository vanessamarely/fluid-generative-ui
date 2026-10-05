// Consola WebMCP + Laboratorio de rendimiento (para la charla).
import { X } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { BUILTIN_APIS, availabilityOf } from '../builtin/ai';
import { globalMetrics, type PanelMetrics } from '../genui/metrics';
import type { ProviderChoice } from '../genui/providers';
import { toolLog } from '../webmcp/log';
import { getModelContext } from '../webmcp/polyfill';

export function ToolConsole({ onTry }: { onTry: (name: string) => void }) {
  const calls = useSyncExternalStore(toolLog.subscribe, toolLog.get);
  const [tools, setTools] = useState<string[]>([]);
  const { ctx, native } = getModelContext();
  useEffect(() => {
    const load = () => ctx.getTools?.().then((t) => setTools(t.map((x) => x.name)));
    load();
    ctx.addEventListener('toolchange', load);
    return () => ctx.removeEventListener('toolchange', load);
  }, [ctx]);
  return (
    <details className="tool-console">
      <summary>
        <span className="mono">WebMCP</span> {tools.length} tools · {native ? 'API nativa' : 'polyfill'} · {calls.length} llamadas
      </summary>
      <div className="tc-body">
        <div className="tc-tools">
          {tools.map((t) => (
            <button key={t} className="chip mono" type="button" onClick={() => onTry(t)} title="Simular la llamada de un agente">
              {t}()
            </button>
          ))}
        </div>
        <ol className="tc-log">
          {calls.map((c) => (
            <li key={c.id} data-error={c.isError || undefined}>
              <code>
                {c.name}({JSON.stringify(c.args)})
              </code>
              <span className="tc-result">{c.result === undefined ? '…' : `→ ${c.result.slice(0, 140)}${c.result.length > 140 ? '…' : ''}`}</span>
              {c.ms !== undefined && <span className="mono">{Math.round(c.ms)} ms</span>}
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

function useTicker(ms: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export interface LabSettings {
  render: 'fluid' | 'naive';
  verify: boolean;
  engine: ProviderChoice;
  speed: number;
}

export function LabPanel({
  open,
  onClose,
  settings,
  onChange,
  metrics,
  engineLabel,
}: {
  open: boolean;
  onClose: () => void;
  settings: LabSettings;
  onChange: (s: Partial<LabSettings>) => void;
  metrics?: PanelMetrics;
  engineLabel: string;
}) {
  useTicker(300);
  const [apis, setApis] = useState<Record<string, string>>({});
  useEffect(() => {
    BUILTIN_APIS.forEach((a) => availabilityOf(a.id).then((v) => setApis((s) => ({ ...s, [a.id]: v }))));
  }, []);
  const m = metrics;
  const fmt = (ms: number | null | undefined) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)} s`);
  return (
    <aside className="lab" hidden={!open} aria-label="Laboratorio de rendimiento">
      <header>
        <strong>Laboratorio</strong>
        <span className="mono">tecla D</span>
        <button className="btn small ghost" type="button" onClick={onClose} aria-label="Cerrar laboratorio">
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="lab-row">
        <span className="mono">render</span>
        <div className="segmented small" role="radiogroup" aria-label="Render">
          {(['naive', 'fluid'] as const).map((r) => (
            <button key={r} type="button" role="radio" aria-checked={settings.render === r} onClick={() => onChange({ render: r })}>
              {r === 'naive' ? 'v1 ingenuo' : 'v2 fluido'}
            </button>
          ))}
        </div>
      </div>
      <label className="lab-row">
        <span className="mono">verificador</span>
        <input type="checkbox" checked={settings.verify} onChange={(e) => onChange({ verify: e.target.checked })} />
      </label>
      <label className="lab-row">
        <span className="mono">motor</span>
        <select value={settings.engine} onChange={(e) => onChange({ engine: e.target.value as ProviderChoice })}>
          <option value="auto">Auto · local primero</option>
          <option value="nano">Dispositivo · Gemini Nano</option>
          <option value="cloud">Nube · Gemini API</option>
        </select>
      </label>
      {engineLabel.startsWith('Simulado') && (
        <label className="lab-row">
          <span className="mono">{settings.speed} tok/s</span>
          <input type="range" min={10} max={240} step={10} value={settings.speed} onChange={(e) => onChange({ speed: Number(e.target.value) })} />
        </label>
      )}
      <p className="lab-engine mono">{engineLabel}</p>
      <dl className="metrics">
        <Metric label="CLS" value={m ? m.cls.toFixed(3) : '—'} tone={m && m.cls > 0.1 ? 'bad' : m && m.cls > 0.02 ? 'warn' : 'good'} />
        <Metric label="Nodos creados" value={m?.created ?? '—'} />
        <Metric label="Reutilizados" value={m?.reused ?? '—'} />
        <Metric label="Renders" value={m?.renders ?? '—'} />
        <Metric label="1er contenido" value={fmt(m?.firstContentMs)} />
        <Metric label="Total" value={fmt(m?.totalMs)} />
        <Metric label="Long tasks" value={`${globalMetrics.longTasks}`} tone={globalMetrics.longTasks > 3 ? 'bad' : undefined} />
        <Metric label="Bloqueo" value={`${Math.round(globalMetrics.longTaskMs)} ms`} />
      </dl>
      <ul className="lab-apis">
        {BUILTIN_APIS.map((a) => (
          <li key={a.id} data-state={apis[a.id]}>
            <span>{a.label}</span>
            <span className="mono">{apis[a.id] ?? '…'}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="metric" data-tone={tone}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
