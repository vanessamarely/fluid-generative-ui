// Graba los clips de la demo para los slides (y como plan B si falla la red en vivo)
// y los traces de rendimiento que se abren en Chrome DevTools → Performance.
//
// Requisitos: los dos servidores de desarrollo corriendo
//   npm run dev:demo     (http://localhost:5174)
//   npm run dev:slides   (http://localhost:5173)
// Uso:
//   node scripts/record-clips.mjs            → todos los clips + traces
//   node scripts/record-clips.mjs compare    → solo uno
//
// Usa el Chrome instalado (channel: 'chrome'): no descarga navegadores.
import { chromium } from 'playwright';
import { mkdir, rename, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const DEMO = process.env.DEMO_URL ?? 'http://localhost:5174';
const SLIDES = process.env.SLIDES_URL ?? 'http://localhost:5173';
const OUT = new URL('../slides/public/clips/', import.meta.url).pathname;
const TRACES = new URL('../docs/traces/', import.meta.url).pathname;
const TMP = join(OUT, '.tmp');
const only = process.argv[2];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (s) => encodeURIComponent(s);

const CLIPS = {
  // Mismo stream → v1 ingenua vs v2 fluida (con métricas reales)
  async compare(page) {
    await page.goto(`${DEMO}/compare.html`);
    await page.getByRole('button', { name: /Mismo stream/ }).waitFor();
    await page.waitForFunction(() => !document.querySelector('.hero-cta')?.disabled, null, { timeout: 15000 });
    await wait(800);
    await page.getByRole('button', { name: /Mismo stream/ }).click();
    await wait(16000);
  },

  // El verificador atrapa "Habitaciones La Ganga" y el bucle lo corrige
  async 'rumbo-trap'(page) {
    await page.goto(`${DEMO}/?engine=mock&speed=80&q=${q('Lo más barato posible en Santo Domingo, historia y comida')}`);
    await wait(900);
    // Esperamos la tarjeta bloqueada desde el inicio (aparece ~2 s antes del bucle de corrección).
    const blocked = page.locator('.lodging-card[data-blocked]').first().waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: 'Planificar con IA' }).click();
    await wait(600);
    await smoothScroll(page, '.workflow', 0);
    await wait(2500);
    await smoothScroll(page, '.section-title', -40);
    await blocked;
    await wait(4500);
    await smoothScroll(page, '.checks', -200);
    await wait(3500);
  },

  // Refinar sin empezar de cero: los nodos que siguen sirviendo se reutilizan
  async 'rumbo-refine'(page) {
    await page.goto(`${DEMO}/?engine=mock&speed=120&q=${q('Playa y naturaleza en Samaná, algo tranquilo')}`);
    await wait(900);
    await page.getByRole('button', { name: 'Planificar con IA' }).click();
    await page.locator('.wf-node[data-status="done"]').nth(4).waitFor({ timeout: 30000 });
    await smoothScroll(page, '.refine', -80);
    await wait(800);
    await page.getByRole('button', { name: 'Agrega un día de playa' }).click();
    await wait(9000);
  },

  // Panel contextual: tocas un día o un lugar y las sugerencias cambian en tiempo real
  async 'rumbo-context'(page) {
    await page.goto(`${DEMO}/?engine=mock&speed=160&q=${q('Aventura en la montaña: rafting y cascadas en Jarabacoa')}`);
    await wait(900);
    await page.getByRole('button', { name: 'Planificar con IA' }).click();
    await page.locator('.wf-node[data-status="done"]').nth(4).waitFor({ timeout: 30000 });
    await smoothScroll(page, '.trip-header', -70);
    await wait(600);
    await page.locator('.day-head').nth(1).click();
    await wait(2500);
    await page.locator('.place button').nth(2).click();
    await wait(2500);
    await page.locator('#cp-q').fill('¿Es seguro ir con niños?');
    await page.getByRole('button', { name: 'Preguntar' }).click();
    await wait(3000);
    await page.getByRole('button', { name: 'Más personas' }).click();
    await wait(2500);
  },

  // WebMCP: un "agente" llama a las tools; elegir hospedaje pide confirmación humana
  async 'rumbo-webmcp'(page) {
    await page.goto(`${DEMO}/?engine=mock&speed=140`);
    await wait(900);
    await page.locator('.tool-console summary').click();
    await wait(800);
    await page.locator('.tc-tools button', { hasText: 'plan_trip()' }).click();
    await page.locator('.wf-node[data-status="done"]').nth(4).waitFor({ timeout: 30000 });
    await wait(1200);
    await page.locator('.tc-tools button', { hasText: 'select_lodging()' }).click();
    await page.locator('.confirm-box').waitFor();
    await wait(1800);
    await page.getByRole('button', { name: 'Permitir' }).click();
    await wait(2500);
  },

  // App del público: entrar, responder y ver el resultado (modo local: el deck la maneja)
  async 'live-quiz'(page, context) {
    const deck = await context.newPage();
    await deck.goto(`${SLIDES}/?local`);
    await deck.evaluate(() => localStorage.removeItem('fgui.local.db'));
    await deck.reload();
    await wait(1200);
    await page.goto(`${SLIDES}/live/?local`);
    await wait(1500);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await wait(1200);
    await deck.evaluate(() => {
      const st = document.querySelector('deck-stage');
      st.goTo([...st.children].findIndex((s) => s.dataset?.q === 'q1'));
    });
    await wait(2500);
    await page.locator('.answer[data-opt="b"]').click();
    await wait(2500);
    await deck.evaluate(() => document.querySelector('[data-deck-active] [data-reveal]')?.click());
    await wait(3500);
    await deck.close();
  },
};

const MOBILE = new Set(['live-quiz']);

async function smoothScroll(page, selector, offset) {
  await page.evaluate(
    ([sel, off]) => {
      const el = document.querySelector(sel);
      if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY + off, behavior: 'smooth' });
    },
    [selector, offset],
  );
  await wait(900);
}

async function recordClip(browser, name) {
  const mobile = MOBILE.has(name);
  const size = mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 };
  const context = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
    recordVideo: { dir: TMP, size },
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  console.log(`● grabando ${name}…`);
  try {
    await CLIPS[name](page, context);
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
  }
  const video = page.video();
  await context.close();
  if (video) {
    await rename(await video.path(), join(OUT, `${name}.webm`));
    console.log(`  ✓ slides/public/clips/${name}.webm`);
  }
}

// Traces para DevTools → Performance (arrastra el .json al panel).
// Incluyen las pistas propias "Rumbo · agentes" (performance.measure + detail.devtools).
async function recordTraces(browser) {
  await mkdir(TRACES, { recursive: true });
  for (const render of ['naive', 'fluid']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    console.log(`● trace ${render}…`);
    await browser.startTracing(page, { path: join(TRACES, `rumbo-${render}.json`), screenshots: true });
    await page.goto(`${DEMO}/?engine=mock&speed=90&render=${render}&autorun&q=${q('Lo más barato posible en Santo Domingo, historia y comida')}`);
    await page.locator('.wf-node[data-status="done"]').nth(4).waitFor({ timeout: 40000 }).catch(() => undefined);
    await wait(800);
    await browser.stopTracing();
    await context.close();
    console.log(`  ✓ docs/traces/rumbo-${render}.json`);
  }
}

await mkdir(TMP, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const names = only ? [only] : Object.keys(CLIPS);
  for (const name of names) {
    if (name === 'traces') continue;
    if (!CLIPS[name]) throw new Error(`Clip desconocido: ${name}. Opciones: ${Object.keys(CLIPS).join(', ')}, traces`);
    await recordClip(browser, name);
  }
  if (!only || only === 'traces') await recordTraces(browser);
} finally {
  await browser.close();
  for (const f of await readdir(TMP).catch(() => [])) await rm(join(TMP, f));
  await rm(TMP, { recursive: true, force: true });
}
