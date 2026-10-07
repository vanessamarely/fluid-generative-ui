// App del público (celular). Sigue al deck en vivo y aplica las mismas ideas de la charla:
//  · Escucha UN solo documento (el slide actual) + su propio voto: barato y rápido.
//  · Pantallas con altura reservada; los cambios se aplican por clave (sin recrear todo).
//  · La card se genera EN EL DISPOSITIVO: la foto nunca sale del teléfono.
import {
  Camera,
  Check,
  Circle,
  Diamond,
  Download,
  Flame,
  GitBranch,
  Heart,
  IdCard,
  Laugh,
  Map as MapIcon,
  MessageCircleQuestion,
  NotebookPen,
  Presentation,
  Radio,
  Send,
  Shuffle,
  Sparkles,
  Square,
  Star,
  Triangle,
  Trophy,
  X,
  createElement,
  createIcons,
  type IconNode,
} from 'lucide';
import { DETAIL_LABELS, GENDER_LABEL, HAIR_LABELS, HAIR_SWATCHES, SKIN_SWATCHES, avatarSVG, comicPortrait, svgDataUrl, type AvatarGender, type AvatarOptions } from '../shared/avatar';
import { POWERS, TYPE_META, abilityFor, cardHTML, cardPNG, winnerCode } from '../shared/card';
import { DEMO_URL, REPO_URL, SLIDES_URL } from '../shared/config';
import { starRepo } from '../shared/github';
import { QUESTIONS, REACTION_META, type QuestionId, type Reaction } from '../shared/questions';
import { correctCount, getRealtime, type CardType, type Realtime, type SlideState, type Votes } from '../shared/realtime';

const ICONS = { Camera, Check, Download, Flame, GitBranch, Heart, IdCard, Laugh, Map: MapIcon, MessageCircleQuestion, NotebookPen, Presentation, Radio, Send, Shuffle, Sparkles, Star, Trophy, X };
const SHAPES: IconNode[] = [Triangle, Diamond, Circle, Square];
// Fuego (lo de siempre), like, risa (para las viñetas) y "tengo una pregunta".
const REACTION_ICONS: Partial<Record<Reaction, IconNode>> = { fire: Flame, heart: Heart, laugh: Laugh, ask: MessageCircleQuestion };
const REACTION_BAR: Reaction[] = ['fire', 'heart', 'laugh', 'ask'];
const REACTION_SHORT: Partial<Record<Reaction, string>> = { fire: 'Fuego', heart: 'Like', laugh: 'Risa', ask: 'Pregunta' };

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const icon = (node: IconNode, size = 22) => {
  const el = createElement(node);
  el.setAttribute('width', String(size));
  el.setAttribute('height', String(size));
  el.setAttribute('aria-hidden', 'true');
  return el.outerHTML;
};
const store = {
  get<T>(k: string, fallback: T): T {
    try {
      return JSON.parse(localStorage.getItem(`live.${k}`) ?? 'null') ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(`live.${k}`, JSON.stringify(v));
    } catch {
      /* noop */
    }
  },
};

// ── Apodos generados (sin texto libre: nada inapropiado llega al proyector) ──
const NOUNS = ['Pixel', 'Token', 'Gremlin', 'Prompt', 'Nano', 'Slot', 'Stream', 'Frame', 'Agente', 'Cometa', 'Colibrí', 'Tiburón', 'Merengue', 'Mango', 'Coquí'];
const ADJS = ['Veloz', 'Fluido', 'Valiente', 'Curioso', 'Brillante', 'Sereno', 'Épico', 'Ninja', 'Cósmico', 'Tropical', 'Ágil', 'Sabio'];
const randomName = () => `${NOUNS[Math.floor(Math.random() * NOUNS.length)]} ${ADJS[Math.floor(Math.random() * ADJS.length)]}`;

const BANNED = /(put[ao]|mierd|cul[oa]|pend[ae]j|verga|coñ|carajo|fuck|shit|sex|nazi)/i;
const cleanName = (s: string) => (BANNED.test(s) ? randomName() : s.trim().slice(0, 18)) || randomName();

// ── Estado ──────────────────────────────────────────────────────────────
let rt: Realtime;
let slide: SlideState | null = null;
let myVotes: Votes = {};
let view: 'live' | 'card' | 'notes' = 'live';
let name: string | null = store.get('name', null);
let liked = store.get('liked', false);
let card = store.get<null | { published: boolean }>('card', null);
// Notas de bolsillo: la idea clave de cada slide (automática) + lo que la persona escriba.
// Todo vive SOLO en el teléfono (localStorage); se puede descargar o compartir al final.
const notes = store.get<{ label: string; tip: string; mine?: string }[]>('notes', []);

async function boot() {
  createIcons({ icons: ICONS, attrs: { 'stroke-width': 1.75, 'aria-hidden': 'true' } });
  setupMenu();
  setupReactions();
  rt = await getRealtime();
  const forcedLocal = new URLSearchParams(location.search).has('local');
  if (rt.mode === 'local' && !forcedLocal) {
    // Firebase no respondió (p. ej. Auth anónima sin habilitar): avisamos y reintentamos solos.
    $('[data-status]').innerHTML = 'Sin conexión en vivo con la pantalla. Reintentando… <button class="link" type="button" onclick="location.reload()">Reintentar</button>';
    setTimeout(() => location.reload(), 20000);
  } else $('[data-status]').textContent = rt.mode === 'local' ? 'Modo ensayo (local) · esperando el deck…' : 'Conectado · esperando el deck…';
  rt.onSlide((s) => {
    const changed = s.index !== slide?.index || s.kind !== slide?.kind;
    slide = s;
    if (s.tip && !notes.some((n) => n.tip === s.tip)) {
      notes.push({ label: s.label, tip: s.tip });
      store.set('notes', notes);
    }
    $('[data-status]').textContent = s.total ? `En vivo · ${s.label} · ${s.index + 1}/${s.total}` : 'Conectado · esperando a que la presentadora abra el deck…';
    renderScore();
    if (view === 'live') render(changed);
  });
  rt.onMyVotes((v) => {
    myVotes = v;
    renderScore();
    if (view === 'live' && slide?.kind === 'poll') render(false);
  });
  if (name) void rt.join(name);
  render(true);
}

function renderScore() {
  const el = $('[data-score]');
  const answered = Object.keys(myVotes).length;
  el.hidden = !name;
  el.innerHTML = `${icon(Trophy, 16)} ${correctCount(myVotes, slide?.answers ?? {})}/${answered || 0}<span class="score-label"> aciertos</span>`;
  el.title = 'Aciertos / respondidas';
}

// ── Pantallas ───────────────────────────────────────────────────────────
function render(full: boolean) {
  const screen = $('#screen');
  if (view === 'card') return renderCardCreator(screen);
  if (view === 'notes') return renderNotes(screen);
  if (!name) return renderJoin(screen);
  const kind = slide?.kind ?? 'content';
  // Encuesta: solo actualizamos lo que cambia (no recreamos la pantalla en cada voto).
  if (!full && kind === 'poll' && screen.dataset.screen === `poll-${slide?.qid}`) return updatePoll(screen);
  screen.dataset.screen = kind === 'poll' ? `poll-${slide?.qid}` : kind;
  if (kind === 'poll' && slide?.qid) return renderPoll(screen, slide.qid);
  if (kind === 'join') return renderLobby(screen);
  if (kind === 'podium') return renderPodium(screen);
  if (kind === 'cards') return renderCardsCta(screen);
  if (kind === 'end') return renderEnd(screen);
  return renderContent(screen);
}

function renderJoin(screen: HTMLElement) {
  screen.dataset.screen = 'join-name';
  let options = [randomName(), randomName(), randomName()];
  const draw = () => {
    screen.innerHTML = `<section class="card-sheet">
      <p class="kicker">Bienvenida/o a la charla</p>
      <h1>Elige tu apodo</h1>
      <p class="muted">Aparecerá en la pantalla y en el podio. Sin correo, sin contraseña.</p>
      <div class="name-options" role="radiogroup" aria-label="Apodos">${options
        .map((o, i) => `<button type="button" role="radio" aria-checked="${i === 0}" data-name="${esc(o)}">${esc(o)}</button>`)
        .join('')}</div>
      <div class="row"><button class="btn ghost" type="button" data-shuffle>${icon(Shuffle, 18)} Otros apodos</button>
      <button class="btn primary" type="button" data-join>Entrar</button></div>
    </section>`;
    screen.querySelectorAll<HTMLButtonElement>('[data-name]').forEach((b) =>
      b.addEventListener('click', () => screen.querySelectorAll('[data-name]').forEach((x) => x.setAttribute('aria-checked', String(x === b)))),
    );
    $('[data-shuffle]', screen).addEventListener('click', () => {
      options = [randomName(), randomName(), randomName()];
      draw();
    });
    $('[data-join]', screen).addEventListener('click', async () => {
      name = screen.querySelector<HTMLElement>('[aria-checked="true"]')?.dataset.name ?? options[0];
      store.set('name', name);
      await rt.join(name);
      renderScore();
      render(true);
    });
  };
  draw();
}

function renderLobby(screen: HTMLElement) {
  screen.innerHTML = `<section class="card-sheet">
    <p class="kicker">Hola, ${esc(name)}</p>
    <h1>¡Estás dentro!</h1>
    <p class="muted">Habrá 3 preguntas sobre los términos técnicos que vamos explicando. Puntos por acertar (y un extra por responder rápido).</p>
    <button class="big-like" type="button" aria-pressed="${liked}" data-like>${icon(Heart, 30)}<span>${liked ? '¡Gracias por el like!' : 'Dale like a la charla'}</span></button>
    <div class="star-box">
      <p><b>${icon(Star, 18)} ¿Te gusta el repo?</b> Dale una estrella en GitHub.</p>
      <div class="row">
        <a class="btn" href="${REPO_URL}" target="_blank" rel="noreferrer">Abrir en GitHub</a>
        <button class="btn primary" type="button" data-star>${icon(Star, 18)} Estrella automática</button>
      </div>
      <p class="fine">La estrella automática te pide iniciar sesión con GitHub (permiso <code>public_repo</code>). Usamos el token <b>una sola vez</b> y no guardamos tu usuario.</p>
      <p class="fine" data-star-msg role="status"></p>
    </div>
    <button class="btn wide" type="button" data-go-card>${icon(IdCard, 18)} Crear mi card mientras escucho</button>
  </section>`;
  $('[data-like]', screen).addEventListener('click', async (e) => {
    liked = !liked;
    store.set('liked', liked);
    (e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(liked));
    (e.currentTarget as HTMLElement).querySelector('span')!.textContent = liked ? '¡Gracias por el like!' : 'Dale like a la charla';
    await rt.setLike(liked);
  });
  $('[data-star]', screen).addEventListener('click', async () => {
    const msg = $('[data-star-msg]', screen);
    msg.textContent = 'Abriendo GitHub…';
    try {
      const auth = await rt.githubTokenForStar();
      if (!auth) {
        msg.innerHTML = `En este modo no hay login: <a href="${REPO_URL}" target="_blank" rel="noreferrer">dale la estrella aquí</a>.`;
        return;
      }
      msg.textContent = (await starRepo(auth.token)) ? `¡Gracias, @${auth.login}! Estrella enviada.` : 'GitHub no aceptó la estrella; usa el botón "Abrir en GitHub".';
    } catch {
      msg.textContent = 'Se canceló el inicio de sesión. Puedes usar "Abrir en GitHub".';
    }
  });
  $('[data-go-card]', screen).addEventListener('click', () => go('card'));
}

function renderPoll(screen: HTMLElement, qid: QuestionId) {
  const q = QUESTIONS[qid];
  screen.innerHTML = `<section class="poll" data-q="${qid}">
    <div class="poll-head"><p class="kicker">Pregunta ${qid.slice(1)} de 3 · ${esc(q.topic)}</p></div>
    <h1>${esc(q.text)}</h1>
    <div class="answers">${q.options
      .map((o, i) => `<button type="button" class="answer" data-opt="${o.id}" data-i="${i}"><span class="shape">${icon(SHAPES[i], 24)}</span><span>${esc(o.label)}</span></button>`)
      .join('')}</div>
    <p class="poll-msg" data-msg role="status"></p>
  </section>`;
  screen.querySelectorAll<HTMLButtonElement>('.answer').forEach((b) =>
    b.addEventListener('click', async () => {
      if (myVotes[qid] || closed(qid) || b.classList.contains('pending')) return;
      b.classList.add('pending');
      const msg = $('[data-msg]', screen);
      msg.className = 'poll-msg';
      msg.textContent = 'Enviando…';
      try {
        await rt.vote(qid, b.dataset.opt!);
        // En Firebase la confirmación llega por onMyVotes; mientras, marcamos la elegida.
        if (!myVotes[qid]) {
          myVotes = { ...myVotes, [qid]: b.dataset.opt! };
          updatePoll(screen);
        }
      } catch (err) {
        console.error('[live] voto', err);
        b.classList.remove('pending');
        msg.className = 'poll-msg bad';
        msg.textContent = closed(qid) ? 'La pregunta ya se cerró.' : 'No se pudo enviar tu respuesta. Revisa tu conexión y toca otra vez.';
      }
    }),
  );
  updatePoll(screen);
}

// Sin timer: la pregunta se cierra cuando se revela en la pantalla.
const closed = (qid: QuestionId) => Boolean(slide?.revealed?.[qid]);

function updatePoll(screen: HTMLElement) {
  const qid = slide?.qid as QuestionId | undefined;
  if (!qid) return;
  const mine = myVotes[qid];
  // La respuesta correcta solo existe en el celular cuando la presentadora revela.
  const answer = slide?.revealed?.[qid] ? slide?.answers?.[qid] : undefined;
  const revealed = Boolean(answer);
  screen.querySelectorAll<HTMLButtonElement>('.answer').forEach((b) => {
    const opt = b.dataset.opt;
    b.disabled = Boolean(mine) || closed(qid);
    b.classList.remove('pending');
    b.toggleAttribute('data-mine', opt === mine);
    b.toggleAttribute('data-correct', revealed && opt === answer!.correct);
    b.toggleAttribute('data-wrong', revealed && opt === mine && mine !== answer!.correct);
  });
  const msg = $('[data-msg]', screen);
  if (revealed) {
    const ok = mine === answer!.correct;
    msg.className = `poll-msg ${ok ? 'ok' : mine ? 'bad' : ''}`;
    msg.innerHTML = `${mine ? (ok ? `${icon(Check, 18)} <b>¡Correcto!</b>` : '<b>Casi.</b>') : '<b>No respondiste a tiempo.</b>'} ${esc(answer!.explain)}`;
  } else if (mine) {
    msg.className = 'poll-msg';
    msg.innerHTML = `${icon(Send, 18)} Respuesta enviada. Mira la pantalla para el resultado.`;
  } else msg.textContent = '';
}

function renderContent(screen: HTMLElement) {
  const tip = slide?.tip;
  const demo = slide?.kind === 'demo';
  const d = slide?.digest;
  const started = Boolean(slide?.total);
  const pct = started ? Math.round(((slide!.index + 1) / slide!.total) * 100) : 0;
  // Espejo del slide: el mismo texto que se proyecta, legible en el celular.
  screen.innerHTML = `<section class="mirror" data-tone="${(slide?.index ?? 0) % 4}">
    <div class="mirror-top">
      <span class="live-dot" aria-hidden="true"></span>
      <span>${started ? `En pantalla · ${slide!.index + 1}/${slide!.total}` : 'Esperando a que empiece'}</span>
      <span class="mirror-progress" aria-hidden="true"><i style="width:${pct}%"></i></span>
    </div>
    ${d?.eyebrow ? `<p class="kicker">${esc(d.eyebrow)}</p>` : ''}
    <h1>${esc(slide?.title || slide?.label || 'La charla está por empezar')}</h1>
    ${d?.lede ? `<p class="mirror-lede">${esc(d.lede)}</p>` : ''}
    ${
      d?.points?.length
        ? `<ul class="mirror-points">${d.points
            .map((p) => `<li data-tone="${esc(p.tone ?? '')}">${p.h ? `<b>${esc(p.h)}</b>` : ''}${p.p ? `<span>${esc(p.p)}</span>` : ''}</li>`)
            .join('')}</ul>`
        : ''
    }
    ${d?.code ? `<figure class="mirror-code">${d.code.file ? `<figcaption>${esc(d.code.file)}</figcaption>` : ''}<pre><code>${esc(d.code.text)}</code></pre></figure>` : ''}
  </section>
  <section class="card-sheet">
    ${tip ? `<div class="pocket">${icon(NotebookPen, 18)}<p><b>Nota de bolsillo</b><br>${esc(tip)}</p></div>` : ''}
    ${slide?.label ? `<label class="field my-note"><span>Mi nota sobre este slide</span><textarea rows="2" maxlength="400" data-my-note placeholder="Algo que quiero probar…">${esc(notes.find((n) => n.label === slide!.label)?.mine ?? '')}</textarea></label>` : ''}
    ${demo ? `<a class="btn wide primary" href="${DEMO_URL}" target="_blank" rel="noreferrer">${icon(MapIcon, 18)} Abrir la demo en tu celular</a>` : ''}
    <p class="muted small">Se guardan solas en tu celular: <b>Menú → Mis notas</b> para descargarlas o compartirlas.</p>
  </section>`;
  const area = screen.querySelector<HTMLTextAreaElement>('[data-my-note]');
  area?.addEventListener('input', () => {
    const label = slide!.label;
    let note = notes.find((n) => n.label === label);
    if (!note) notes.push((note = { label, tip: slide!.tip ?? '' }));
    note.mine = area.value;
    store.set('notes', notes);
  });
}

function renderCardsCta(screen: HTMLElement) {
  screen.innerHTML = `<section class="card-sheet">
    <p class="kicker">Muro de la comunidad</p>
    <h1>${card?.published ? '¡Tu card está en la pantalla!' : '¿Ya creaste tu card?'}</h1>
    <p class="muted">Tu foto se convierte en cómic <b>dentro de tu celular</b>: nunca la subimos. Crear tu card suma 300 puntos.</p>
    <button class="btn wide primary" type="button" data-go-card>${icon(IdCard, 18)} ${card?.published ? 'Editar mi card' : 'Crear mi card'}</button>
  </section>`;
  $('[data-go-card]', screen).addEventListener('click', () => go('card'));
}

function renderPodium(screen: HTMLElement) {
  const myCode = winnerCode(rt.uid());
  const podium = (slide?.podium ?? []) as { name: string; score: number; code?: string }[];
  const pos = podium.findIndex((p) => p.code === myCode);
  const winner = pos === 0;
  screen.innerHTML = `<section class="card-sheet podium-card ${winner ? 'winner' : ''}">
    <p class="kicker">Podio</p>
    ${
      winner
        ? `<h1>${icon(Trophy, 30)} ¡Ganaste, ${esc(name)}!</h1><p>Acércate al escenario y muestra este código:</p><p class="code">${myCode}</p>`
        : pos > 0
          ? `<h1>Quedaste en el puesto ${pos + 1}</h1><p class="muted">${podium[pos].score.toLocaleString('es-DO')} puntos. ¡Gran partida!</p>`
          : `<h1>¡Gracias por jugar!</h1><p class="muted">Acertaste ${correctCount(myVotes, slide?.answers ?? {})} de 3. El podio está en la pantalla.</p>`
    }
    <p class="fine">Tu código: <b>${myCode}</b></p>
  </section>`;
}

function renderEnd(screen: HTMLElement) {
  screen.innerHTML = `<section class="card-sheet">
    <p class="kicker">¡Gracias!</p>
    <h1>IA rápida, UI fluida</h1>
    <p class="muted">Todo el código (deck, esta app y la demo) está en el repo.</p>
    <a class="btn wide primary" href="${REPO_URL}" target="_blank" rel="noreferrer">${icon(GitBranch, 18)} Ver el repositorio</a>
    <a class="btn wide" href="${DEMO_URL}" target="_blank" rel="noreferrer">${icon(MapIcon, 18)} Probar Rumbo</a>
    <button class="btn wide" type="button" data-go-notes>${icon(NotebookPen, 18)} Mis ${notes.length} notas</button>
  </section>`;
  $('[data-go-notes]', screen).addEventListener('click', () => go('notes'));
}

function notesMarkdown(): string {
  const lines = notes.map((n) => `## ${n.label}\n${n.tip ? `- ${n.tip}\n` : ''}${n.mine ? `- **Mi nota:** ${n.mine}\n` : ''}`);
  return `# IA rápida, UI fluida — mis notas\nDevFest Santo Domingo 2026 · Vanessa Aristizabal (@vanessamarelycode)\n\n${lines.join('\n')}\n---\n- Repo: ${REPO_URL}\n- Slides: ${SLIDES_URL}\n- Demo: ${DEMO_URL}\n`;
}

function renderNotes(screen: HTMLElement) {
  screen.dataset.screen = 'notes';
  screen.innerHTML = `<section class="card-sheet">
    <p class="kicker">Notas de bolsillo</p>
    <h1>Lo que me llevo</h1>
    <p class="muted small">La idea clave de cada slide se guarda sola; también puedes escribir las tuyas en cada slide. Todo queda en tu celular.</p>
    ${notes.length ? `<ol class="notes">${notes.map((n) => `<li><b>${esc(n.label)}</b>${n.tip ? `<span>${esc(n.tip)}</span>` : ''}${n.mine ? `<span class="mine">Mi nota: ${esc(n.mine)}</span>` : ''}</li>`).join('')}</ol>` : '<p class="muted">Se irán llenando solas mientras avanza la charla.</p>'}
    <div class="row">
      <button class="btn primary" type="button" data-download-notes ${notes.length ? '' : 'disabled'}>${icon(Download, 18)} Descargar (.md)</button>
      <button class="btn" type="button" data-share-notes ${notes.length ? '' : 'disabled'}>${icon(Send, 18)} Compartir</button>
    </div>
    <button class="btn wide ghost" type="button" data-back>Volver al en vivo</button>
  </section>`;
  $('[data-back]', screen).addEventListener('click', () => go('live'));
  $('[data-download-notes]', screen).addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([notesMarkdown()], { type: 'text/markdown;charset=utf-8' }));
    a.download = 'ia-rapida-ui-fluida-notas.md';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('[data-share-notes]', screen).addEventListener('click', async () => {
    const text = notesMarkdown();
    try {
      if (navigator.share) await navigator.share({ title: 'IA rápida, UI fluida — mis notas', text });
      else {
        await navigator.clipboard.writeText(text);
        alert('Notas copiadas al portapapeles.');
      }
    } catch {
      /* la persona canceló */
    }
  });
}

// ── Creador de card (todo en el dispositivo) ────────────────────────────
interface Draft {
  name: string;
  type: CardType;
  power: string;
  years: number;
  mode: 'avatar' | 'photo';
  avatar: AvatarOptions;
  photo: string | null;
}
let draft: Draft = store.get('draft', {
  name: '',
  type: 'web',
  power: 'Angular',
  years: 3,
  mode: 'avatar',
  avatar: { colorway: 'green', gender: 'x', skin: 1, hair: 0, hairColor: 0, detail: 0, accessory: 1, mood: 0 },
  photo: null,
});

// Drafts viejos (antes del selector de género) se completan con valores por defecto.
const legacy = draft.avatar as Partial<AvatarOptions>;
draft.avatar = { ...draft.avatar, gender: legacy.gender ?? 'x', hairColor: legacy.hairColor ?? legacy.hair ?? 0, detail: legacy.detail ?? 0 };

function draftImage(): string {
  if (draft.mode === 'photo' && draft.photo) return draft.photo;
  return svgDataUrl(avatarSVG({ ...draft.avatar, colorway: TYPE_META[draft.type].colorway }));
}
const draftCard = () => ({
  name: cleanName(draft.name || name || randomName()),
  type: draft.type,
  power: draft.power,
  years: draft.years,
  ability: abilityFor(draft.type, draft.power),
  image: draftImage(),
});

function renderCardCreator(screen: HTMLElement) {
  screen.dataset.screen = 'card';
  draft.name ||= name ?? '';
  screen.innerHTML = `<section class="card-sheet creator">
    <div class="creator-head"><p class="kicker">Mi card</p><button class="icon-btn" type="button" data-close aria-label="Cerrar">${icon(X, 20)}</button></div>
    <div class="preview" data-preview></div>
    <label class="field"><span>Nombre en la card</span><input data-f="name" maxlength="18" value="${esc(draft.name)}" autocomplete="nickname" /></label>
    <fieldset class="field"><legend>Tipo</legend><div class="types">${(Object.keys(TYPE_META) as CardType[])
      .map((t) => `<button type="button" data-type="${t}" aria-pressed="${draft.type === t}"><img src="/brand/${TYPE_META[t].icon}.svg" alt="" width="22" height="22"/>${TYPE_META[t].label}</button>`)
      .join('')}</div></fieldset>
    <div class="row2">
      <label class="field"><span>Superpoder</span><select data-f="power">${POWERS.map((p) => `<option ${p === draft.power ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
      <label class="field"><span>Años programando: <b data-years>${draft.years}</b></span><input type="range" min="0" max="30" value="${draft.years}" data-f="years" /></label>
    </div>
    <fieldset class="field"><legend>Imagen</legend>
      <div class="segmented" role="radiogroup">
        <button type="button" role="radio" aria-checked="${draft.mode === 'avatar'}" data-mode="avatar">${icon(Sparkles, 16)} Avatar generativo</button>
        <button type="button" role="radio" aria-checked="${draft.mode === 'photo'}" data-mode="photo">${icon(Camera, 16)} Mi foto en cómic</button>
      </div>
      <div data-mode-panel></div>
    </fieldset>
    <p class="fine">Todo se genera <b>en tu celular</b> (canvas y SVG). Tu foto original <b>nunca</b> se sube: solo publicamos la card final si tú quieres.</p>
    <div class="row">
      <button class="btn" type="button" data-download>${icon(Download, 18)} Descargar</button>
      <button class="btn primary" type="button" data-publish>${icon(Send, 18)} ${card?.published ? 'Actualizar en el muro' : 'Publicar en el muro'}</button>
    </div>
    <p class="fine" data-card-msg role="status"></p>
  </section>`;

  const save = () => store.set('draft', draft);
  const preview = () => {
    $('[data-preview]', screen).innerHTML = cardHTML(draftCard());
  };
  const modePanel = () => {
    const panel = $('[data-mode-panel]', screen);
    if (draft.mode === 'photo') {
      panel.innerHTML = `<label class="btn wide file">${icon(Camera, 18)} Tomar o elegir foto<input type="file" accept="image/*" capture="user" data-photo hidden /></label>`;
      $('[data-photo]', panel).addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        $('[data-card-msg]', screen).textContent = 'Convirtiendo tu foto en cómic (en tu celular)…';
        draft.photo = await comicPortrait(file, TYPE_META[draft.type].colorway);
        $('[data-card-msg]', screen).textContent = 'Listo. La foto original no salió de tu dispositivo.';
        save();
        preview();
      });
    } else {
      const g = draft.avatar.gender;
      const choice = (key: 'gender' | 'hair' | 'detail' | 'accessory' | 'mood', labels: string[], values: (string | number)[]) =>
        `<div class="chips" role="radiogroup">${labels
          .map((l, i) => `<button type="button" role="radio" aria-checked="${String(draft.avatar[key]) === String(values[i])}" data-pick="${key}" data-value="${values[i]}">${l}</button>`)
          .join('')}</div>`;
      const swatches = (key: 'skin' | 'hairColor', label: string, colors: readonly string[]) =>
        `<fieldset class="avatar-picker"><legend>${label}</legend><div class="avatar-swatches" role="radiogroup" aria-label="${label}">${colors
          .map((color, i) => `<button type="button" class="avatar-swatch" role="radio" data-av="${key}" data-value="${i}" aria-label="${label} ${i + 1}" aria-checked="${draft.avatar[key] === i}" style="--swatch:${color}"></button>`)
          .join('')}</div></fieldset>`;
      panel.innerHTML = `<p class="mini">Persona</p>${choice('gender', Object.values(GENDER_LABEL), Object.keys(GENDER_LABEL))}
        <p class="mini">Peinado</p>${choice('hair', HAIR_LABELS[g], [0, 1, 2, 3, 4])}
        <p class="mini">Detalle</p>${choice('detail', DETAIL_LABELS[g], [0, 1, 2])}
        <div class="avatar-color-row">${swatches('skin', 'Piel', SKIN_SWATCHES)}${swatches('hairColor', 'Cabello', HAIR_SWATCHES)}</div>
        <p class="mini">Accesorio</p>${choice('accessory', ['Ninguno', 'Lentes', 'Audífonos', 'Gorra'], [0, 1, 2, 3])}
        <p class="mini">Expresión</p>${choice('mood', ['Sonrisa', 'Sorpresa', 'Guiño'], [0, 1, 2])}
        <button class="btn ghost" type="button" data-random>${icon(Shuffle, 16)} Sorpréndeme</button>`;
      panel.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) =>
        b.addEventListener('click', () => {
          const key = b.dataset.pick as 'gender' | 'hair' | 'detail' | 'accessory' | 'mood';
          if (key === 'gender') draft.avatar = { ...draft.avatar, gender: b.dataset.value as AvatarGender, hair: 0, detail: 0 };
          else draft.avatar = { ...draft.avatar, [key]: Number(b.dataset.value) };
          save();
          modePanel();
          preview();
        }),
      );
      panel.querySelectorAll<HTMLButtonElement>('[data-av]').forEach((button) =>
        button.addEventListener('click', () => {
          const key = button.dataset.av as 'skin' | 'hairColor';
          draft.avatar[key] = Number(button.dataset.value);
          panel.querySelectorAll<HTMLButtonElement>(`[data-av="${key}"]`).forEach((swatch) => {
            swatch.setAttribute('aria-checked', String(swatch === button));
          });
          save();
          preview();
        }),
      );
      $('[data-random]', panel).addEventListener('click', () => {
        draft.avatar = { ...draft.avatar, skin: rnd(5), hair: rnd(5), hairColor: rnd(5), detail: rnd(3), accessory: rnd(4), mood: rnd(3) };
        save();
        modePanel();
        preview();
      });
    }
  };
  const rnd = (n: number) => Math.floor(Math.random() * n);

  $('[data-f="name"]', screen).addEventListener('input', (e) => {
    draft.name = (e.target as HTMLInputElement).value;
    save();
    preview();
  });
  $('[data-f="power"]', screen).addEventListener('change', (e) => {
    draft.power = (e.target as HTMLSelectElement).value;
    save();
    preview();
  });
  $('[data-f="years"]', screen).addEventListener('input', (e) => {
    draft.years = Number((e.target as HTMLInputElement).value);
    $('[data-years]', screen).textContent = String(draft.years);
    save();
    preview();
  });
  screen.querySelectorAll<HTMLButtonElement>('[data-type]').forEach((b) =>
    b.addEventListener('click', () => {
      draft.type = b.dataset.type as CardType;
      screen.querySelectorAll('[data-type]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      save();
      preview();
    }),
  );
  screen.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => {
      draft.mode = b.dataset.mode as Draft['mode'];
      screen.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      save();
      modePanel();
      preview();
    }),
  );
  $('[data-close]', screen).addEventListener('click', () => go('live'));
  $('[data-download]', screen).addEventListener('click', async () => {
    const blob = await cardPNG(draftCard());
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mi-card-devfest.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('[data-publish]', screen).addEventListener('click', async () => {
    const msg = $('[data-card-msg]', screen);
    const c = draftCard();
    if (c.image.length > 290_000) {
      msg.textContent = 'La imagen es muy pesada; prueba con otra foto.';
      return;
    }
    msg.textContent = 'Publicando…';
    try {
      await rt.publishCard({ ...c, source: 'local' });
      card = { published: true };
      store.set('card', card);
      msg.textContent = '¡Listo! Tu card está en el muro (+300 pts).';
    } catch (err) {
      console.error(err);
      msg.textContent = 'No se pudo publicar. Revisa tu conexión e inténtalo de nuevo.';
    }
  });
  modePanel();
  preview();
}

// ── Menú y reacciones ───────────────────────────────────────────────────
function go(v: typeof view) {
  view = v;
  closeMenu();
  render(true);
  scrollTo({ top: 0 });
}

const menuBtn = () => $<HTMLButtonElement>('.menu-btn');
const menuPanel = () => $('.menu-panel');
function closeMenu() {
  menuPanel().hidden = true;
  menuBtn().setAttribute('aria-expanded', 'false');
  menuBtn().setAttribute('aria-label', 'Abrir menú');
}
function setupMenu() {
  menuBtn().addEventListener('click', () => {
    const open = menuPanel().hidden;
    menuPanel().hidden = !open;
    menuBtn().setAttribute('aria-expanded', String(open));
    menuBtn().setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    if (open) menuPanel().querySelector<HTMLElement>('button, a')?.focus();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go as typeof view)));
  addEventListener('keydown', (e) => e.key === 'Escape' && closeMenu());
  addEventListener('pointerdown', (e) => {
    if (!menuPanel().hidden && !menuPanel().contains(e.target as Node) && !menuBtn().contains(e.target as Node)) closeMenu();
  });
}

function setupReactions() {
  const bar = $('[data-reactions]');
  bar.innerHTML = REACTION_BAR.map(
    (r) =>
      `<button type="button" data-r="${r}" title="${REACTION_META[r].label}" style="--c:${REACTION_META[r].color}">${icon(REACTION_ICONS[r]!, 24)}<span>${REACTION_SHORT[r]}</span></button>`,
  ).join('');
  let last = 0;
  bar.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-r]');
    if (!b || !rt) return;
    const r = b.dataset.r as Reaction;
    if (r === 'ask') return openAsk();
    if (Date.now() - last < 900) return; // las reglas también lo limitan
    last = Date.now();
    b.classList.remove('pop');
    void b.offsetWidth;
    b.classList.add('pop');
    navigator.vibrate?.(15);
    // El corazón también cuenta como like de la charla (una vez por persona).
    if (r === 'heart' && !liked) {
      liked = true;
      store.set('liked', true);
      void rt.setLike(true).catch(() => undefined);
      screen().querySelector('[data-like]')?.setAttribute('aria-pressed', 'true');
    }
    await rt.react(r).catch(() => undefined);
  });
}
const screen = () => $('#screen');

// Preguntas para la presentadora: texto libre, por eso NO se proyecta (solo ella las lee).
let lastAsk = 0;
function openAsk() {
  const dlg = document.createElement('dialog');
  dlg.className = 'ask-sheet';
  dlg.innerHTML = `<form>
    <h2>${icon(MessageCircleQuestion, 22)} ¿Tienes una pregunta?</h2>
    <p class="fine">Le llega solo a Vanessa (no sale en la pantalla) con tu apodo${name ? ` <b>${esc(name)}</b>` : ''} y el slide actual. Las responde al final.</p>
    <textarea name="q" rows="4" maxlength="280" required placeholder="Ej.: ¿Cómo mido el CLS de mi app?"></textarea>
    <p class="fine" data-ask-msg role="status"></p>
    <div class="row"><button class="btn ghost" type="button" data-cancel>Cancelar</button><button class="btn primary" type="submit">${icon(Send, 18)} Enviar</button></div>
  </form>`;
  document.body.append(dlg);
  const close = () => {
    dlg.close();
    dlg.remove();
  };
  dlg.addEventListener('cancel', () => dlg.remove());
  $('[data-cancel]', dlg).addEventListener('click', close);
  dlg.querySelector('form')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = dlg.querySelector('textarea')!.value.trim();
    const msg = $('[data-ask-msg]', dlg);
    if (!text) return;
    if (Date.now() - lastAsk < 15000) {
      msg.textContent = 'Espera unos segundos antes de enviar otra.';
      return;
    }
    const send = dlg.querySelector<HTMLButtonElement>('[type="submit"]')!;
    send.disabled = true;
    msg.textContent = 'Enviando…';
    try {
      await rt.ask({ name: name ?? 'Anónimo', text: text.slice(0, 280), slide: (slide?.label ?? '').slice(0, 80) });
      void rt.react('ask').catch(() => undefined);
      lastAsk = Date.now();
      msg.textContent = '¡Enviada! Gracias.';
      setTimeout(close, 1100);
    } catch (err) {
      console.error('[live] pregunta', err);
      send.disabled = false;
      msg.textContent = 'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.';
    }
  });
  dlg.showModal();
  dlg.querySelector('textarea')!.focus();
}

void boot();
