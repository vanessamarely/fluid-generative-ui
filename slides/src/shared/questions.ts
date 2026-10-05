// Las tres preguntas a la audiencia. Cada una vive en su propio slide.

export type QuestionId = 'q1' | 'q2' | 'q3';

export interface Question {
  id: QuestionId;
  kicker: string;
  text: string;
  options: { id: string; label: string; emoji: string }[];
}

export const QUESTIONS: Record<QuestionId, Question> = {
  q1: {
    id: 'q1',
    kicker: 'Pregunta 1 de 3',
    text: '¿Qué te frustra más de una interfaz generada por IA?',
    options: [
      { id: 'a', emoji: '🫨', label: 'Que el contenido salte mientras leo' },
      { id: 'b', emoji: '⏳', label: 'Mirar una pantalla en blanco esperando' },
      { id: 'c', emoji: '🧊', label: 'Que se congele cuando hago scroll o escribo' },
      { id: 'd', emoji: '🦻', label: 'Que no funcione con teclado o lector de pantalla' },
    ],
  },
  q2: {
    id: 'q2',
    kicker: 'Pregunta 2 de 3 · experimento',
    text: 'Mira las dos versiones en tu celular. ¿Cuál se sintió más rápida?',
    // Los ids son reales (naive / fluid) pero en el celular se muestran como A y B en orden aleatorio.
    options: [
      { id: 'naive', emoji: '🅰️', label: 'Render ingenuo' },
      { id: 'fluid', emoji: '🅱️', label: 'Render fluido' },
    ],
  },
  q3: {
    id: 'q3',
    kicker: 'Pregunta 3 de 3',
    text: 'Para personalizar tu UI con IA, ¿dónde correrías el modelo?',
    options: [
      { id: 'a', emoji: '💻', label: 'En el dispositivo (Gemini Nano)' },
      { id: 'b', emoji: '☁️', label: 'En la nube (Gemini API)' },
      { id: 'c', emoji: '🔀', label: 'Híbrido: local primero, nube de respaldo' },
      { id: 'd', emoji: '🤷', label: 'Depende… (¡cuéntame en el Q&A!)' },
    ],
  },
};

export const REACTIONS = ['🔥', '👏', '🤯', '💡', '❤️', '🚀'] as const;
export type Reaction = (typeof REACTIONS)[number];
