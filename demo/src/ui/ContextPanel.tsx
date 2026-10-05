// Panel contextual con Gemini Nano: sugerencias que cambian EN TIEMPO REAL según lo que
// tocas (un día, un lugar, un hospedaje) o ajustas (personas, estilo). Cada nuevo
// contexto CANCELA la generación anterior (AbortController) y espera 350 ms de calma
// (debounce) antes de pedir otra: así no saturamos el modelo ni la UI.
import { useEffect, useRef, useState } from 'react';
import { promptStream, rewriteStream, summarizeStream, translateStream, type AiResult } from '../builtin/ai';
import { monthName, type ItineraryDoc, type TripRequest } from '../trip/agents';
import { fallbackTips, type Selection } from '../trip/derive';
import { LODGING_BY_ID, PLACE_BY_ID } from '../trip/places';

const SYSTEM = `Eres el asistente de viaje de Rumbo, en el panel lateral. Das 3 sugerencias cortas, concretas y seguras
(viñetas que empiezan con "•"), en español, para el contexto que te paso. Nada de relleno. Si hay riesgos, dilos primero.`;

function describe(sel: Selection, req: TripRequest, it: ItineraryDoc | null): string {
  const base = `Viajeros: ${req.people}. Mes: ${monthName(req.month)}. Estilo: ${req.style}.`;
  if (sel.kind === 'place') {
    const p = PLACE_BY_ID.get(sel.id);
    return `${base} Lugar: ${p?.name} (${p?.kind}, ${p?.hours} h, $${p?.cost}). ${p?.blurb}. ${p?.caution ?? ''}`;
  }
  if (sel.kind === 'lodging') {
    const l = LODGING_BY_ID.get(sel.id);
    return `${base} Hospedaje: ${l?.name} (${l?.style}, ${l?.rating}★, ${l?.verified ? 'verificado' : 'SIN verificar'}, seguridad ${l?.safety}/5).`;
  }
  if (sel.kind === 'day') {
    const d = it?.plan?.[sel.index];
    return `${base} Día ${sel.index + 1}: ${d?.title}. Lugares: ${(d?.placeIds ?? []).map((id) => PLACE_BY_ID.get(id)?.name).join(', ')}.`;
  }
  return `${base} Viaje: ${it?.title ?? req.text}.`;
}

const LABEL = (sel: Selection, it: ItineraryDoc | null) =>
  sel.kind === 'place'
    ? PLACE_BY_ID.get(sel.id)?.name
    : sel.kind === 'lodging'
      ? LODGING_BY_ID.get(sel.id)?.name
      : sel.kind === 'day'
        ? `Día ${sel.index + 1} · ${it?.plan?.[sel.index]?.title ?? ''}`
        : 'Tu viaje';

export function ContextPanel({
  selection,
  req,
  itinerary,
  shareText,
  onPeople,
  onStyle,
  ask,
}: {
  selection: Selection;
  req: TripRequest;
  itinerary: ItineraryDoc | null;
  shareText: string;
  onPeople: (n: number) => void;
  onStyle: (s: TripRequest['style']) => void;
  ask: { question: string; id: number } | null;
}) {
  const [text, setText] = useState('');
  const [native, setNative] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState('');
  const [share, setShare] = useState({ text: '', busy: false, native: null as boolean | null });
  const abort = useRef<AbortController | null>(null);
  const shareAbort = useRef<AbortController | null>(null);

  const consume = async (r: Promise<AiResult>, ctrl: AbortController, set: (t: string) => void) => {
    let acc = '';
    const res = await r;
    setNative(res.native);
    for await (const c of res.stream) {
      if (ctrl.signal.aborted) return;
      acc += c;
      set(acc);
    }
  };

  const run = (input: string, fallback: string) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setText('');
    consume(promptStream(SYSTEM, input, fallback, ctrl.signal), ctrl, setText)
      .catch(() => undefined)
      .finally(() => !ctrl.signal.aborted && setBusy(false));
  };

  // Sugerencias reactivas: cambian con la selección y con personas/estilo.
  const key = JSON.stringify([selection, req.people, req.style, itinerary?.title]);
  useEffect(() => {
    const t = setTimeout(() => run(describe(selection, req, itinerary), fallbackTips(selection, req, itinerary)), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Preguntas que llegan desde una tool WebMCP (ask_travel_assistant).
  useEffect(() => {
    if (ask) run(`${describe(selection, req, itinerary)}\nPregunta: ${ask.question}`, `• Sobre "${ask.question}": ${fallbackTips(selection, req, itinerary).split('\n')[1] ?? ''}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask?.id]);

  const doShare = (kind: 'summary' | 'en' | 'casual') => {
    shareAbort.current?.abort();
    const ctrl = new AbortController();
    shareAbort.current = ctrl;
    setShare({ text: '', busy: true, native: null });
    const lines = shareText.split('\n');
    const r =
      kind === 'summary'
        ? summarizeStream(shareText, `🌴 ${lines[0]}: ${lines.slice(2, -2).map((l) => l.split(':')[1]?.trim()).join(' · ')}. ¿Te apuntas?`, ctrl.signal)
        : kind === 'en'
          ? translateStream(shareText, `(EN) ${shareText.replace(/Día/g, 'Day').replace(/Hospedaje/g, 'Stay').replace(/Presupuesto estimado/g, 'Estimated budget')}`, ctrl.signal)
          : rewriteStream(shareText, 'more-casual', `¡Nos vamos! ${lines[0]} 🙌 ${lines[lines.length - 1]}`, ctrl.signal);
    r.then(async (res) => {
      let acc = '';
      setShare((s) => ({ ...s, native: res.native }));
      for await (const c of res.stream) {
        if (ctrl.signal.aborted) return;
        acc += c;
        setShare((s) => ({ ...s, text: acc }));
      }
    })
      .catch(() => undefined)
      .finally(() => !ctrl.signal.aborted && setShare((s) => ({ ...s, busy: false })));
  };

  return (
    <aside className="context-panel" aria-label="Asistente contextual">
      <header>
        <span className="cp-title">Asistente</span>
        <span className="cp-engine" data-native={native ?? undefined}>
          {native === null ? '…' : native ? 'Gemini Nano · en tu dispositivo' : 'modo simulado'}
        </span>
      </header>

      <p className="cp-context">
        <span className="mono">contexto</span> {LABEL(selection, itinerary)}
      </p>

      {/* Altura mínima fija: el texto en streaming no empuja los controles de abajo. */}
      <div className="cp-output" aria-live="polite" aria-busy={busy}>
        {text || <span className="skeleton-text">Pensando sugerencias…</span>}
      </div>

      <form
        className="cp-ask"
        onSubmit={(e) => {
          e.preventDefault();
          if (!question.trim()) return;
          run(`${describe(selection, req, itinerary)}\nPregunta: ${question}`, `• ${question}: ${fallbackTips(selection, req, itinerary).split('\n')[1] ?? 'te recomiendo consultar con el hospedaje.'}`);
          setQuestion('');
        }}
      >
        <label className="visually-hidden" htmlFor="cp-q">
          Pregúntale al asistente
        </label>
        <input id="cp-q" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="¿Es seguro ir con niños?" />
        <button className="btn small" type="submit">
          Preguntar
        </button>
      </form>

      <div className="cp-prefs">
        <span className="mono">ajustes en vivo</span>
        <div className="stepper" role="group" aria-label="Personas">
          <button type="button" onClick={() => onPeople(Math.max(1, req.people - 1))} aria-label="Menos personas">
            −
          </button>
          <span>{req.people} personas</span>
          <button type="button" onClick={() => onPeople(Math.min(8, req.people + 1))} aria-label="Más personas">
            +
          </button>
        </div>
        <div className="segmented small" role="radiogroup" aria-label="Estilo">
          {(['económico', 'equilibrado', 'premium'] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={req.style === s} onClick={() => onStyle(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="cp-share">
        <span className="mono">compartir · APIs integradas</span>
        <div className="row">
          <button className="btn small ghost" type="button" onClick={() => doShare('summary')}>
            Resumir (Summarizer)
          </button>
          <button className="btn small ghost" type="button" onClick={() => doShare('en')}>
            Inglés (Translator)
          </button>
          <button className="btn small ghost" type="button" onClick={() => doShare('casual')}>
            Tono casual (Rewriter)
          </button>
        </div>
        {(share.text || share.busy) && (
          <div className="cp-share-out" aria-live="polite" aria-busy={share.busy}>
            {share.native === false && <span className="tag">simulado</span>} {share.text}
          </div>
        )}
      </div>
    </aside>
  );
}
