// Las 3 preguntas (estilo Kahoot) sobre los términos técnicos que se acaban de explicar.
// Aquí solo van el texto y las opciones: las respuestas son privadas (ver AnswerKey).
// Cada una va en su propio slide, justo después de su bloque de la charla.

export type QuestionId = 'q1' | 'q2' | 'q3';

export interface Question {
  id: QuestionId;
  /** bloque de la charla que evalúa */
  topic: string;
  text: string;
  options: { id: OptionId; label: string }[];
}

export type OptionId = 'a' | 'b' | 'c' | 'd';

/**
 * Respuestas correctas: NO viven en el código (el bundle es público y alguien podría
 * leerlas con DevTools). Están en Firestore en un documento que solo la presentadora
 * puede leer; al revelar, el deck publica únicamente la respuesta de esa pregunta.
 */
export type AnswerKey = Partial<Record<QuestionId, { correct: OptionId; explain: string }>>;

export function parseAnswerKey(raw: unknown): AnswerKey {
  const out: AnswerKey = {};
  if (!raw || typeof raw !== 'object') throw new Error('El archivo no es un JSON de respuestas');
  for (const q of ['q1', 'q2', 'q3'] as QuestionId[]) {
    const a = (raw as Record<string, { correct?: string; explain?: string }>)[q];
    if (!a) continue;
    if (!['a', 'b', 'c', 'd'].includes(a.correct ?? '')) throw new Error(`${q}: "correct" debe ser a, b, c o d`);
    out[q] = { correct: a.correct as OptionId, explain: String(a.explain ?? '').slice(0, 400) };
  }
  if (!Object.keys(out).length) throw new Error('No encontré q1, q2 ni q3');
  return out;
}

export const QUESTIONS: Record<QuestionId, Question> = {
  q1: {
    id: 'q1',
    topic: 'Renderizado',
    text: '¿Qué mide el CLS (Cumulative Layout Shift)?',
    options: [
      { id: 'a', label: 'Cuánto tarda la página en responder a un clic' },
      { id: 'b', label: 'El tiempo hasta que llega el primer token' },
      { id: 'c', label: 'Cuánto se mueve el contenido que ya estaba en pantalla' },
      { id: 'd', label: 'Cuántos nodos DOM crea la página' },
    ],
  },
  q2: {
    id: 'q2',
    topic: 'Reutilizar el DOM',
    text: '¿Para qué sirve una key estable en una lista que se genera en streaming?',
    options: [
      { id: 'a', label: 'Para que React reutilice el mismo nodo DOM en vez de recrearlo' },
      { id: 'b', label: 'Para que el lector de pantalla lea más rápido' },
      { id: 'c', label: 'Para ordenar los elementos alfabéticamente' },
      { id: 'd', label: 'Para guardar en caché la respuesta del modelo' },
    ],
  },
  q3: {
    id: 'q3',
    topic: 'Agentes y estado',
    text: 'En una web agéntica, ¿qué es el grounding?',
    options: [
      { id: 'a', label: 'Conectar el modelo a internet para que busque' },
      { id: 'b', label: 'Que el modelo solo elija datos reales de un catálogo verificado' },
      { id: 'c', label: 'Bajar la temperatura del modelo' },
      { id: 'd', label: 'Ejecutar el modelo en el servidor' },
    ],
  },
};

// Reacciones con íconos SVG (Lucide), no emojis.
export const REACTIONS = ['fire', 'clap', 'mind', 'idea', 'heart', 'rocket'] as const;
export type Reaction = (typeof REACTIONS)[number];
export const REACTION_META: Record<Reaction, { icon: string; label: string; color: string }> = {
  fire: { icon: 'flame', label: 'Fuego', color: '#ea4335' },
  clap: { icon: 'hand', label: 'Aplauso', color: '#f9ab00' },
  mind: { icon: 'brain', label: 'Mente volada', color: '#a142f4' },
  idea: { icon: 'lightbulb', label: 'Idea', color: '#f9ab00' },
  heart: { icon: 'heart', label: 'Me encanta', color: '#ea4335' },
  rocket: { icon: 'rocket', label: 'A producción', color: '#4285f4' },
};
