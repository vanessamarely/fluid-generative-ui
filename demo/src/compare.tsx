// /compare: UN solo workflow (simulado, determinista) cuyos eventos se reenvían por
// postMessage a dos iframes de Rumbo: v1 ingenua y v2 fluida. Mismo stream, mismos
// tiempos: lo único distinto es CÓMO se renderiza.
import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';
import { runWorkflow } from './trip/workflow';
import type { TripRequest } from './trip/agents';
import { SiteHeader } from './ui/SiteHeader';
import './styles.css';
import './compare.css';

const PRESETS = ['Lo más barato posible en Santo Domingo, historia y comida', 'Playa y naturaleza en Samaná, algo tranquilo', 'Aventura en la montaña: rafting y cascadas en Jarabacoa'];

function Compare() {
  const naive = useRef<HTMLIFrameElement>(null);
  const fluid = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(0);
  const [text, setText] = useState(PRESETS[0]);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(70);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => e.data?.type === 'rumbo-ready' && setReady((n) => n + 1);
    addEventListener('message', onMsg);
    return () => removeEventListener('message', onMsg);
  }, []);

  const go = async (instruction?: string) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setRunning(true);
    const req: TripRequest = { text, people: 2, days: 3, style: 'equilibrado', month: new Date().getMonth() + 1 };
    await runWorkflow({
      req,
      instruction,
      engine: 'mock',
      speed,
      signal: ctrl.signal,
      emit: (event) => {
        for (const f of [naive.current, fluid.current]) f?.contentWindow?.postMessage({ type: 'rumbo-event', event }, location.origin);
      },
    });
    setRunning(false);
  };

  return (
    <div className="compare">
      <SiteHeader current="compare" status="Simulado · mismo stream" />
      <div className="compare-bar" role="toolbar" aria-label="Controles de la comparación">
        <strong>Ingenuo vs fluido</strong>
        <select value={text} onChange={(e) => setText(e.target.value)} aria-label="Viaje">
          {PRESETS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <label className="mono">
          {speed} tok/s <input type="range" min={20} max={200} step={10} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
        </label>
        <button className="hero-cta" type="button" disabled={running || ready < 2} onClick={() => void go()}>
          {running ? 'Generando…' : 'Mismo stream a los dos'}
        </button>
        <button className="btn" type="button" disabled={running} onClick={() => void go('Agrega un día de playa')}>
          Refinar: + día de playa
        </button>
      </div>
      <div className="compare-panes">
        <section>
          <h2>v1 · ingenuo</h2>
          <iframe ref={naive} title="Render ingenuo" src="./?remote&embed&render=naive&lab" />
        </section>
        <section>
          <h2>v2 · fluido</h2>
          <iframe ref={fluid} title="Render fluido" src="./?remote&embed&render=fluid&lab" />
        </section>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Compare />);
