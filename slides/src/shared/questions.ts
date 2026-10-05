// Las 3 preguntas (estilo Kahoot) sobre lo que se acaba de explicar.
// Cada una va en su propio slide, justo después de su bloque de la charla.

export type QuestionId = 'q1' | 'q2' | 'q3';

export interface Question {
  id: QuestionId;
  /** bloque de la charla que evalúa */
  topic: string;
  text: string;
  options: { id: 'a' | 'b' | 'c' | 'd'; label: string }[];
  correct: 'a' | 'b' | 'c' | 'd';
  /** una línea que se muestra al revelar */
  explain: string;
}

export const QUESTIONS: Record<QuestionId, Question> = {
  q1: {
    id: 'q1',
    topic: 'Renderizado',
    text: '¿Qué mide el CLS (Cumulative Layout Shift)?',
    options: [
      { id: 'a', label: 'El tiempo hasta que llega el primer token' },
      { id: 'b', label: 'Cuánto se mueve el contenido que ya estaba en pantalla' },
      { id: 'c', label: 'Cuántos nodos DOM crea la página' },
      { id: 'd', label: 'Cuánto tarda la página en responder a un clic' },
    ],
    correct: 'b',
    explain: 'CLS mide los saltos inesperados de lo que ya estaba visible (objetivo ≤ 0,1). Reservar el espacio con slots de altura final lo deja en ≈ 0. Lo del clic es INP.',
  },
  q2: {
    id: 'q2',
    topic: 'Reutilizar el DOM',
    text: '¿Para qué sirve una key estable en una lista que se genera en streaming?',
    options: [
      { id: 'a', label: 'Para ordenar los elementos alfabéticamente' },
      { id: 'b', label: 'Para guardar en caché la respuesta del modelo' },
      { id: 'c', label: 'Para que React reutilice el mismo nodo DOM en vez de recrearlo' },
      { id: 'd', label: 'Para que el lector de pantalla lea más rápido' },
    ],
    correct: 'c',
    explain: 'Con key = id del lugar (no la posición), React mueve o parchea el nodo existente: 156 nodos en vez de 17.913, y no se pierden foco ni clics.',
  },
  q3: {
    id: 'q3',
    topic: 'Agentes y estado',
    text: 'En una web agéntica, ¿qué es el grounding?',
    options: [
      { id: 'a', label: 'Conectar el modelo a internet para que busque' },
      { id: 'b', label: 'Bajar la temperatura del modelo' },
      { id: 'c', label: 'Ejecutar el modelo en el servidor' },
      { id: 'd', label: 'Que el modelo solo elija datos reales de un catálogo verificado' },
    ],
    correct: 'd',
    explain: 'Grounding: el modelo solo referencia ids de un catálogo real (lugares, hospedajes, precios). Con reglas en código y el verificador, nada inventado ni peligroso llega a la persona.',
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
