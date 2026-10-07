import { initializeApp } from 'firebase/app';
import {
  GithubAuthProvider,
  getAdditionalUserInfo,
  getAuth,
  inMemoryPersistence,
  linkWithPopup,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { firebaseConfig, PRESENTER_GITHUB_ID, SESSION_ID } from './config';
import { getFirebaseApp } from './firebase';
import { emptySlide, type AudienceQuestion, type CardData, type Player, type Realtime, type SlideState, type VoteRecord, type Votes } from './realtime';
import type { QuestionId, Reaction } from './questions';

const QS: QuestionId[] = ['q1', 'q2', 'q3'];
const ms = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : typeof v === 'number' ? v : undefined);

export async function createFirebaseRealtime(): Promise<Realtime> {
  const app = await getFirebaseApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  // Todo el público entra anónimo: sin formularios, sin datos personales.
  await new Promise<User>((resolve, reject) => {
    const off = onAuthStateChanged(auth, (u) => {
      if (u) {
        off();
        resolve(u);
      }
    });
    signInAnonymously(auth).catch((err) => {
      if (!auth.currentUser) reject(err);
    });
  });

  const session = doc(db, 'sessions', SESSION_ID);
  const sub = (name: string) => collection(session, name);
  const uid = () => auth.currentUser!.uid;

  return {
    mode: 'firebase',
    uid,

    async patchSlide(s) {
      await setDoc(session, { ...s, updatedAt: serverTimestamp() }, { merge: true });
    },
    async openQuestion(q) {
      // Hora del SERVIDOR: la misma base que los timestamps de los votos → puntaje justo.
      await setDoc(session, { openedAt: { [q]: serverTimestamp() } }, { merge: true });
    },
    onSlide(cb) {
      return onSnapshot(session, (snap) => {
        const data = (snap.data({ serverTimestamps: 'estimate' }) ?? {}) as Record<string, unknown>;
        const openedAt: SlideState['openedAt'] = {};
        const raw = (data.openedAt ?? {}) as Record<string, unknown>;
        for (const q of QS) if (raw[q]) openedAt[q] = ms(raw[q]);
        cb({ ...emptySlide(), ...(data as Partial<SlideState>), openedAt });
      });
    },

    async join(name) {
      await setDoc(doc(sub('players'), uid()), { name, at: serverTimestamp() });
    },
    async setLike(on) {
      const ref = doc(sub('likes'), uid());
      if (on) await setDoc(ref, { at: serverTimestamp() });
      else await deleteDoc(ref);
    },
    async vote(q, option) {
      await setDoc(doc(sub('votes'), uid()), { [q]: option, [`${q}At`]: serverTimestamp() }, { merge: true });
    },
    onMyVotes(cb) {
      return onSnapshot(doc(sub('votes'), uid()), (snap) => {
        const d = snap.data() ?? {};
        const votes: Votes = {};
        for (const q of QS) if (d[q]) votes[q] = d[q];
        cb(votes);
      });
    },
    async react(emoji) {
      await setDoc(doc(sub('reactions'), uid()), { emoji, n: Math.floor(Math.random() * 1e9), at: serverTimestamp() });
    },
    async ask(q) {
      await addDoc(sub('questions'), { ...q, uid: uid(), at: serverTimestamp() });
    },
    async publishCard(card) {
      await setDoc(doc(sub('cards'), uid()), { ...card, createdAt: serverTimestamp(), hidden: false });
    },

    onPlayers(cb) {
      return onSnapshot(sub('players'), (snap) => cb(snap.docs.map((d): Player => ({ id: d.id, name: d.data().name }))));
    },
    onLikes(cb) {
      return onSnapshot(sub('likes'), (snap) => cb(new Set(snap.docs.map((d) => d.id))));
    },
    onVotes(cb) {
      return onSnapshot(sub('votes'), (snap) => {
        cb(
          snap.docs.map((d) => {
            const data = d.data({ serverTimestamps: 'estimate' });
            const rec: VoteRecord = { uid: d.id, votes: {}, at: {} };
            for (const q of QS) {
              if (data[q]) rec.votes[q] = data[q];
              if (data[`${q}At`]) rec.at[q] = ms(data[`${q}At`]);
            }
            return rec;
          }),
        );
      });
    },
    onReaction(cb) {
      let first = true;
      return onSnapshot(sub('reactions'), (snap) => {
        if (first) {
          first = false; // ignoramos el estado inicial: solo reacciones nuevas
          return;
        }
        for (const change of snap.docChanges()) {
          if (change.type !== 'removed') cb(change.doc.data().emoji as Reaction);
        }
      });
    },
    onCards(cb) {
      const q = query(sub('cards'), orderBy('createdAt', 'desc'), limit(80));
      return onSnapshot(q, (snap) =>
        cb(
          snap.docs.map((d) => {
            const data = d.data({ serverTimestamps: 'estimate' });
            return { ...(data as CardData), id: d.id, createdAt: ms(data.createdAt) ?? Date.now() };
          }),
        ),
      );
    },
    onQuestions(cb) {
      const q = query(sub('questions'), orderBy('at', 'asc'), limit(100));
      return onSnapshot(
        q,
        (snap) =>
          cb(
            snap.docs.map((d) => {
              const data = d.data({ serverTimestamps: 'estimate' });
              return { ...(data as AudienceQuestion), id: d.id, at: ms(data.at) ?? Date.now() };
            }),
          ),
        () => cb([]), // sin permiso (público): no hay nada que mostrar
      );
    },
    async updateQuestion(id, patch) {
      await updateDoc(doc(sub('questions'), id), patch);
    },
    async removeQuestion(id) {
      await deleteDoc(doc(sub('questions'), id));
    },
    async setCardHidden(id, hidden) {
      await updateDoc(doc(sub('cards'), id), { hidden });
    },

    async signInPresenter() {
      const provider = new GithubAuthProvider();
      const current = auth.currentUser;
      if (current?.providerData.some((p) => p.providerId === 'github.com')) {
        return current.providerData.some((p) => p.providerId === 'github.com' && p.uid === PRESENTER_GITHUB_ID);
      }
      try {
        if (current) await linkWithPopup(current, provider);
      } catch (err) {
        // Esa cuenta de GitHub ya estaba vinculada a otro uid: entramos con ella.
        const cred = GithubAuthProvider.credentialFromError(err as never);
        if (!cred) throw err;
        await signInWithCredential(auth, cred);
      }
      await auth.currentUser?.getIdToken(true);
      return true;
    },

    isPresenterSession: () => Boolean(auth.currentUser?.providerData.some((p) => p.providerId === 'github.com' && p.uid === PRESENTER_GITHUB_ID)),
    async loadAnswers() {
      // Las reglas solo permiten leer este documento a la presentadora.
      const snap = await getDoc(doc(session, 'private', 'answers'));
      return snap.exists() ? (snap.data() as never) : null;
    },
    async saveAnswers(a) {
      await setDoc(doc(session, 'private', 'answers'), a);
    },

    async githubTokenForStar() {
      // App de Firebase aparte y sin persistencia: no mezclamos la identidad de GitHub con el
      // usuario anónimo. Usamos el token una vez para dar ⭐ y borramos el usuario temporal.
      const tmp = initializeApp(firebaseConfig, 'star-' + Date.now());
      const tmpAuth = getAuth(tmp);
      await setPersistence(tmpAuth, inMemoryPersistence);
      const provider = new GithubAuthProvider();
      provider.addScope('public_repo');
      const result = await signInWithPopup(tmpAuth, provider);
      const token = GithubAuthProvider.credentialFromResult(result)?.accessToken;
      const info = getAdditionalUserInfo(result);
      // Solo borramos usuarios recién creados aquí (nunca una cuenta existente, p. ej. la de la presentadora).
      if (info?.isNewUser) await result.user.delete().catch(() => tmpAuth.signOut());
      else await tmpAuth.signOut();
      return token ? { token, login: info?.username ?? '' } : null;
    },
  };
}
