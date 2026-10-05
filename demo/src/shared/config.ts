export const REPO_OWNER = 'vanessamarely';
export const REPO_NAME = 'fluid-generative-ui';
export const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;

/**
 * Key de Google AI Studio para el respaldo en la nube (Gemini API).
 * Viaja en el JS del navegador: RESTRÍNGELA en Google Cloud Console
 * (solo "Generative Language API" y solo los referrers de la demo).
 */
export const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || '';
export const GEMINI_MODEL = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || 'gemini-3.5-flash-lite';
export const hasCloud = Boolean(GEMINI_API_KEY);

/** URLs públicas: los slides enlazan a la demo y viceversa (en local, los puertos de Vite). */
export const SLIDES_URL = import.meta.env.DEV ? 'http://localhost:5173' : (import.meta.env.VITE_SLIDES_URL as string) || '/';
export const DEMO_URL = import.meta.env.DEV ? 'http://localhost:5174' : (import.meta.env.VITE_DEMO_URL as string) || '/';
