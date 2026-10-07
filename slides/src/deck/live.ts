// Lado "deck" de la experiencia en vivo.
//  · La presentadora publica el slide actual → los celulares cambian de pantalla.
//  · El deck es el ÚNICO que escucha las colecciones (votos, likes, jugadores, cards)
//    y publica agregados (resultados, podio) en momentos puntuales: así cientos de
//    celulares solo leen un documento y Firestore se mantiene en el plan gratuito.
//  · Las listas (lobby, muro) se actualizan por CLAVE: se agregan nodos, no se recrea nada.
import QRCode from 'qrcode';
import { createElement, Brain, Check, Circle, Diamond, Flame, Hand, Heart, Laugh, Lightbulb, MessageCircleQuestion, Rocket, Square, Triangle, X, type IconNode } from 'lucide';
import { cardHTML, winnerCode } from '../shared/card';
import { REPO_URL, SESSION_ID, SESSION_PARAM } from '../shared/config';
import { getStarCount } from '../shared/github';
import { createAnswerer, geminiKey, qaEngine, setGeminiKey } from './qa-ai';
import { QUESTIONS, REACTION_META, parseAnswerKey, type AnswerKey, type QuestionId, type Reaction } from '../shared/questions';
import { getRealtime, scoreFor, tally, type AudienceQuestion, type CardData, type QaItem, type SlideDigest, type LiveKind, type Player, type SlideState, type VoteRecord } from '../shared/realtime';

const SHAPES: IconNode[] = [Triangle, Diamond, Circle, Square];
const REACTION_ICONS: Record<Reaction, IconNode> = { fire: Flame, heart: Heart, laugh: Laugh, ask: MessageCircleQuestion, clap: Hand, mind: Brain, idea: Lightbulb, rocket: Rocket };

// Espejo para los celulares: el TEXTO del slide (no una captura). Pesa ~1 KB y se lee igual en
// cualquier pantalla; los celulares ya escuchan este documento, así que no cuesta lecturas extra.
const clean = (el: Element | null | undefined, max = 160) => el?.textContent?.replace(/\s+/g, ' ').trim().slice(0, max) || undefined;
const toneOf = (el: Element) => ['blue', 'green', 'yellow', 'red'].find((c) => el.classList.contains(c));
function digestOf(s: HTMLElement): SlideDigest {
  const points: SlideDigest['points'] = [];
  const push = (h?: string, p?: string, tone?: string) => {
    if ((h || p) && points.length < 6) points.push({ h, p, tone });
  };
  s.querySelectorAll('.box').forEach((b) => push(clean(b.querySelector('h3')), clean(b.querySelector('p')), toneOf(b)));
  if (!points.length) s.querySelectorAll('.node').forEach((n) => push(clean(n.querySelector('.v')) ?? clean(n.querySelector('.k1')), clean(n.querySelector('.d')), toneOf(n)));
  if (!points.length)
    s.querySelectorAll('.comic .panel').forEach((p) => push(clean(p.querySelector('.cap')), [...p.querySelectorAll('.bubble')].map((b) => clean(b)).join(' · ')));
  if (!points.length) s.querySelectorAll('.vs-numbers > div:not(.vs)').forEach((d) => push(clean(d.querySelector('.n')), clean(d.querySelector('.label'))));
  if (!points.length) s.querySelectorAll('li, .socials .pill').forEach((li) => push(undefined, clean(li)));
  const pre = s.querySelector('.code pre');
  const code = pre?.textContent ? { file: clean(s.querySelector('.code .bar span')), text: pre.textContent.split('\n').slice(0, 14).join('\n').slice(0, 700) } : undefined;
  const digest: SlideDigest = {
    eyebrow: clean(s.querySelector('.eyebrow, .section-num'))?.replace(/^\/\/\s*/, ''),
    lede: clean(s.querySelector('.lead, .sub, .statement p, .comic-note, .cover-sub'), 240),
    points,
    code,
  };
  return JSON.parse(JSON.stringify(digest)); // Firestore no acepta campos undefined
}

function icon(node: IconNode, size = 28, color?: string): SVGElement {
  const el = createElement(node);
  el.setAttribute('width', String(size));
  el.setAttribute('height', String(size));
  el.setAttribute('aria-hidden', 'true');
  if (color) el.setAttribute('color', color);
  return el;
}

export async function initLive(stage: HTMLElement, sections: HTMLElement[]) {
  // QR (no dependen de la conexión)
  const live = new URL('/live/', location.origin);
  if (SESSION_PARAM) live.searchParams.set('session', SESSION_PARAM);
  if (new URLSearchParams(location.search).has('local')) live.searchParams.set('local', '');
  const liveUrl = live.toString();
  const qr = (text: string) => QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1e1e1e', light: '#ffffff' } });
  const [qrLive, qrRepo] = await Promise.all([qr(liveUrl), qr(REPO_URL)]);
  document.querySelectorAll('[data-qr="live"]').forEach((el) => (el.innerHTML = qrLive));
  document.querySelectorAll('[data-qr="repo"]').forEach((el) => (el.innerHTML = qrRepo));
  document.querySelectorAll('[data-live-url]').forEach((el) => (el.textContent = liveUrl.replace(/^https?:\/\//, '')));
  buildPolls();

  const rt = await getRealtime();
  const presenterLink = new URLSearchParams(location.search).has('presenter');
  // Solo la presentadora autenticada (o ?presenter en ensayo local) controla el deck en vivo.
  let presenter = rt.isPresenterSession();
  let answers: AnswerKey = {};
  let questions: AudienceQuestion[] = [];
  let unsubQuestions: (() => void) | null = null;
  let qaError = '';
  const onQuestions = (qs: AudienceQuestion[]) => {
    questions = qs;
    qaError = '';
    syncPresenterUi();
    renderQuestions();
    queueAnswers();
    publishQa();
  };

  // ── La IA responde (solo en el navegador de la presentadora) ──────────
  // Grounding: el contexto son las ideas clave de los slides; la respuesta debe citar uno.
  const answerer = createAnswerer(sections.filter((s) => s.dataset.tip).map((s) => ({ label: s.dataset.label ?? '', text: s.dataset.tip! })));
  const inFlight = new Set<string>();
  let chain = Promise.resolve();
  function answerOne(q: AudienceQuestion) {
    if (inFlight.has(q.id)) return;
    inFlight.add(q.id);
    renderQuestions();
    // En serie: Nano atiende una pregunta a la vez y el deck sigue fluido.
    chain = chain.then(async () => {
      try {
        const a = await answerer(q.text);
        await rt.updateQuestion(
          q.id,
          a.appropriate
            ? { status: 'answered', answer: a.answer, ref: a.slide, confidence: a.confidence, engine: a.engine, show: true }
            : { status: 'blocked', answer: '', engine: a.engine, show: false },
        );
      } catch (err) {
        console.warn('[qa] sin respuesta', err);
        await rt.updateQuestion(q.id, { status: 'error', show: false }).catch(() => undefined);
      } finally {
        inFlight.delete(q.id);
        renderQuestions();
      }
    });
  }
  function queueAnswers() {
    if (!presenter) return;
    for (const q of questions) if (!q.status) answerOne(q);
  }
  let lastQa = '';
  let qaTimer = 0;
  function publishQa() {
    if (!presenter) return;
    clearTimeout(qaTimer);
    qaTimer = window.setTimeout(() => {
      const qa: QaItem[] = questions
        .filter((q) => q.status === 'answered' && q.show && q.answer)
        .slice(0, 24)
        .map((q) => ({ q: q.text, a: q.answer!, name: q.name || 'Anónimo', ref: q.ref ?? '', engine: q.engine === 'cloud' ? 'Gemini API' : 'Gemini Nano' }));
      const json = JSON.stringify(qa);
      if (json === lastQa) return;
      lastQa = json;
      void send(rt.patchSlide({ qa }));
    }, 600);
  }
  document.addEventListener('deck:gemini-key', () => {
    const k = prompt('Key de Google AI Studio SOLO para responder preguntas si este equipo no tiene Gemini Nano.\nSe guarda en este navegador (no en el repo). Déjala vacía para borrarla.', geminiKey());
    if (k !== null) setGeminiKey(k.trim());
    void qaEngine().then((e) => alert(`Motor para Q&A: ${e === 'nano' ? 'Gemini Nano (local)' : e === 'cloud' ? 'Gemini API (key de este navegador)' : 'ninguno disponible'}`));
  });
  const badge = document.querySelector<HTMLElement>('.presenter-badge')!;
  // Aviso visible si abriste el enlace de presentadora pero el deck NO está transmitiendo.
  const warn = document.createElement('button');
  warn.type = 'button';
  warn.className = 'broadcast-warn';
  warn.hidden = true;
  warn.addEventListener('click', () => document.dispatchEvent(new CustomEvent('deck:present')));
  document.body.append(warn);
  let broadcastError = '';
  const send = (p: Promise<void>) =>
    p.then(
      () => {
        if (broadcastError) {
          broadcastError = '';
          syncPresenterUi();
        }
      },
      (err: { code?: string; message?: string }) => {
        console.error('[live] no se pudo publicar', err);
        broadcastError = err?.code === 'permission-denied' ? 'Firestore rechazó la escritura (¿cuenta de GitHub correcta?)' : 'Sin conexión con Firestore';
        syncPresenterUi();
      },
    );
  const syncPresenterUi = () => {
    badge.hidden = !presenter;
    const notLive = rt.mode === 'firebase' && presenterLink && !presenter;
    warn.hidden = !notLive && !broadcastError;
    warn.textContent = broadcastError
      ? `Los celulares no se están actualizando: ${broadcastError}. Toca para reintentar.`
      : 'Los celulares NO siguen el deck todavía · Toca aquí para Presentar en vivo (GitHub)';
    badge.textContent = (rt.mode === 'local' ? '● EN VIVO · ensayo local' : '● EN VIVO') + (questions.length ? ` · ${questions.length} ${questions.length === 1 ? 'pregunta' : 'preguntas'}` : '');
    document.querySelectorAll<HTMLElement>('[data-q-count]').forEach((el) => (el.textContent = String(questions.length)));
    if (presenter && !unsubQuestions) unsubQuestions = rt.onQuestions(onQuestions, (msg) => {
      qaError = msg;
      renderQuestions();
    });
    // Revelar y moderar SOLO existen para la presentadora: el público no ve el botón.
    document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((b) => (b.hidden = !presenter));
    document.querySelectorAll<HTMLElement>('[data-presenter-ui]').forEach((el) => (el.hidden = !presenter));
    document.querySelectorAll<HTMLElement>('[data-presenter-only]').forEach((el) => {
      el.hidden = rt.mode !== 'firebase' || !presenterLink || presenter;
    });
    const missing = (['q1', 'q2', 'q3'] as QuestionId[]).filter((q) => !answers[q]);
    document.querySelectorAll<HTMLElement>('[data-answers-status]').forEach((el) => (el.textContent = missing.length ? `faltan ${missing.join(', ')}` : '3/3 cargadas'));
  };
  const loadAnswers = async () => {
    if (!presenter) return;
    answers = (await rt.loadAnswers().catch(() => null)) ?? {};
    syncPresenterUi();
  };
  syncPresenterUi();
  void loadAnswers();
  document.querySelectorAll<HTMLElement>('[data-local-only]').forEach((el) => {
    el.hidden = rt.mode !== 'local' || !presenterLink;
  });
  document.addEventListener('deck:reset', () => {
    if (rt.mode !== 'local' || !confirm('¿Borrar votos, jugadores y cards de la sesión local de ensayo?')) return;
    localStorage.removeItem('fgui.local.db');
    location.reload();
  });
  // Antes de la charla (o después de ensayar en la sesión real): dejarla en cero.
  document.addEventListener('deck:wipe', async () => {
    if (!presenter) return;
    const typed = prompt(
      `Vas a BORRAR jugadores, votos, likes, cards, preguntas, apodos y reacciones de la sesión "${SESSION_ID}".\n` +
        `Las respuestas correctas cargadas se conservan. Si quieres guardar las preguntas, descárgalas antes desde el panel Q.\n\n` +
        `Escribe VACIAR para confirmar:`,
    );
    if (typed?.trim().toUpperCase() !== 'VACIAR') return;
    try {
      const n = await rt.resetSession();
      lastQa = '';
      publishSlide();
      alert(`Sesión "${SESSION_ID}" vacía (${n} documentos borrados). Lista para empezar.`);
    } catch (err) {
      console.error(err);
      alert('No se pudo vaciar la sesión. ¿Iniciaste sesión con GitHub (Presentar en vivo)?');
    }
  });
  document.addEventListener('deck:present', async () => {
    try {
      await rt.signInPresenter();
      presenter = rt.isPresenterSession();
      if (!presenter) {
        alert('Esta cuenta de GitHub no está autorizada como presentadora.');
        syncPresenterUi();
        return;
      }
      await loadAnswers();
      syncPresenterUi();
      publishSlide();
    } catch (err) {
      console.error(err);
      alert('No se pudo iniciar sesión. Revisa que GitHub esté habilitado en Firebase Authentication y que este dominio esté autorizado.');
    }
  });

  // ── Preguntas del público: solo la presentadora las ve (tecla Q o menú) ──
  const qaPanel = document.createElement('aside');
  qaPanel.className = 'qa-panel';
  qaPanel.hidden = true;
  qaPanel.setAttribute('aria-label', 'Preguntas del público');
  qaPanel.innerHTML = `<header><h2>Preguntas del público <small>respuestas con IA</small></h2><button type="button" class="qa-download">Descargar .md</button><button type="button" class="qa-close" aria-label="Cerrar"></button></header><ol class="qa-list"></ol><p class="qa-empty">Aún no hay preguntas. Llegan desde el botón <b>Pregunta</b> del celular y Gemini Nano las responde aquí.</p>`;
  qaPanel.querySelector('.qa-close')!.append(icon(X, 20));
  document.body.append(qaPanel);
  const toggleQa = (open = qaPanel.hidden) => {
    if (!presenter) return;
    qaPanel.hidden = !open;
    if (open) renderQuestions();
  };
  qaPanel.querySelector('.qa-close')!.addEventListener('click', () => toggleQa(false));
  // Para quedarte con las preguntas después de la charla (o antes de vaciar la sesión).
  qaPanel.querySelector('.qa-download')!.addEventListener('click', () => {
    const md = [`# Preguntas del público · ${SESSION_ID}`, '', `Exportadas: ${new Date().toLocaleString('es-DO')}`, ''];
    questions.forEach((q, i) => {
      md.push(`## ${i + 1}. ${q.text}`, '', `*${q.name || 'Anónimo'} · slide: ${q.slide}*`, '');
      if (q.status === 'answered') md.push(q.answer ?? '', '', `> ${q.engine === 'cloud' ? 'Gemini API' : 'Gemini Nano'} · confianza ${q.confidence} · slide citado: ${q.ref}${q.show ? '' : ' · (oculta en pantalla)'}`, '');
      else md.push(`_(sin respuesta: ${q.status ?? 'en cola'})_`, '');
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([md.join('\n')], { type: 'text/markdown' }));
    a.download = `preguntas-${SESSION_ID}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  document.addEventListener('deck:questions', () => toggleQa());
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'q') toggleQa();
  });
  document.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-open-qa], [data-go-qa]');
    if (!t) return;
    if (t.hasAttribute('data-open-qa')) toggleQa(true);
    else (stage as HTMLElement & { goTo(i: number): void }).goTo(sections.findIndex((s) => s.dataset.live === 'qa'));
  });
  function renderQaSummary() {
    const answered = questions.filter((q) => q.status === 'answered').length;
    const shown = questions.filter((q) => q.status === 'answered' && q.show).length;
    const pending = questions.filter((q) => !q.status || inFlight.has(q.id)).length;
    const failed = questions.filter((q) => q.status === 'error').length;
    document.querySelectorAll<HTMLElement>('[data-qa-summary]').forEach((el) => {
      el.textContent = `${questions.length} recibidas · ${answered} respondidas por IA · ${shown} en pantalla${pending ? ` · ${pending} en cola` : ''}${failed ? ` · ${failed} sin IA` : ''}`;
    });
  }
  function renderQuestions() {
    renderQaSummary();
    if (qaPanel.hidden) return;
    const list = qaPanel.querySelector('.qa-list')!;
    const empty = qaPanel.querySelector('.qa-empty') as HTMLElement;
    empty.hidden = questions.length > 0 && !qaError;
    empty.textContent = qaError || 'Aún no hay preguntas. Llegan desde el botón «Pregunta» del celular y Gemini Nano las responde aquí.';
    empty.classList.toggle('error', Boolean(qaError));
    // Por clave: solo se agregan o quitan las que cambian.
    const ids = new Set(questions.map((q) => q.id));
    list.querySelectorAll<HTMLElement>('[data-id]').forEach((li) => !ids.has(li.dataset.id!) && li.remove());
    for (const q of questions) {
      const working = inFlight.has(q.id);
      const sig = `${q.status}|${q.show}|${working}|${q.answer?.length ?? 0}`;
      let li = list.querySelector<HTMLElement>(`[data-id="${CSS.escape(q.id)}"]`);
      if (li?.dataset.sig === sig) continue; // por clave: solo se toca lo que cambió
      if (!li) {
        li = document.createElement('li');
        li.dataset.id = q.id;
        list.append(li);
      }
      li.dataset.sig = sig;
      li.replaceChildren();
      const text = document.createElement('p');
      text.textContent = q.text;
      const meta = document.createElement('small');
      meta.textContent = `${q.name || 'Anónimo'} · ${q.slide}`;
      const ans = document.createElement('div');
      ans.className = 'qa-answer';
      ans.dataset.status = working ? 'working' : (q.status ?? 'pending');
      ans.textContent = working
        ? 'La IA está respondiendo…'
        : q.status === 'answered'
          ? q.answer!
          : q.status === 'blocked'
            ? 'La IA la marcó como no apropiada: no se mostrará.'
            : q.status === 'error'
              ? 'Sin respuesta: no hay Gemini Nano en este equipo (o falló). Menú → Key de Gemini, y luego Regenerar.'
              : 'En cola…';
      if (q.status === 'answered') {
        const src = document.createElement('small');
        src.textContent = `${q.engine === 'cloud' ? 'Gemini API' : 'Gemini Nano'} · confianza ${q.confidence} · slide: ${q.ref}`;
        ans.append(src);
      }
      const actions = document.createElement('div');
      actions.className = 'qa-actions';
      const btn = (label: string, fn: () => void) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.addEventListener('click', fn);
        actions.append(b);
      };
      if (q.status === 'answered') btn(q.show ? 'Ocultar del slide' : 'Mostrar en el slide', () => void rt.updateQuestion(q.id, { show: !q.show }));
      if (!working) btn('Regenerar', () => answerOne(q));
      btn('Borrar', () => void rt.removeQuestion(q.id));
      li.append(text, meta, ans, actions);
    }
  }

  // Cargar respuestas desde un answers.json LOCAL (no está en el repo ni en el bundle).
  document.addEventListener('deck:answers', () => {
    if (!presenter) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      try {
        const parsed = parseAnswerKey(JSON.parse(await input.files![0].text()));
        await rt.saveAnswers(parsed);
        answers = parsed;
        syncPresenterUi();
        alert(`Respuestas guardadas en privado: ${Object.keys(parsed).join(', ')}`);
      } catch (err) {
        alert(`No pude leer el archivo: ${(err as Error).message}`);
      }
    });
    input.click();
  });

  // ── Estado agregado (solo el deck lo escucha) ──────────────────────
  let slide: SlideState | null = null;
  let players: Player[] = [];
  let likes = new Set<string>();
  let votes: VoteRecord[] = [];
  let cards: CardData[] = [];
  let index = Math.max(0, sections.findIndex((s) => s.hasAttribute('data-deck-active')));

  const active = () => sections[index];
  const kindOf = (s: HTMLElement) => (s.dataset.live as LiveKind | undefined) ?? 'content';

  function publishSlide() {
    if (!presenter) return;
    const s = active();
    const kind = kindOf(s);
    const qid = (s.dataset.q as QuestionId | undefined) ?? null;
    void send(rt.patchSlide({
      index,
      total: sections.length,
      label: s.dataset.label ?? '',
      title: s.querySelector('h1, h2')?.textContent?.trim().replace(/\s+/g, ' ') ?? '',
      kind,
      qid,
      tip: s.dataset.tip ?? null,
      digest: kind === 'content' || kind === 'demo' ? digestOf(s) : null,
      duration: 30,
      players: players.length,
    }));
    // Kahoot: la pregunta se abre (y arranca el tiempo) al llegar a su slide.
    if (qid && !slide?.openedAt?.[qid]) void send(rt.openQuestion(qid));
    if (kind === 'podium') publishPodium();
  }

  stage.addEventListener('slidechange', (e) => {
    index = (e as CustomEvent).detail.index;
    publishSlide();
    renderAll();
    if (kindOf(active()) === 'join') refreshStars();
  });

  rt.onSlide((s) => {
    slide = s;
    renderPolls();
    renderQaSlide();
  });

  let qaShown = '';
  function renderQaSlide() {
    const items = slide?.qa ?? [];
    const json = JSON.stringify(items);
    if (json === qaShown) return;
    qaShown = json;
    document.querySelectorAll('[data-qa-count]').forEach((el) => (el.textContent = String(items.length)));
    document.querySelectorAll<HTMLElement>('[data-qa]').forEach((grid) => {
      grid.replaceChildren(
        ...(items.length
          ? items.map((it, i) => {
              const card = document.createElement('article');
              card.className = 'qa-card';
              card.style.setProperty('--i', String(i));
              const q = document.createElement('h3');
              q.textContent = it.q;
              const a = document.createElement('p');
              a.textContent = it.a;
              const f = document.createElement('small');
              f.textContent = `${it.name} · ${it.engine}${it.ref && it.ref !== 'Ninguno' ? ` · ver «${it.ref}»` : ''}`;
              card.append(q, a, f);
              return card;
            })
          : [Object.assign(document.createElement('p'), { className: 'qa-wait', textContent: 'Escanea el QR del inicio y toca «Pregunta» en tu celular: Gemini Nano la responde aquí.' })]),
      );
    });
  }
  rt.onPlayers((p) => {
    players = p;
    renderLobby();
    renderCounts();
    renderPodium();
  });
  rt.onLikes((l) => {
    likes = l;
    renderCounts();
    renderPodium();
  });
  rt.onVotes((v) => {
    votes = v;
    renderPolls();
    renderPodium();
  });
  rt.onCards((c) => {
    cards = c;
    renderWall();
    renderCounts();
    renderPodium();
  });
  rt.onReaction(floatReaction);

  function renderAll() {
    renderCounts();
    renderLobby();
    renderPolls();
    renderWall();
    renderPodium();
  }

  // ── Contadores y lobby ─────────────────────────────────────────────
  let stars: number | null = null;
  let lastStars = 0;
  async function refreshStars() {
    if (Date.now() - lastStars < 60_000) return; // API pública: 60 req/h por IP
    lastStars = Date.now();
    stars = await getStarCount();
    renderCounts();
  }
  setInterval(() => kindOf(active()) === 'join' && refreshStars(), 60_000);

  function setCount(name: string, value: string | number) {
    document.querySelectorAll(`[data-count="${name}"]`).forEach((el) => {
      if (el.textContent !== String(value)) el.textContent = String(value);
    });
  }
  function renderCounts() {
    setCount('players', players.length);
    setCount('likes', likes.size);
    setCount('cards', cards.filter((c) => !c.hidden).length);
    setCount('stars', stars ?? '—');
  }

  const lobbyNodes = new Map<string, HTMLElement>();
  function renderLobby() {
    const box = document.querySelector<HTMLElement>('[data-lobby]');
    if (!box) return;
    for (const p of players) {
      if (lobbyNodes.has(p.id)) continue; // ya está: no se toca
      const span = document.createElement('span');
      span.textContent = p.name;
      box.prepend(span);
      lobbyNodes.set(p.id, span);
    }
  }

  // ── Encuestas ──────────────────────────────────────────────────────
  function buildPolls() {
    document.querySelectorAll<HTMLElement>('[data-poll]').forEach((box) => {
      const q = QUESTIONS[box.dataset.poll as QuestionId];
      box.innerHTML = '';
      q.options.forEach((opt, i) => {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.opt = opt.id;
        tile.innerHTML = `<span class="bar"></span><span class="shape"></span><span class="label"></span><span class="count">0</span>`;
        tile.querySelector('.shape')!.append(icon(SHAPES[i], 26));
        tile.querySelector('.label')!.textContent = opt.label;
        // La marca de "correcta" se activa SOLO al revelar (la respuesta no está en el DOM antes).
        const ok = document.createElement('span');
        ok.className = 'ok';
        ok.append(icon(Check, 22));
        tile.append(ok);
        box.append(tile);
      });
    });
  }

  function renderPolls() {
    document.querySelectorAll<HTMLElement>('[data-poll]').forEach((box) => {
      const q = box.dataset.poll as QuestionId;
      const section = box.closest('section')!;
      const { counts, total } = tally(votes, q);
      const revealed = Boolean(slide?.revealed?.[q]);
      const max = Math.max(1, ...Object.values(counts));
      section.toggleAttribute('data-revealed', revealed);
      section.querySelectorAll<HTMLElement>('[data-total]').forEach((el) => (el.textContent = String(total)));
      const published = revealed ? slide?.answers?.[q] : undefined;
      const explain = section.querySelector<HTMLElement>('[data-explain]');
      if (explain) {
        explain.hidden = !published;
        explain.textContent = published?.explain ?? '';
      }
      box.querySelectorAll<HTMLElement>('.tile').forEach((tile) => {
        tile.toggleAttribute('data-correct', Boolean(published && tile.dataset.opt === published.correct));
        const n = counts[tile.dataset.opt!] ?? 0;
        tile.querySelector('.count')!.textContent = String(n);
        // transform (no width): la barra crece sin provocar layout.
        (tile.querySelector('.bar') as HTMLElement).style.transform = `scaleX(${revealed ? n / max : 0})`;
        tile.toggleAttribute('data-top', revealed && n === max && n > 0);
      });
    });
  }

  const reveal = (q: QuestionId) => {
    if (!presenter || !slide) return; // el público no puede revelar (y las reglas tampoco lo dejarían)
    if (!answers[q]) {
      alert(`Primero carga las respuestas: menú → "Cargar respuestas" (falta ${q}).`);
      return;
    }
    // Se publica SOLO la respuesta de esta pregunta, en el momento de revelar.
    void send(
      rt.patchSlide({
        revealed: { ...slide.revealed, [q]: true },
        results: { ...slide.results, [q]: tally(votes, q) },
        answers: { ...slide.answers, [q]: answers[q] },
      }),
    );
  };
  sections.forEach((s) => {
    const q = s.dataset.q as QuestionId | undefined;
    if (!q) return;
    s.querySelector('[data-reveal]')?.addEventListener('click', () => reveal(q));
  });
  addEventListener('keydown', (e) => {
    const q = active().dataset.q as QuestionId | undefined;
    if (!q || (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
    if ((e.key === 'v' || e.key === 'V') && presenter) reveal(q);
  });

  // Sin cuenta regresiva visible: se revela cuando la presentadora presiona V.
  // (La rapidez igual suma puntos: se mide con la hora del servidor de cada voto.)

  // ── Muro de cards (DOM por clave) ──────────────────────────────────
  const wallNodes = new Map<string, HTMLElement>();
  function renderWall() {
    const wall = document.querySelector<HTMLElement>('[data-wall]');
    if (!wall) return;
    const visible = cards.filter((c) => !c.hidden || presenter).slice(0, 18);
    const keep = new Set(visible.map((c) => c.id));
    for (const [id, el] of wallNodes) {
      if (!keep.has(id)) {
        el.remove();
        wallNodes.delete(id);
      }
    }
    visible.forEach((c, i) => {
      let el = wallNodes.get(c.id);
      if (!el) {
        const tpl = document.createElement('template');
        tpl.innerHTML = cardHTML(c, `data-id="${c.id}"`).trim();
        el = tpl.content.firstElementChild as HTMLElement;
        el.title = presenter ? 'Clic para ocultar / mostrar (moderación)' : '';
        el.addEventListener('click', () => presenter && rt.setCardHidden(c.id, !el!.hasAttribute('data-hidden')));
        wallNodes.set(c.id, el);
      }
      el.toggleAttribute('data-hidden', c.hidden);
      if (wall.children[i] !== el) wall.insertBefore(el, wall.children[i] ?? null);
    });
    let empty = wall.querySelector('.wall-empty');
    if (!visible.length && !empty) {
      empty = document.createElement('p');
      empty.className = 'wall-empty';
      empty.textContent = 'Todavía no hay cards. Créala desde tu celular: menú → "Mi card".';
      wall.append(empty);
    } else if (visible.length) empty?.remove();
  }

  // ── Podio ──────────────────────────────────────────────────────────
  function ranking() {
    const ids = new Set<string>([...players.map((p) => p.id), ...votes.map((v) => v.uid), ...likes, ...cards.map((c) => c.id)]);
    const byVote = new Map(votes.map((v) => [v.uid, v]));
    const hasCard = new Set(cards.filter((c) => !c.hidden).map((c) => c.id));
    const names = new Map(players.map((p) => [p.id, p.name]));
    return [...ids]
      .map((uid) => {
        const v = byVote.get(uid);
        const speed = Object.values(v?.at ?? {}).reduce((s, t) => s + (t ?? 0), 0);
        return {
          uid,
          name: names.get(uid) ?? cards.find((c) => c.id === uid)?.name ?? 'Anónimo',
          score: scoreFor(v, slide ?? { openedAt: {}, duration: 30 }, likes.has(uid), hasCard.has(uid), answers),
          speed,
          code: winnerCode(uid),
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.speed - b.speed); // empate: quien respondió antes
  }

  function renderPodium() {
    const box = document.querySelector<HTMLElement>('[data-podium]');
    if (!box) return;
    // Solo la presentadora tiene las respuestas: el resto ve el podio que ella publica.
    const top = presenter ? ranking() : (slide?.podium ?? []).map((p) => ({ ...p, uid: '', speed: 0, code: p.code ?? '' }));
    if (presenter && kindOf(active()) === 'podium') schedulePodiumPublish();
    const medal = ['2°', '1°', '3°'];
    const order = [top[1], top[0], top[2]];
    box.innerHTML = order
      .map((r, i) =>
        r
          ? `<div class="step"><span class="medal">${medal[i]}</span><span class="name"></span><span class="pts">${r.score.toLocaleString('es-DO')} pts</span>${i === 1 ? `<span class="code-chip">${r.code}</span>` : ''}</div>`
          : '<div class="step"><span class="pts">—</span></div>',
      )
      .join('');
    box.querySelectorAll('.name').forEach((el, i) => (el.textContent = order.filter(Boolean)[i]?.name ?? ''));
    const rest = document.querySelector<HTMLElement>('[data-rest]');
    if (rest) {
      rest.innerHTML = '';
      top.slice(3, 10).forEach((r, i) => {
        const pill = document.createElement('span');
        pill.className = 'pill';
        pill.textContent = `${i + 4}. ${r.name} · ${r.score}`;
        rest.append(pill);
      });
    }
  }

  let podiumTimer = 0;
  function schedulePodiumPublish() {
    clearTimeout(podiumTimer);
    podiumTimer = window.setTimeout(publishPodium, 1500);
  }

  function publishPodium() {
    if (!presenter) return;
    void send(rt.patchSlide({ podium: ranking().slice(0, 10).map(({ name, score, code }) => ({ name, score, code })) }));
  }

  // ── Reacciones flotantes ───────────────────────────────────────────
  const lane = document.querySelector<HTMLElement>('.reactions')!;
  let onScreen = 0;
  function floatReaction(r: Reaction) {
    if (onScreen > 24 || !REACTION_ICONS[r]) return; // tope: no saturar la GPU ni la vista
    onScreen++;
    const span = document.createElement('span');
    span.style.left = `${Math.random() * 70}px`;
    span.style.setProperty('--dx', `${(Math.random() - 0.5) * 60}px`);
    span.append(icon(REACTION_ICONS[r], 40, REACTION_META[r].color));
    lane.append(span);
    span.addEventListener('animationend', () => {
      span.remove();
      onScreen--;
    });
  }

  renderAll();
  publishSlide();
}
