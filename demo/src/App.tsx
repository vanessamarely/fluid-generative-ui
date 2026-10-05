import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { DocStore, type DocState } from './genui/doc-store';
import { globalMetrics, trackPanel } from './genui/metrics';
import { resolveEngine, type ProviderChoice } from './genui/providers';
import type { Intent, ItineraryDoc, LodgingDoc, TripRequest } from './trip/agents';
import { computeBudget, itineraryText, pickLodging, type Selection } from './trip/derive';
import { runWorkflow, type WorkflowEvent } from './trip/workflow';
import type { Check } from './trip/verify';
import { ContextPanel } from './ui/ContextPanel';
import { LabPanel, ToolConsole, type LabSettings } from './ui/DevPanels';
import { TripMap } from './ui/TripMap';
import { DaysList, LodgingList, TripHeader } from './ui/TripFluid';
import { TripNaive, type NaiveState } from './ui/TripNaive';
import { BudgetCard, ChecksPanel, WorkflowGraph, initialNodes, type Nodes } from './ui/Workflow';
import { callTool, registerTripTools } from './webmcp/tools';
import { SiteHeader } from './ui/SiteHeader';

const params = new URLSearchParams(location.search);
const REMOTE = params.has('remote'); // iframe de /compare: recibe los eventos del padre
const EMBED = params.has('embed');

const PRESETS = [
  'Playa y naturaleza en Samaná, algo tranquilo',
  'Aventura en la montaña: rafting y cascadas en Jarabacoa',
  'Lo más barato posible en Santo Domingo, historia y comida',
  'Escapada en familia con niños en Punta Cana',
];

const REFINES = ['Más barato', 'Agrega un día de playa', 'Más aventura', 'Viajo con niños'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const idsOf = (doc: Record<string, unknown> | null) =>
  new Set<string>([
    ...((doc?.plan as { placeIds?: string[] }[] | undefined) ?? []).flatMap((d) => d.placeIds ?? []),
    ...((doc?.options as { lodgingId?: string }[] | undefined) ?? []).map((o) => o.lodgingId ?? ''),
  ]);

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** ¿Algún nodo que YA está en pantalla cambió de lugar? → View Transition. */
function structuralMove(changed: Set<string>, state: DocState): boolean {
  for (const key of changed) {
    const m = key.match(/^(plan|options)\.(\d+)$/);
    if (!m) continue;
    const item = state.lists[m[1]]?.[Number(m[2])];
    if (!item?.complete) continue;
    if (m[1] === 'plan') {
      for (const id of (item.value.placeIds as string[]) ?? []) {
        const day = document.querySelector(`[data-place="${CSS.escape(id)}"]`)?.closest<HTMLElement>('[data-day]')?.dataset.day;
        if (day !== undefined && day !== m[2]) return true;
      }
    } else {
      const slot = document.querySelector(`[data-lodging="${CSS.escape(String(item.value.lodgingId))}"]`)?.closest<HTMLElement>('[data-index]')?.dataset.index;
      if (slot !== undefined && slot !== m[2]) return true;
    }
  }
  return changed.has('status') && state.status === 'done';
}

export function App() {
  const itStore = useMemo(() => new DocStore('itinerary'), []);
  const loStore = useMemo(() => new DocStore('lodging'), []);
  const [req, setReq] = useState<TripRequest>({
    text: params.get('q') ?? PRESETS[0],
    people: 2,
    days: 3,
    style: 'equilibrado',
    month: new Date().getMonth() + 1,
  });
  const [lab, setLab] = useState<LabSettings>({
    render: params.get('render') === 'naive' ? 'naive' : 'fluid',
    verify: params.get('verify') !== '0',
    engine: (params.get('engine') as ProviderChoice) || 'auto',
    speed: Number(params.get('speed')) || 70,
  });
  const [labOpen, setLabOpen] = useState(params.has('lab'));
  const [nodes, setNodes] = useState<Nodes>(initialNodes);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [checks, setChecks] = useState<{ list: Check[]; round: number }>({ list: [], round: 0 });
  const [docs, setDocs] = useState<{ itinerary: ItineraryDoc | null; lodging: LodgingDoc | null }>({ itinerary: null, lodging: null });
  const [naive, setNaive] = useState<NaiveState>({ itinerary: '', lodging: '', order: [], busy: { itinerary: false, lodging: false } });
  const [running, setRunning] = useState(false);
  const [hasTrip, setHasTrip] = useState(false);
  const [engineLabel, setEngineLabel] = useState('');
  const [selection, setSelection] = useState<Selection>({ kind: 'trip' });
  const [chosen, setChosen] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ question: string; id: number } | null>(null);
  const [confirmBox, setConfirmBox] = useState<{ message: string; resolve: (ok: boolean) => void } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const doneRef = useRef<(() => void) | null>(null);

  // ── Métricas reales del área de resultados ──────────────────────────
  const resultsRef = useRef<HTMLDivElement>(null);
  const tracker = useRef<ReturnType<typeof trackPanel> | null>(null);
  useEffect(() => {
    if (hasTrip && resultsRef.current && !tracker.current) tracker.current = trackPanel(resultsRef.current);
  }, [hasTrip]);

  // Los cambios estructurales se aplican dentro de una View Transition.
  useEffect(() => {
    for (const store of [itStore, loStore]) {
      store.wrapFlush = (run, changed, state) => {
        if (document.startViewTransition && !reduced() && structuralMove(changed, state)) {
          const vt = document.startViewTransition(() => flushSync(run));
          // Si llega otra transición, la anterior se salta: no es un error.
          vt.ready.catch(() => undefined);
          vt.finished.catch(() => undefined);
        } else run();
      };
    }
  }, [itStore, loStore]);

  // ── Aplicar eventos del workflow (locales o recibidos de /compare) ──
  const renderRef = useRef(lab.render);
  renderRef.current = lab.render;
  const firstPaint = useRef<number | null>(null);

  const apply = useCallback(
    (e: WorkflowEvent) => {
      const store = 'agent' in e ? (e.agent === 'itinerary' ? itStore : loStore) : null;
      switch (e.t) {
        case 'start':
          setRunning(true);
          setHasTrip(true);
          setNodes(initialNodes());
          setChecks({ list: [], round: 0 });
          if (!e.instruction) setIntent(null);
          loStore.wait();
          firstPaint.current = null;
          tracker.current?.reset();
          globalMetrics.longTasks = 0;
          globalMetrics.longTaskMs = 0;
          setNaive((n) => ({ ...n, order: e.instruction ? n.order : [], busy: { itinerary: true, lodging: true } }));
          break;
        case 'node':
          setNodes((n) => ({ ...n, [e.id]: { status: e.status, note: e.note } }));
          break;
        case 'intent':
          setIntent(e.intent);
          break;
        case 'begin':
          store!.begin();
          setNaive((n) => ({ ...n, [e.agent]: '', order: n.order.includes(e.agent) ? n.order : [...n.order, e.agent] }));
          break;
        case 'chunk':
          store!.chunk(e.delta);
          if (tracker.current && firstPaint.current === null) {
            firstPaint.current = performance.now();
            tracker.current.metrics.firstContentMs = firstPaint.current - (store!.state.startedAt || firstPaint.current);
          }
          // Ingenuo: un setState por token (y re-render de todo).
          if (renderRef.current === 'naive') setNaive((n) => ({ ...n, [e.agent]: n[e.agent] + e.delta }));
          break;
        case 'end': {
          store!.end(e.status);
          const doc = store!.committed();
          // Reutilización: con claves por id, cada lugar/hospedaje que sigue tras refinar es el MISMO nodo DOM.
          if (tracker.current && renderRef.current === 'fluid') {
            const before = idsOf(store!.state.previous);
            tracker.current.metrics.reused += [...idsOf(doc)].filter((id) => before.has(id)).length;
          }
          setDocs((d) => ({ ...d, [e.agent]: doc }));
          setNaive((n) => ({ ...n, busy: { ...n.busy, [e.agent]: false } }));
          break;
        }
        case 'checks':
          // En la segunda vuelta conservamos lo que se corrigió: es la historia que queremos mostrar.
          setChecks((prev) => ({
            round: e.round,
            list:
              e.round > 0
                ? [...prev.list.filter((c) => c.level === 'block').map((c) => ({ ...c, level: 'fixed' as const, id: `fixed-${c.id}` })), ...e.checks]
                : e.checks,
          }));
          break;
        case 'done':
          setRunning(false);
          if (tracker.current) tracker.current.metrics.totalMs = e.ms;
          doneRef.current?.();
          doneRef.current = null;
          break;
      }
    },
    [itStore, loStore],
  );

  // Ingenuo: contamos cada re-render completo del HTML.
  const onNaiveRender = useCallback(() => {
    if (tracker.current) tracker.current.metrics.renders++;
  }, []);
  // Fluido: contamos los flush del store (un render por frame como máximo).
  useEffect(() => {
    const count = () => {
      if (renderRef.current === 'fluid' && tracker.current) tracker.current.metrics.renders++;
    };
    const a = itStore.subscribe(count);
    const b = loStore.subscribe(count);
    return () => (a(), b());
  }, [itStore, loStore]);

  // ── Ejecutar el workflow ────────────────────────────────────────────
  const reqRef = useRef(req);
  reqRef.current = req;
  const docsRef = useRef(docs);
  docsRef.current = docs;
  const intentRef = useRef(intent);
  intentRef.current = intent;

  const run = useCallback(
    async (instruction?: string, override?: Partial<TripRequest>): Promise<void> => {
      if (REMOTE) return;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const r = { ...reqRef.current, ...override };
      if (override) setReq(r);
      if (!instruction) setChosen(null);
      const engine = await resolveEngine(lab.engine);
      setEngineLabel({ nano: 'Gemini Nano · en tu dispositivo', hybrid: 'Firebase AI Logic · híbrido', cloud: 'Gemini en la nube', mock: 'Simulado · sin red' }[engine]);
      const finished = new Promise<void>((res) => (doneRef.current = res));
      await runWorkflow({
        req: r,
        instruction,
        engine,
        speed: lab.speed,
        verify: lab.verify,
        current: { intent: intentRef.current, ...docsRef.current },
        signal: ctrl.signal,
        emit: apply,
      });
      await finished;
    },
    [lab.engine, lab.speed, lab.verify, apply],
  );

  // /compare: el padre manda los eventos; nosotros solo los aplicamos.
  useEffect(() => {
    if (!REMOTE) return;
    const onMsg = (ev: MessageEvent) => {
      if (ev.origin === location.origin && ev.data?.type === 'rumbo-event') apply(ev.data.event as WorkflowEvent);
    };
    addEventListener('message', onMsg);
    parent.postMessage({ type: 'rumbo-ready', render: lab.render }, location.origin);
    return () => removeEventListener('message', onMsg);
  }, [apply, lab.render]);

  // ── Estado derivado (lo calcula el código, no la IA) ────────────────
  const blocked = useMemo(() => new Set(checks.list.filter((c) => c.level === 'block' && c.exclude).map((c) => c.exclude!)), [checks]);
  const lodging = useMemo(() => pickLodging(docs.lodging, chosen, blocked), [docs.lodging, chosen, blocked]);
  const budget = useMemo(() => computeBudget(req, docs.itinerary, lodging), [req, docs.itinerary, lodging]);
  const shareText = useMemo(() => itineraryText(req, docs.itinerary, lodging), [req, docs.itinerary, lodging]);

  // ── WebMCP: la web expone sus capacidades a agentes del navegador ───
  const live = useRef({ run, shareText, setReq, setChosen, docs });
  live.current = { run, shareText, setReq, setChosen, docs };
  useEffect(() => {
    if (REMOTE) return;
    registerTripTools({
      async plan(a) {
        await live.current.run(undefined, {
          text: a.request,
          ...(a.days ? { days: a.days } : {}),
          ...(a.people ? { people: a.people } : {}),
          ...(a.style ? { style: a.style as TripRequest['style'] } : {}),
          ...(a.month ? { month: a.month } : {}),
        });
        return live.current.shareText;
      },
      async refine(instruction) {
        await live.current.run(instruction);
        return live.current.shareText;
      },
      itineraryText: () => live.current.shareText,
      async selectLodging(id) {
        const ids = (live.current.docs.lodging?.options ?? []).map((o) => o.lodgingId);
        if (!ids.includes(id)) throw new Error(`"${id}" no está entre las opciones: ${ids.join(', ')}`);
        live.current.setChosen(id);
        return `Hospedaje ${id} seleccionado.`;
      },
      setPeople(n) {
        live.current.setReq((r) => ({ ...r, people: n }));
        return `Ahora son ${n} personas; presupuesto recalculado.`;
      },
      async ask(question) {
        setAsk({ question, id: Date.now() });
        return 'Respondiendo en el panel del asistente.';
      },
      confirm: (message) => new Promise((resolve) => setConfirmBox({ message, resolve })),
    });
  }, []);

  // Atajo: D abre el laboratorio.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'd' || e.key === 'D') setLabOpen((o) => !o);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const onPick = useCallback((id: string, day: number) => setSelection({ kind: 'place', id, day }), []);

  const tryTool = (name: string) => {
    const examples: Record<string, Record<string, unknown>> = {
      plan_trip: { request: 'Playa barata en Santo Domingo', days: 3, people: 2, style: 'económico' },
      refine_trip: { instruction: 'Agrega un día de playa' },
      get_itinerary: {},
      select_lodging: { lodging_id: docs.lodging?.options?.[0]?.lodgingId ?? 'sm-eco' },
      set_travelers: { people: 4 },
      ask_travel_assistant: { question: '¿Qué llevo en la mochila?' },
    };
    void callTool(name, examples[name] ?? {});
  };

  return (
    <div className="rumbo" data-render={lab.render} data-embed={EMBED || undefined}>
      {!EMBED && (
        <SiteHeader current="app" status={engineLabel} onLab={() => setLabOpen(true)} />
      )}

      <main>
        {!REMOTE && (
          <section className="hero">
            <div className="hero-copy">
              <span className="eyebrow">Escapadas por República Dominicana · planificadas por agentes de IA</span>
              <h1 className="hero-title">¿A dónde te escapas?</h1>
              <form
                className="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run();
                }}
              >
                <label className="visually-hidden" htmlFor="q">
                  Describe tu viaje
                </label>
                <textarea id="q" rows={2} value={req.text} onChange={(e) => setReq({ ...req, text: e.target.value })} />
                <div className="chips" role="group" aria-label="Ideas">
                  {PRESETS.map((p) => (
                    <button key={p} type="button" className="chip" aria-pressed={p === req.text} onClick={() => setReq({ ...req, text: p })}>
                      {p}
                    </button>
                  ))}
                </div>
                <div className="search-row">
                  <label>
                    <span>Días</span>
                    <select value={req.days} onChange={(e) => setReq({ ...req, days: Number(e.target.value) })}>
                      {[2, 3, 4, 5].map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Personas</span>
                    <select value={req.people} onChange={(e) => setReq({ ...req, people: Number(e.target.value) })}>
                      {[1, 2, 3, 4, 5, 6].map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Mes</span>
                    <select value={req.month} onChange={(e) => setReq({ ...req, month: Number(e.target.value) })}>
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Estilo</span>
                    <select value={req.style} onChange={(e) => setReq({ ...req, style: e.target.value as TripRequest['style'] })}>
                      <option>económico</option>
                      <option>equilibrado</option>
                      <option>premium</option>
                    </select>
                  </label>
                  <button className="hero-cta" type="submit" disabled={running}>
                    {running ? 'Planificando…' : 'Planificar con IA'}
                  </button>
                  {running && (
                    <button className="btn ghost" type="button" onClick={() => abortRef.current?.abort()}>
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>
          </section>
        )}

        {(hasTrip || REMOTE) && <WorkflowGraph nodes={nodes} verifyEnabled={lab.verify} />}

        {hasTrip && !REMOTE && (
          <div className="refine" role="group" aria-label="Ajustar el viaje">
            <span className="mono">ajustar sin empezar de cero:</span>
            {REFINES.map((r) => (
              <button key={r} className="chip" type="button" disabled={running} onClick={() => void run(r)}>
                {r}
              </button>
            ))}
          </div>
        )}

        <section className="trip-layout" hidden={!hasTrip && !REMOTE}>
          <div className="trip-main" ref={resultsRef}>
            {lab.render === 'fluid' ? (
              <>
                <TripHeader store={itStore} intent={intent} />
                <div className="map-days">
                  <TripMap store={itStore} intent={intent} onPick={onPick} />
                  <DaysList store={itStore} req={req} checks={checks.list} selection={selection} onSelect={setSelection} />
                </div>
                <h2 className="section-title">Dónde dormir</h2>
                <LodgingList store={loStore} checks={checks.list} chosen={lodging?.id ?? null} onSelect={setSelection} onChoose={setChosen} />
              </>
            ) : (
              <TripNaive state={naive} onRender={onNaiveRender} />
            )}
            <div className="trip-bottom">
              <ChecksPanel checks={checks.list} round={checks.round} />
              <BudgetCard budget={budget} people={req.people} />
            </div>
          </div>
          {!EMBED && (
            <ContextPanel
              selection={selection}
              req={req}
              itinerary={docs.itinerary}
              shareText={shareText}
              onPeople={(people) => setReq((r) => ({ ...r, people }))}
              onStyle={(style) => setReq((r) => ({ ...r, style }))}
              ask={ask}
            />
          )}
        </section>

        {!hasTrip && !REMOTE && (
          <section className="how" id="como-funciona">
            <h2>Cómo funciona</h2>
            <ol>
              <li>
                <strong>Intención</strong> Gemini Nano entiende tu pedido en tu dispositivo.
              </li>
              <li>
                <strong>Itinerario ∥ Hospedaje</strong> dos agentes trabajan en paralelo y la página se arma mientras escriben.
              </li>
              <li>
                <strong>Verificador</strong> reglas de seguridad, precio y temporada. Si algo falla, el agente corrige.
              </li>
              <li>
                <strong>Tú decides</strong> con un asistente contextual y un presupuesto calculado al centavo.
              </li>
            </ol>
          </section>
        )}
      </main>

      {!EMBED && <ToolConsole onTry={tryTool} />}
      <LabPanel open={labOpen} onClose={() => setLabOpen(false)} settings={lab} onChange={(s) => setLab((l) => ({ ...l, ...s }))} metrics={tracker.current?.metrics} engineLabel={engineLabel} />

      {confirmBox && (
        <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-msg">
          <div className="confirm-box">
            <p id="confirm-msg">{confirmBox.message}</p>
            <div className="row">
              <button
                className="btn"
                type="button"
                onClick={() => {
                  confirmBox.resolve(false);
                  setConfirmBox(null);
                }}
              >
                Rechazar
              </button>
              <button
                className="btn primary"
                type="button"
                autoFocus
                onClick={() => {
                  confirmBox.resolve(true);
                  setConfirmBox(null);
                }}
              >
                Permitir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
