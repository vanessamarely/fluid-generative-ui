// Controlador del deck: pie de página, tema, pantalla completa, menú, three.js, clips
// y la conexión en vivo con el público.
import {
  ArrowUpRight,
  Play,
  Camera,
  CirclePlay,
  Briefcase,
  GitBranch,
  Brain,
  Circle,
  Clock,
  CloudOff,
  Diamond,
  Hand,
  Heart,
  Lightbulb,
  Map as MapIcon,
  Rocket,
  ShieldCheck,
  Sparkles,
  Square,
  Star,
  Triangle,
  Trophy,
  Wallet,
  Zap,
  Lock,
  Flame,
  RotateCcw,
  createIcons,
} from 'lucide';
import { DEMO_URL, REPO_URL } from '../shared/config';
import { injectCharacters } from './characters';
import { animateNotchLogos } from './gdg-logo';
import { initLive } from './live';
import { ThreeStage } from './three-stage';

type DeckStage = HTMLElement & { goTo(i: number): void; next(): void; prev(): void };

injectCharacters();
void animateNotchLogos().then(() => dispatchEvent(new Event('tweakchange')));


const stage = document.querySelector('deck-stage') as DeckStage;
const sections = [...stage.querySelectorAll<HTMLElement>(':scope > section')];
const total = sections.length;
const pad = (n: number) => String(n).padStart(2, '0');

// ── Pie de página con contador ───────────────────────────────────────
sections.forEach((s, i) => {
  if (s.classList.contains('cover') && i === 0) return;
  s.insertAdjacentHTML(
    'beforeend',
    `<div class="footer"><span>Instagram <b>@vanessamarelycode</b> · YouTube <b>vanessamarely</b> · GitHub <b>vanessamarely</b></span><span>${pad(i + 1)} / ${total}</span></div>`,
  );
});

// ── Enlaces a la demo ────────────────────────────────────────────────
document.querySelectorAll<HTMLAnchorElement>('[data-demo-link]').forEach((a) => (a.href = new URL(a.dataset.demoLink!, DEMO_URL).toString()));

// ── Tema (claro DevFest / oscuro DevFest) ────────────────────────────
const three = new ThreeStage();
const isDark = () => document.documentElement.dataset.theme === 'dark';
function setTheme(dark: boolean) {
  if (dark) document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem('deck.theme', dark ? 'dark' : 'light');
  } catch {
    /* noop */
  }
  three.setTheme(dark);
  dispatchEvent(new Event('tweakchange')); // deck-stage re-sincroniza las miniaturas
}
three.setTheme(isDark());
document.fonts?.ready.then(() => dispatchEvent(new Event('tweakchange')));

// ── Pantalla completa / panel lateral ────────────────────────────────
const toggleFullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined);
// deck-stage escucha este mensaje para mostrar/ocultar las miniaturas (y lo recuerda).
let railOn = true;
try {
  railOn = localStorage.getItem('deck-stage.railVisible') !== '0';
} catch {
  /* noop */
}
const toggleRail = () => {
  railOn = !railOn;
  postMessage({ type: '__deck_rail_visible', on: railOn }, location.origin);
};

// ── Cambio de slide: three.js, clips, menú ───────────────────────────
let current = 0;
function onSlide(index: number, slide: HTMLElement) {
  current = index;
  const slot = slide.querySelector<HTMLElement>('.three-slot');
  three.attach(slot, (slide.dataset.three as 'stream' | 'calm' | 'orbit') ?? 'stream');

  // Clips: se cargan perezosamente y solo se reproducen en el slide activo.
  document.querySelectorAll<HTMLVideoElement>('.clip video').forEach((v) => {
    if (slide.contains(v)) {
      if (!v.src && v.dataset.src) {
        v.src = v.dataset.src;
        v.addEventListener('loadeddata', () => v.parentElement?.querySelector('.ph')?.remove(), { once: true });
        v.addEventListener('error', () => v.remove(), { once: true });
      }
      v.play().catch(() => undefined);
    } else v.pause();
  });
  renderMenuList();
}
stage.addEventListener('slidechange', (e) => {
  const { index, slide } = (e as CustomEvent).detail as { index: number; slide: HTMLElement };
  onSlide(index, slide);
});

// ── Menú hamburguesa (siempre arriba a la derecha) ───────────────────
const menuBtn = document.querySelector<HTMLButtonElement>('.deck-menu-btn')!;
const menu = document.querySelector<HTMLElement>('.deck-menu-panel')!;
const liveUrl = new URL('/live/', location.origin).toString();

menu.innerHTML = `
  <div class="group">Enlaces</div>
  <a href="${DEMO_URL}" target="_blank" rel="noreferrer">Demo: Rumbo <i data-lucide="arrow-up-right"></i></a>
  <a href="${new URL('/compare.html', DEMO_URL)}" target="_blank" rel="noreferrer">Demo: ingenuo vs fluido <i data-lucide="arrow-up-right"></i></a>
  <a href="${liveUrl}" target="_blank" rel="noreferrer">App del público <i data-lucide="arrow-up-right"></i></a>
  <a href="${REPO_URL}" target="_blank" rel="noreferrer">Repositorio <i data-lucide="arrow-up-right"></i></a>
  <div class="group">Vista</div>
  <button type="button" data-act="theme">Modo claro / oscuro <kbd>L</kbd></button>
  <button type="button" data-act="fs">Pantalla completa <kbd>F</kbd></button>
  <button type="button" data-act="rail">Panel de miniaturas <kbd>S</kbd></button>
  <button type="button" data-act="present" data-presenter-only>Presentar en vivo (GitHub)</button>
  <button type="button" data-act="answers" data-presenter-ui hidden>Cargar respuestas (answers.json) <kbd data-answers-status></kbd></button>
  <button type="button" data-act="reset" data-local-only>Reiniciar sesión de ensayo</button>
  <div class="group">Ir a</div>
  <div class="slides-list"></div>`;

function renderMenuList() {
  const list = menu.querySelector('.slides-list')!;
  if (!list.childElementCount) {
    sections.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${pad(i + 1)} · ${s.dataset.label ?? 'Slide'}`;
      b.addEventListener('click', () => {
        stage.goTo(i);
        closeMenu();
      });
      list.append(b);
    });
  }
  [...list.children].forEach((b, i) => (i === current ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
}

const openMenu = () => {
  menu.hidden = false;
  menuBtn.setAttribute('aria-expanded', 'true');
  menuBtn.setAttribute('aria-label', 'Cerrar menú');
  menu.querySelector<HTMLElement>('a, button')?.focus();
};
const closeMenu = () => {
  menu.hidden = true;
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.setAttribute('aria-label', 'Abrir menú');
};
menuBtn.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
addEventListener('pointerdown', (e) => {
  if (!menu.hidden && !menu.contains(e.target as Node) && !menuBtn.contains(e.target as Node)) closeMenu();
});
menu.addEventListener('click', (e) => {
  const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
  if (act === 'theme') setTheme(!isDark());
  if (act === 'fs') toggleFullscreen();
  if (act === 'rail') toggleRail();
  if (act === 'present') document.dispatchEvent(new CustomEvent('deck:present'));
  if (act === 'reset') document.dispatchEvent(new CustomEvent('deck:reset'));
  if (act === 'answers') document.dispatchEvent(new CustomEvent('deck:answers'));
});
renderMenuList();
// El 'slidechange' inicial ocurre antes de que cargue este módulo: procesamos el slide activo.
{
  const first = sections.findIndex((s) => s.hasAttribute('data-deck-active'));
  if (first >= 0) requestAnimationFrame(() => onSlide(first, sections[first]));
}
createIcons({
  icons: { ArrowUpRight, Play, Camera, CirclePlay, Briefcase, GitBranch, Brain, Circle, Clock, CloudOff, Diamond, Hand, Heart, Lightbulb, Map: MapIcon, Rocket, ShieldCheck, Sparkles, Square, Star, Triangle, Trophy, Wallet, Zap, Lock, Flame, RotateCcw },
  attrs: { 'stroke-width': 1.75, 'aria-hidden': 'true' },
});

// ── Atajos (sin chocar con deck-stage: ←/→, espacio, R, números) ─────
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'escape' && !menu.hidden) closeMenu();
  if (k === 'l') setTheme(!isDark());
  if (k === 'f') toggleFullscreen();
  if (k === 's') toggleRail();
  if (k === 'm') (menu.hidden ? openMenu : closeMenu)();
});

// ── En vivo ──────────────────────────────────────────────────────────
initLive(stage, sections).catch((err) => console.error('[live]', err));
