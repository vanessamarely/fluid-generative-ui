import { emptySlide, type CardData, type Player, type Realtime, type SlideState, type VoteRecord } from './realtime';
import type { Reaction } from './questions';

interface LocalDb {
  slide: SlideState;
  players: Record<string, string>;
  likes: Record<string, true>;
  votes: Record<string, VoteRecord>;
  cards: Record<string, CardData>;
}

const KEY = 'fgui.local.db';
const empty = (): LocalDb => ({ slide: emptySlide(), players: {}, likes: {}, votes: {}, cards: {} });

function read(): LocalDb {
  try {
    const db = { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    db.slide = { ...emptySlide(), ...db.slide };
    return db;
  } catch {
    return empty();
  }
}

/** Modo ensayo: sin red. Cada pestaña es un asistente distinto. */
export function createLocalRealtime(): Realtime {
  const channel = new BroadcastChannel('fgui-live');
  const listeners = new Set<(db: LocalDb) => void>();
  const reactionListeners = new Set<(e: Reaction) => void>();

  let uid = sessionStorage.getItem('fgui.uid');
  if (!uid) {
    uid = 'local-' + crypto.randomUUID().slice(0, 8);
    sessionStorage.setItem('fgui.uid', uid);
  }
  const me = uid;

  const emit = () => {
    const db = read();
    listeners.forEach((l) => l(db));
  };
  const write = (fn: (db: LocalDb) => void) => {
    const db = read();
    fn(db);
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      /* cuota llena (imágenes de cards) */
    }
    channel.postMessage({ type: 'db' });
    emit();
  };
  channel.onmessage = (e) => {
    if (e.data?.type === 'db') emit();
    if (e.data?.type === 'reaction') reactionListeners.forEach((l) => l(e.data.emoji));
  };
  const sub = (fn: (db: LocalDb) => void) => {
    listeners.add(fn);
    queueMicrotask(() => fn(read()));
    return () => {
      listeners.delete(fn);
    };
  };

  return {
    mode: 'local',
    uid: () => me,

    async patchSlide(s) {
      write((db) => (db.slide = { ...db.slide, ...s }));
    },
    async openQuestion(q) {
      write((db) => (db.slide.openedAt = { ...db.slide.openedAt, [q]: Date.now() }));
    },
    onSlide: (cb) => sub((db) => cb(db.slide)),

    async join(name) {
      write((db) => (db.players[me] = name));
    },
    async setLike(on) {
      write((db) => {
        if (on) db.likes[me] = true;
        else delete db.likes[me];
      });
    },
    async vote(q, option) {
      write((db) => {
        const prev = db.votes[me] ?? { uid: me, votes: {}, at: {} };
        db.votes[me] = { uid: me, votes: { ...prev.votes, [q]: option }, at: { ...prev.at, [q]: Date.now() } };
      });
    },
    onMyVotes: (cb) => sub((db) => cb(db.votes[me]?.votes ?? {})),
    async react(emoji) {
      channel.postMessage({ type: 'reaction', emoji });
      reactionListeners.forEach((l) => l(emoji));
    },
    async publishCard(card) {
      write((db) => (db.cards[me] = { ...card, id: me, createdAt: Date.now(), hidden: false }));
    },

    onPlayers: (cb) => sub((db) => cb(Object.entries(db.players).map(([id, name]): Player => ({ id, name })))),
    onLikes: (cb) => sub((db) => cb(new Set(Object.keys(db.likes)))),
    onVotes: (cb) => sub((db) => cb(Object.values(db.votes))),
    onReaction(cb) {
      reactionListeners.add(cb);
      return () => {
        reactionListeners.delete(cb);
      };
    },
    onCards: (cb) => sub((db) => cb(Object.values(db.cards).sort((a, b) => b.createdAt - a.createdAt))),
    async setCardHidden(id, hidden) {
      write((db) => {
        if (db.cards[id]) db.cards[id].hidden = hidden;
      });
    },

    async signInPresenter() {
      return true;
    },
    // En ensayo local "presentadora" = quien abre el deck con ?presenter.
    isPresenterSession: () => new URLSearchParams(location.search).has('presenter'),
    async loadAnswers() {
      try {
        return JSON.parse(localStorage.getItem('fgui.local.private') ?? 'null');
      } catch {
        return null;
      }
    },
    async saveAnswers(a) {
      localStorage.setItem('fgui.local.private', JSON.stringify(a));
    },
    async githubTokenForStar() {
      return null;
    },
  };
}
