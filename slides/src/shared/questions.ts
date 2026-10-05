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
    text: '¿Qué técnica evita que el contenido generado empuje lo que ya estás leyendo?',
    options: [
      { id: 'a', label: 'Poner con innerHTML el HTML que devuelve el modelo' },
      { id: 'b', label: 'Reservar el espacio con slots de altura final' },
      { id: 'c', label: 'Un spinner arriba hasta que termine de generar' },
      { id: 'd', label: 'content-visibility: auto mientras se genera' },
    ],
    correct: 'b',
    explain: 'Los slots con la altura final (min-height, aspect-ratio, line-clamp) dejan el CLS en ≈ 0. El spinner que desaparece y content-visibility mientras generas SÍ provocan saltos.',
  },
  q2: {
    id: 'q2',
    topic: 'Reutilizar el DOM',
    text: 'Mismo stream: ¿por qué la v1 creó 17.913 nodos y la v2 solo 156?',
    options: [
      { id: 'a', label: 'La v2 usa un modelo más rápido' },
      { id: 'b', label: 'La v2 genera menos texto' },
      { id: 'c', label: 'La v1 recrea todo el DOM en cada token; la v2 reutiliza nodos con claves estables' },
      { id: 'd', label: 'La v1 no usa React' },
    ],
    correct: 'c',
    explain: 'Mismo modelo, mismo texto, mismo React. La diferencia es innerHTML por token vs. claves estables por id + suscripción por ítem.',
  },
  q3: {
    id: 'q3',
    topic: 'Agentes y estado',
    text: 'La IA sugiere un hostal de $12, 2,1★ y sin licencia. ¿Qué hace una web agéntica responsable?',
    options: [
      { id: 'a', label: 'Mostrarlo: es justo lo que pidió la persona' },
      { id: 'b', label: 'Pedirle al modelo en el prompt que "tenga cuidado"' },
      { id: 'c', label: 'Ocultar todos los hospedajes baratos' },
      { id: 'd', label: 'Verificar con reglas en código, corregir y que la persona decida' },
    ],
    correct: 'd',
    explain: 'La IA propone, el código verifica, la persona decide: grounding + reglas deterministas + bucle de corrección + confirmación humana.',
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
