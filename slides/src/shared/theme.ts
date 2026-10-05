// Tema claro (DevFest) por defecto; ?theme=dark o la tecla L para el modo neón.
const KEY = 'fgui.theme';

export type Theme = 'light' | 'dark';

export function initTheme(): Theme {
  const param = new URLSearchParams(location.search).get('theme');
  let theme: Theme = 'light';
  try {
    theme = (param as Theme) || (localStorage.getItem(KEY) as Theme) || 'light';
  } catch {
    /* storage bloqueado */
  }
  applyTheme(theme);
  return theme;
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* noop */
  }
}

export function toggleTheme(): Theme {
  const next: Theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

export const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Roboto+Mono:wght@100;300;400;500&family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;500;700&display=swap';
