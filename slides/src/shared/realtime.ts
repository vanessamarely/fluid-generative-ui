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
import type { AnswerKey, QuestionId, Reaction } from './questions';

export type LiveKind = 'content' | 'join' | 'poll' | 'cards' | 'podium' | 'qa' | 'demo' | 'end';

export interface PollResult {
  counts: Record<string, number>;
  total: number;
}

/** Resumen del slide que ven los celulares (espejo ligero: texto, no captura). */
export interface SlideDigest {
  eyebrow?: string;
  lede?: string;
  points: { h?: string; p?: string; tone?: string }[];
  code?: { file?: string; text: string };
}

export interface AudienceQuestion {
  id: string;
  uid: string;
  name: string;
  text: string;
  slide: string;
  at: number;
  /** Lo completa la IA en el deck de la presentadora */
  status?: 'answered' | 'error' | 'blocked';
  answer?: string;
  ref?: string;
  confidence?: 'alta' | 'media' | 'baja';
  engine?: 'nano' | 'cloud';
  /** ¿Se muestra en el slide de Q&A? (la presentadora puede ocultarla) */
  show?: boolean;
}

/** Pregunta + respuesta aprobada que se proyecta y llega a los celulares. */
export interface QaItem {
  q: string;
  a: string;
  name: string;
  ref: string;
  engine: string;
}

export interface SlideState {
  index: number;
  total: number;
  label: string;
  title: string;
  kind: LiveKind;
  qid?: QuestionId | null;
  tip?: string | null;
  digest?: SlideDigest | null;
  /** Preguntas del público ya respondidas y aprobadas */
  qa?: QaItem[];
  /** segundos que dura cada pregunta */
  duration: number;
  /** epoch ms (hora del servidor) en que se abrió cada pregunta */
  openedAt: Partial<Record<QuestionId, number>>;
  revealed: Partial<Record<QuestionId, boolean>>;
  results: Partial<Record<QuestionId, PollResult>>;
  podium: { name: string; score: number; code?: string }[];
  players: number;
  /** respuestas YA reveladas (la presentadora las publica una por una al revelar) */
  answers: AnswerKey;
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
  answers: {},
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
  /** Apodos únicos: reserva el apodo para este uid. false si ya es de otra persona. */
  reserveName(name: string): Promise<boolean>;
  /** Cuáles de estos apodos ya están reservados. */
  takenNames(names: string[]): Promise<Set<string>>;
  setLike(on: boolean): Promise<void>;
  vote(q: QuestionId, option: string): Promise<void>;
  onMyVotes(cb: (v: Votes) => void): Unsub;
  react(emoji: Reaction): Promise<void>;
  /** Duda para la presentadora (no se proyecta). */
  ask(q: { name: string; text: string; slide: string }): Promise<void>;
  publishCard(card: Omit<CardData, 'id' | 'createdAt' | 'hidden'>): Promise<void>;

  // Solo el deck agrega
  onPlayers(cb: (players: Player[]) => void): Unsub;
  onLikes(cb: (uids: Set<string>) => void): Unsub;
  onVotes(cb: (all: VoteRecord[]) => void): Unsub;
  onReaction(cb: (emoji: Reaction) => void): Unsub;
  onCards(cb: (cards: CardData[]) => void): Unsub;
  /** Solo presentadora (las reglas no dejan leerlas a nadie más). */
  onQuestions(cb: (qs: AudienceQuestion[]) => void, onError?: (msg: string) => void): Unsub;
  removeQuestion(id: string): Promise<void>;
  updateQuestion(id: string, patch: Partial<AudienceQuestion>): Promise<void>;
  setCardHidden(id: string, hidden: boolean): Promise<void>;

  /** Solo presentadora: login con GitHub para poder escribir la sesión. */
  signInPresenter(): Promise<boolean>;
  /** ¿La sesión actual ya es la de la presentadora? (las reglas de Firestore deciden de verdad) */
  isPresenterSession(): boolean;
  /** Respuestas privadas: solo la presentadora puede leerlas o escribirlas. */
  loadAnswers(): Promise<AnswerKey | null>;
  saveAnswers(a: AnswerKey): Promise<void>;
  /** Login opcional con GitHub (scope public_repo) para dar ⭐. No guarda la identidad. */
  githubTokenForStar(): Promise<{ token: string; login: string } | null>;
}

/** Clave de un apodo: sin tildes ni mayúsculas ("Colibrí Ágil" → "colibri-agil"). */
export const nameKey = (n: string) =>
  n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

let instance: Promise<Realtime> | null = null;

export function getRealtime(): Promise<Realtime> {
  if (!instance) {
    const local = () => import('./realtime-local').then((m) => m.createLocalRealtime());
    instance = hasFirebase
      ? import('./realtime-firebase')
          .then((m) => m.createFirebaseRealtime())
          .catch((err) => {
            // Si Firebase falla (sin red, Auth sin habilitar…), seguimos en modo local para no romper el deck.
            console.warn('[live] Firebase no disponible, modo local:', err);
            return local();
          })
      : local();
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

/** Puntos estilo Kahoot: solo suma quien ACIERTA (500 + bono por rapidez); like +100; card +300. */
export function scoreFor(
  vote: VoteRecord | undefined,
  slide: Pick<SlideState, 'openedAt' | 'duration'>,
  liked: boolean,
  hasCard: boolean,
  answers: AnswerKey,
): number {
  let score = (liked ? 100 : 0) + (hasCard ? 300 : 0);
  if (!vote) return score;
  for (const q of Object.keys(vote.votes) as QuestionId[]) {
    if (!answers[q] || vote.votes[q] !== answers[q]!.correct) continue;
    score += 500;
    const opened = slide.openedAt[q];
    const at = vote.at[q];
    if (opened && at) {
      // Bono por rapidez (sin timer visible): máximo al instante, 0 a los 60 s.
      const ratio = 1 - (at - opened) / (Math.max(slide.duration, 60) * 1000);
      score += Math.round(500 * Math.min(1, Math.max(0, ratio)));
    }
  }
  return score;
}

/** Aciertos según las respuestas ya reveladas. */
export const correctCount = (votes: Votes, answers: AnswerKey) =>
  (Object.keys(votes) as QuestionId[]).filter((q) => answers[q] && votes[q] === answers[q]!.correct).length;
