// Logo GDG animado en el notch de cada slide: las cuatro píldoras llegan volando y se
// ensamblan al entrar al slide, luego "respiran". SVG inline + CSS (sin WebGL, muy liviano).
const OFFSETS = [
  { dx: -140, dy: -90, r: -40 },
  { dx: -120, dy: 110, r: 35 },
  { dx: 140, dy: 100, r: -30 },
  { dx: 130, dy: -110, r: 45 },
];

export async function animateNotchLogos() {
  const res = await fetch('/brand/logo-gdg-stacked.svg');
  if (!res.ok) return;
  const doc = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');
  const svg = doc.documentElement;
  // Cada rect tiene su propio transform (rotación): lo envolvemos en un <g> para animar sin pisarlo.
  svg.querySelectorAll('rect').forEach((rect, n) => {
    const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    const o = OFFSETS[n % 4];
    g.setAttribute('class', 'gdg-pill');
    g.setAttribute('style', `--n:${n};--dx:${o.dx}px;--dy:${o.dy}px;--r:${o.r}deg`);
    rect.replaceWith(g);
    g.append(rect);
  });
  svg.setAttribute('class', 'gdg-logo-anim');
  svg.setAttribute('aria-label', 'Google Developer Groups');
  const markup = new XMLSerializer().serializeToString(svg);
  document.querySelectorAll('.notch img').forEach((img) => (img.outerHTML = markup));
}
