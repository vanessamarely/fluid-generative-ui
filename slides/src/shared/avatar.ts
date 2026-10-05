// Avatares SIN costo y SIN subir nada a ningún servidor:
//  1) avatarSVG: avatar generativo (SVG procedural) a partir de elecciones simples.
//  2) comicPortrait: la selfie convertida EN EL DISPOSITIVO a retrato de cómic
//     (duotono + semitono + contorno) con la paleta DevFest. La foto original nunca sale del teléfono.
import { HALFTONE, PASTEL } from './card';

export interface AvatarOptions {
  colorway: 'blue' | 'green' | 'yellow' | 'red';
  skin: number; // 0..4
  hair: number; // 0..4
  accessory: number; // 0 nada, 1 lentes, 2 audífonos, 3 gorra
  mood: number; // 0 sonrisa, 1 asombro, 2 guiño
}

const SKINS = ['#f6d3b3', '#e8b48f', '#c98b62', '#9a6243', '#6b4330'];
const HAIRS = ['#1e1e1e', '#5a3825', '#a0522d', '#d9a441', '#7b61ff'];

export function avatarSVG(o: AvatarOptions): string {
  const bg = PASTEL[o.colorway];
  const dot = HALFTONE[o.colorway];
  const skin = SKINS[o.skin % SKINS.length];
  const hair = HAIRS[o.hair % HAIRS.length];
  const ink = '#1e1e1e';
  const hairShapes = [
    `<path d="M88 112c0-40 26-62 72-62s72 22 72 62c-14-16-30-26-72-26s-58 10-72 26Z" fill="${hair}"/>`,
    `<path d="M84 128c-6-56 28-84 76-84s82 28 76 84l-14-30c-20-14-40-18-62-18s-42 4-62 18Z" fill="${hair}"/><circle cx="160" cy="40" r="22" fill="${hair}" stroke="${ink}" stroke-width="4"/>`,
    `<path d="M80 150c-10-70 24-104 80-104s90 34 80 104c-6-30-14-48-26-58-40 10-70 6-108-6-14 14-22 34-26 64Z" fill="${hair}"/>`,
    `<path d="M92 100c8-34 34-50 68-50s60 16 68 50c-30-12-50 0-68-14-18 14-38 2-68 14Z" fill="${hair}"/>`,
    `<path d="M76 190c-14-90 20-140 84-140s98 50 84 140l-18-6c4-40-4-70-24-84-28 16-56 18-84 0-20 14-28 44-24 84Z" fill="${hair}"/>`,
  ];
  const mouths = [
    `<path d="M140 178c10 12 30 12 40 0" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`,
    `<ellipse cx="160" cy="182" rx="10" ry="12" fill="${ink}"/>`,
    `<path d="M138 176c14 16 34 14 46-2" fill="#fff" stroke="${ink}" stroke-width="5" stroke-linejoin="round"/>`,
  ];
  const eyes =
    o.mood === 2
      ? `<circle cx="136" cy="140" r="7" fill="${ink}"/><path d="M176 141h18" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`
      : `<circle cx="136" cy="140" r="7" fill="${ink}"/><circle cx="184" cy="140" r="7" fill="${ink}"/>`;
  const acc = [
    '',
    `<g fill="none" stroke="${ink}" stroke-width="5"><circle cx="136" cy="140" r="20"/><circle cx="184" cy="140" r="20"/><path d="M156 140h8"/></g>`,
    `<path d="M92 150c0-50 30-84 68-84s68 34 68 84" fill="none" stroke="${ink}" stroke-width="10"/><rect x="78" y="134" width="26" height="44" rx="12" fill="${dot}" stroke="${ink}" stroke-width="4"/><rect x="216" y="134" width="26" height="44" rx="12" fill="${dot}" stroke="${ink}" stroke-width="4"/>`,
    `<path d="M96 106c4-34 30-52 64-52s60 18 64 52Z" fill="${dot}" stroke="${ink}" stroke-width="4"/><path d="M150 104h104c0 12-14 18-30 18h-74Z" fill="${dot}" stroke="${ink}" stroke-width="4"/>`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">
<defs><pattern id="p" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="9" cy="9" r="3" fill="${dot}"/></pattern></defs>
<rect width="320" height="320" fill="${bg}"/><rect width="320" height="320" fill="url(#p)" opacity=".7"/>
<path d="M60 320c8-64 48-96 100-96s92 32 100 96Z" fill="#fff" stroke="${ink}" stroke-width="4"/>
<rect x="142" y="196" width="36" height="34" fill="${skin}" stroke="${ink}" stroke-width="4"/>
<ellipse cx="160" cy="140" rx="66" ry="72" fill="${skin}" stroke="${ink}" stroke-width="4"/>
${hairShapes[o.hair % hairShapes.length]}
${eyes}
<circle cx="120" cy="164" r="9" fill="#ff7daf" opacity=".55"/><circle cx="200" cy="164" r="9" fill="#ff7daf" opacity=".55"/>
${mouths[o.mood % mouths.length]}
${acc[o.accessory % acc.length]}
</svg>`;
}

export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Selfie → retrato de cómic (todo en canvas, en el dispositivo). Devuelve un data URL webp liviano. */
export async function comicPortrait(file: Blob, colorway: AvatarOptions['colorway']): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const S = 320;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const side = Math.min(bitmap.width, bitmap.height);
  g.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, S, S);
  bitmap.close();

  const src = g.getImageData(0, 0, S, S);
  const lum = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) {
    const r = src.data[i * 4];
    const gg = src.data[i * 4 + 1];
    const b = src.data[i * 4 + 2];
    lum[i] = 0.299 * r + 0.587 * gg + 0.114 * b;
  }
  // Normalizamos contraste (percentiles 5–95) para que cualquier selfie se vea bien.
  const sorted = Array.from(lum).sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.05)];
  const hi = sorted[Math.floor(sorted.length * 0.95)] || 255;
  const norm = (v: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo || 1)));

  const pastel = hexToRgb(PASTEL[colorway]);
  const half = hexToRgb(HALFTONE[colorway]);
  const ink = [30, 30, 30];
  const out = g.createImageData(S, S);
  const cell = 6;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const v = norm(lum[i]);
      // Bordes (Sobel simple) → contorno negro de cómic.
      const gx = x > 0 && x < S - 1 ? norm(lum[i + 1]) - norm(lum[i - 1]) : 0;
      const gy = y > 0 && y < S - 1 ? norm(lum[i + S]) - norm(lum[i - S]) : 0;
      const edge = Math.hypot(gx, gy) > 0.32;
      let col: number[];
      if (edge || v < 0.18) col = ink;
      else if (v > 0.72) col = [255, 255, 255];
      else {
        // Semitono: puntos más grandes en zonas más oscuras.
        const cx = (x % cell) - cell / 2;
        const cy = (y % cell) - cell / 2;
        const radius = (1 - (v - 0.18) / 0.54) * (cell / 1.6);
        col = cx * cx + cy * cy < radius * radius ? half : pastel;
      }
      out.data.set([col[0], col[1], col[2], 255], i * 4);
    }
  }
  g.putImageData(out, 0, 0);
  return c.toDataURL('image/webp', 0.82);
}

function hexToRgb(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
