export const REPO_OWNER = 'vanessamarely';
export const REPO_NAME = 'fluid-generative-ui';
export const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;

export const SESSION_ID = import.meta.env.VITE_SESSION_ID || 'devfest-sdq-2026';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const hasFirebase = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
export const TEXT_MODEL = (import.meta.env.VITE_GEMINI_TEXT_MODEL as string) || 'gemini-2.5-flash-lite';

/** URL absoluta de una página del proyecto (sirve igual en local y desplegado). */
export function pageUrl(path: string): string {
  return new URL(path, location.origin).toString();
}

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** URLs públicas: los slides enlazan a la demo y viceversa (en local, los puertos de Vite). */
export const SLIDES_URL = import.meta.env.DEV ? 'http://localhost:5173' : (import.meta.env.VITE_SLIDES_URL as string) || '/';
export const DEMO_URL = import.meta.env.DEV ? 'http://localhost:5174' : (import.meta.env.VITE_DEMO_URL as string) || '/';
