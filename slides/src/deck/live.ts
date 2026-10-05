// Lado "deck" de la experiencia en vivo.
//  · La presentadora publica el slide actual → los celulares cambian de pantalla.
//  · El deck es el ÚNICO que escucha las colecciones (votos, likes, jugadores, cards)
//    y publica agregados (resultados, podio) en momentos puntuales: así cientos de
//    celulares solo leen un documento y Firestore se mantiene en el plan gratuito.
//  · Las listas (lobby, muro) se actualizan por CLAVE: se agregan nodos, no se recrea nada.
import QRCode from 'qrcode';
import { createElement, Brain, Check, Circle, Diamond, Flame, Hand, Heart, Lightbulb, Rocket, Square, Triangle, type IconNode } from 'lucide';
import { cardHTML, winnerCode } from '../shared/card';
import { REPO_URL } from '../shared/config';
import { getStarCount } from '../shared/github';
import { QUESTIONS, REACTION_META, type QuestionId, type Reaction } from '../shared/questions';
import { getRealtime, scoreFor, tally, type CardData, type LiveKind, type Player, type SlideState, type VoteRecord } from '../shared/realtime';

const SHAPES: IconNode[] = [Triangle, Diamond, Circle, Square];
const REACTION_ICONS: Record<Reaction, IconNode> = { fire: Flame, clap: Hand, mind: Brain, idea: Lightbulb, heart: Heart, rocket: Rocket };

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
  const liveUrl = new URL('/live/', location.origin).toString();
  const qr = (text: string) => QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1e1e1e', light: '#ffffff' } });
  const [qrLive, qrRepo] = await Promise.all([qr(liveUrl), qr(REPO_URL)]);
  document.querySelectorAll('[data-qr="live"]').forEach((el) => (el.innerHTML = qrLive));
  document.querySelectorAll('[data-qr="repo"]').forEach((el) => (el.innerHTML = qrRepo));
  document.querySelectorAll('[data-live-url]').forEach((el) => (el.textContent = liveUrl.replace(/^https?:\/\//, '')));
  buildPolls();

  const rt = await getRealtime();
  const params = new URLSearchParams(location.search);
  let presenter = rt.mode === 'local' || params.has('presenter-local');
  const badge = document.querySelector<HTMLElement>('.presenter-badge')!;
  const showBadge = () => {
    badge.hidden = !presenter;
    badge.textContent = rt.mode === 'local' ? '● EN VIVO · modo local' : '● EN VIVO';
  };
  showBadge();
  document.querySelectorAll<HTMLElement>('[data-presenter-only]').forEach((el) => (el.hidden = rt.mode === 'local'));
  document.addEventListener('deck:present', async () => {
    try {
      presenter = await rt.signInPresenter();
      showBadge();
      publishSlide();
    } catch (err) {
      console.error(err);
      alert('No se pudo iniciar sesión como presentadora (¿GitHub habilitado en Firebase Auth?).');
    }
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
    void rt.patchSlide({
      index,
      total: sections.length,
      label: s.dataset.label ?? '',
      title: s.querySelector('h1, h2')?.textContent?.trim().replace(/\s+/g, ' ') ?? '',
      kind,
      qid,
      tip: s.dataset.tip ?? null,
      duration: 30,
      players: players.length,
    });
    // Kahoot: la pregunta se abre (y arranca el tiempo) al llegar a su slide.
    if (qid && !slide?.openedAt?.[qid]) void rt.openQuestion(qid);
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
  });
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
        if (opt.id === q.correct) {
          tile.dataset.correct = '';
          const ok = document.createElement('span');
          ok.className = 'ok';
          ok.append(icon(Check, 22));
          tile.append(ok);
        }
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
      const explain = section.querySelector<HTMLElement>('[data-explain]');
      if (explain) {
        explain.hidden = !revealed;
        explain.textContent = QUESTIONS[q].explain;
      }
      box.querySelectorAll<HTMLElement>('.tile').forEach((tile) => {
        const n = counts[tile.dataset.opt!] ?? 0;
        tile.querySelector('.count')!.textContent = String(n);
        // transform (no width): la barra crece sin provocar layout.
        (tile.querySelector('.bar') as HTMLElement).style.transform = `scaleX(${revealed ? n / max : 0})`;
        tile.toggleAttribute('data-top', revealed && n === max && n > 0);
      });
    });
  }

  const reveal = (q: QuestionId) => {
    if (!presenter || !slide) return;
    void rt.patchSlide({ revealed: { ...slide.revealed, [q]: true }, results: { ...slide.results, [q]: tally(votes, q) } });
  };
  sections.forEach((s) => {
    const q = s.dataset.q as QuestionId | undefined;
    if (!q) return;
    s.querySelector('[data-reveal]')?.addEventListener('click', () => reveal(q));
    s.querySelectorAll<HTMLElement>('.q-foot button').forEach((b) => (b.hidden = !presenter && rt.mode !== 'local'));
  });
  addEventListener('keydown', (e) => {
    const q = active().dataset.q as QuestionId | undefined;
    if (!q || (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
    if (e.key === 'v' || e.key === 'V') reveal(q);
  });

  // Cuenta regresiva (un solo intervalo; solo toca el slide activo).
  setInterval(() => {
    const s = active();
    const q = s.dataset.q as QuestionId | undefined;
    const box = s.querySelector<HTMLElement>('[data-countdown]');
    if (!q || !box || !slide) return;
    const opened = slide.openedAt?.[q];
    const left = opened ? Math.max(0, Math.ceil(slide.duration - (Date.now() - opened) / 1000)) : slide.duration;
    const b = box.querySelector('b')!;
    if (b.textContent !== String(left)) b.textContent = String(left);
    (box.querySelector('.ring') as SVGCircleElement).style.strokeDashoffset = String(327 * (1 - left / slide.duration));
    if (opened && left === 0 && !slide.revealed?.[q]) reveal(q);
  }, 250);

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
          score: scoreFor(v, slide ?? { openedAt: {}, duration: 30 }, likes.has(uid), hasCard.has(uid)),
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
    const top = ranking();
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

  function publishPodium() {
    if (!presenter) return;
    void rt.patchSlide({ podium: ranking().slice(0, 10).map(({ name, score, code }) => ({ name, score, code })) as never });
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
