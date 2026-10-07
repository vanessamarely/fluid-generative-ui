// Respuestas con IA para las preguntas del público. Corre SOLO en el deck de la presentadora.
//  · Local primero: Gemini Nano (Prompt API). Gratis, sin red y las preguntas no salen del equipo.
//  · Respaldo opcional: Gemini API con una key que la presentadora pega en SU navegador
//    (se guarda en localStorage; nunca va en el bundle público).
//  · Grounding: el modelo solo puede apoyarse en el contenido de los slides y debe citar uno
//    (enum de labels), igual que Rumbo solo puede elegir lugares del catálogo.

export interface QaAnswer {
  appropriate: boolean;
  relevant: boolean;
  answer: string;
  slide: string;
  confidence: 'alta' | 'media' | 'baja';
}

interface LanguageModelSession {
  prompt(input: string, opts?: { responseConstraint?: object; signal?: AbortSignal }): Promise<string>;
  clone(): Promise<LanguageModelSession>;
  destroy(): void;
}
interface LanguageModelStatic {
  availability(opts?: object): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>;
  create(opts?: object): Promise<LanguageModelSession>;
}
const LM = (globalThis as { LanguageModel?: LanguageModelStatic }).LanguageModel;
const LANG_OPTS = {
  expectedInputs: [{ type: 'text', languages: ['es', 'en'] }],
  expectedOutputs: [{ type: 'text', languages: ['es'] }],
};
const KEY_STORE = 'fgui.qa.geminiKey';
const MODEL = 'gemini-3.5-flash-lite';

export const geminiKey = () => {
  try {
    return localStorage.getItem(KEY_STORE) ?? '';
  } catch {
    return '';
  }
};
export const setGeminiKey = (k: string) => {
  try {
    if (k) localStorage.setItem(KEY_STORE, k);
    else localStorage.removeItem(KEY_STORE);
  } catch {
    /* noop */
  }
};

export async function qaEngine(): Promise<'nano' | 'cloud' | null> {
  if (LM) {
    try {
      if ((await LM.availability(LANG_OPTS)) !== 'unavailable') return 'nano';
    } catch {
      /* sigue */
    }
  }
  return geminiKey() ? 'cloud' : null;
}

export function createAnswerer(context: { label: string; text: string }[]) {
  const labels = [...new Set(context.map((c) => c.label))];
  const schema = {
    type: 'object',
    properties: {
      appropriate: { type: 'boolean' },
      relevant: { type: 'boolean' },
      answer: { type: 'string' },
      slide: { type: 'string', enum: [...labels, 'Ninguno'] },
      confidence: { type: 'string', enum: ['alta', 'media', 'baja'] },
    },
    required: ['appropriate', 'relevant', 'answer', 'slide', 'confidence'],
  };
  const system = `Eres la asistente de Q&A de la charla técnica "IA rápida, UI fluida" (DevFest Santo Domingo 2026, track Web) de Vanessa Aristizabal.
Responde en español, en 2 a 4 frases claras y concretas, para desarrolladores web.
Apóyate SOLO en el contenido de la charla que aparece abajo y en conocimiento web estándar y verificable. Si no lo sabes, dilo; no inventes APIs, cifras ni fechas.
"slide" debe ser el slide de la charla que mejor respalda la respuesta, o "Ninguno".
"relevant" = false si la pregunta no tiene que ver con la charla, la web, la IA o el desarrollo (responde amablemente igual, en una frase).
"appropriate" = false si la pregunta es ofensiva, personal o spam; en ese caso "answer" = "".
El repositorio de la charla es github.com/vanessamarely/fluid-generative-ui (deck + demo Rumbo).

CONTENIDO DE LA CHARLA (slide: idea clave):
${context.map((c) => `- ${c.label}: ${c.text}`).join('\n')}`;

  let base: Promise<LanguageModelSession> | null = null;
  const nano = async (q: string) => {
    base ??= LM!.create({ ...LANG_OPTS, initialPrompts: [{ role: 'system', content: system }] });
    // clone(): cada pregunta parte del mismo contexto sin arrastrar las anteriores.
    const s = await (await base).clone();
    try {
      return await s.prompt(`Pregunta del público: ${q}`, { responseConstraint: schema });
    } finally {
      s.destroy();
    }
  };
  const cloud = async (q: string) => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey() },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: `Pregunta del público: ${q}` }] }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0.3 },
      }),
    });
    if (!res.ok) throw new Error(`Gemini API ${res.status}`);
    const json = await res.json();
    return (json.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
  };

  return async (question: string): Promise<QaAnswer & { engine: 'nano' | 'cloud' }> => {
    const engine = await qaEngine();
    if (!engine) throw new Error('Sin IA disponible (ni Gemini Nano ni key de Gemini).');
    const raw = engine === 'nano' ? await nano(question) : await cloud(question);
    const a = JSON.parse(raw) as QaAnswer;
    // Validación en código (no confiamos ciegamente en el modelo).
    return {
      appropriate: a.appropriate !== false,
      relevant: a.relevant !== false,
      answer: String(a.answer ?? '').trim().slice(0, 700),
      slide: labels.includes(a.slide) ? a.slide : 'Ninguno',
      confidence: ['alta', 'media', 'baja'].includes(a.confidence) ? a.confidence : 'baja',
      engine,
    };
  };
}
