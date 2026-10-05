import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { firebaseConfig, RECAPTCHA_SITE_KEY } from './config';

let app: FirebaseApp | null = null;

export async function getFirebaseApp(): Promise<FirebaseApp> {
  if (app) return app;
  app = getApps()[0] ?? initializeApp(firebaseConfig);
  if (RECAPTCHA_SITE_KEY) {
    // App Check protege Firestore y Firebase AI Logic de llamadas que no vienen de esta web.
    const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  }
  return app;
}
