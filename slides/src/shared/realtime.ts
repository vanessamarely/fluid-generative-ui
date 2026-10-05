// Capa de tiempo real con dos backends intercambiables:
//  - Firestore (Auth anónima) cuando hay configuración de Firebase.
//  - Local (BroadcastChannel + localStorage) para ensayar sin internet:
//    abre el deck en una pestaña y /live/ en otras; cada pestaña es un "asistente".
//
// Diseño pensado para cientos de celulares:
//  · Los celulares SOLO escuchan el documento de la sesión (+ su propio voto).
//  · Solo el deck escucha las colecciones (likes, votos, jugadores, cards) y publica
//    agregados (resultados, podio) en el documento de sesión en momentos puntuales.
import { hasFirebase } from './config';
import type { QuestionId, Reaction } from './questions';

export type LiveKind = 'content' | 'join' | 'poll' | 'ab' | 'cards' | 'podium' | 'demo' | 'end';

export interface PollResult {
  counts: Record<string, number>;
  total: number;
}

export interface SlideState {
  index: number;
  total: number;
  label: string;
  title: string;
  kind: LiveKind;
  qid?: QuestionId | null;
  tip?: string | null;
  /** segundos que dura cada pregunta */
  duration: number;
  /** epoch ms (hora del servidor) en que se abrió cada pregunta */
  openedAt: Partial<Record<QuestionId, number>>;
  revealed: Partial<Record<QuestionId, boolean>>;
  results: Partial<Record<QuestionId, PollResult>>;
  podium: { name: string; score: number }[];
  players: number;
}

export const emptySlide = (): SlideState => ({
  index: 0,
  total: 0,
  label: '',
  title: '',
  kind: 'content',
  duration: 30,
  openedAt: {},
  revealed: {},
  results: {},
  podium: [],
  players: 0,
});

export type CardType = 'web' | 'ia' | 'cloud' | 'mobile';

export interface CardData {
  id: string;
  name: string;
  type: CardType;
  power: string;
  years: number;
  ability: string;
  /** data URL (webp/jpeg/svg) */
  image: string;
  source: 'gemini' | 'local';
  createdAt: number;
  hidden: boolean;
}

export interface Player {
  id: string;
  name: string;
}

export type Votes = Partial<Record<QuestionId, string>>;
export interface VoteRecord {
  uid: string;
  votes: Votes;
  /** epoch ms (servidor) de cada respuesta */
  at: Partial<Record<QuestionId, number>>;
}

export type Unsub = () => void;

export interface Realtime {
  readonly mode: 'firebase' | 'local';
  uid(): string;

  // Sesión (presentadora escribe, todos leen)
  patchSlide(s: Partial<SlideState>): Promise<void>;
  openQuestion(q: QuestionId): Promise<void>;
  onSlide(cb: (s: SlideState) => void): Unsub;

  // Público
  join(name: string): Promise<void>;
  setLike(on: boolean): Promise<void>;
  vote(q: QuestionId, option: string): Promise<void>;
  onMyVotes(cb: (v: Votes) => void): Unsub;
  react(emoji: Reaction): Promise<void>;
  publishCard(card: Omit<CardData, 'id' | 'createdAt' | 'hidden'>): Promise<void>;

  // Solo el deck agrega
  onPlayers(cb: (players: Player[]) => void): Unsub;
  onLikes(cb: (uids: Set<string>) => void): Unsub;
  onVotes(cb: (all: VoteRecord[]) => void): Unsub;
  onReaction(cb: (emoji: Reaction) => void): Unsub;
  onCards(cb: (cards: CardData[]) => void): Unsub;
  setCardHidden(id: string, hidden: boolean): Promise<void>;

  /** Solo presentadora: login con GitHub para poder escribir la sesión. */
  signInPresenter(): Promise<boolean>;
  /** Login opcional con GitHub (scope public_repo) para dar ⭐. No guarda la identidad. */
  githubTokenForStar(): Promise<{ token: string; login: string } | null>;
}

let instance: Promise<Realtime> | null = null;

export function getRealtime(): Promise<Realtime> {
  if (!instance) {
    instance = hasFirebase
      ? import('./realtime-firebase').then((m) => m.createFirebaseRealtime())
      : import('./realtime-local').then((m) => m.createLocalRealtime());
  }
  return instance;
}

export function tally(all: VoteRecord[], q: QuestionId): PollResult {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const v of all) {
    const opt = v.votes[q];
    if (!opt) continue;
    counts[opt] = (counts[opt] ?? 0) + 1;
    total++;
  }
  return { counts, total };
}

/** Puntos estilo Kahoot: 500 por responder + hasta 500 por rapidez; like +100; card +300. */
export function scoreFor(
  vote: VoteRecord | undefined,
  slide: Pick<SlideState, 'openedAt' | 'duration'>,
  liked: boolean,
  hasCard: boolean,
): number {
  let score = (liked ? 100 : 0) + (hasCard ? 300 : 0);
  if (!vote) return score;
  for (const q of Object.keys(vote.votes) as QuestionId[]) {
    score += 500;
    const opened = slide.openedAt[q];
    const at = vote.at[q];
    if (opened && at) {
      const ratio = 1 - (at - opened) / (slide.duration * 1000);
      score += Math.round(500 * Math.min(1, Math.max(0, ratio)));
    }
  }
  return score;
}
