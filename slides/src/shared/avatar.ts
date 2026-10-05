// Avatares SIN costo y SIN subir nada a ningún servidor:
//  1) avatarSVG: avatar generativo (SVG procedural) a partir de elecciones simples.
//  2) comicPortrait: la selfie convertida EN EL DISPOSITIVO a retrato de cómic
//     (duotono + semitono + contorno) con la paleta DevFest. La foto original nunca sale del teléfono.
import { HALFTONE, PASTEL } from './card';

export type AvatarGender = 'f' | 'm' | 'x';

export interface AvatarOptions {
  colorway: 'blue' | 'green' | 'yellow' | 'red';
  /** f = mujer, m = hombre, x = neutral: define los peinados y detalles disponibles */
  gender: AvatarGender;
  skin: number; // 0..4
  hair: number; // 0..4 (estilo dentro del género)
  hairColor: number; // 0..4
  detail: number; // 0..2 (f: nada/aretes/lunar · m: nada/barba/bigote · x: nada/aretes/pecas)
  accessory: number; // 0 nada, 1 lentes, 2 audífonos, 3 gorra
  mood: number; // 0 sonrisa, 1 asombro, 2 guiño
}

export const GENDER_LABEL: Record<AvatarGender, string> = { f: 'Mujer', m: 'Hombre', x: 'Neutral' };
export const HAIR_LABELS: Record<AvatarGender, string[]> = {
  f: ['Largo', 'Moño', 'Rizos', 'Cola', 'Bob'],
  m: ['Corto', 'De lado', 'Rapado', 'Rizado', 'Calvo'],
  x: ['Corto', 'Rizos', 'Bob', 'Moño', 'Rapado'],
};
export const DETAIL_LABELS: Record<AvatarGender, string[]> = {
  f: ['Nada', 'Aretes', 'Lunar'],
  m: ['Nada', 'Barba', 'Bigote'],
  x: ['Nada', 'Aretes', 'Pecas'],
};

export const SKIN_SWATCHES = ['#f6d3b3', '#e8b48f', '#c98b62', '#9a6243', '#6b4330'];
export const HAIR_SWATCHES = ['#1e1e1e', '#5a3825', '#a0522d', '#d9a441', '#7b61ff'];
const INK = '#1e1e1e';
const SW = `stroke="${INK}" stroke-width="4" stroke-linejoin="round"`;

/** Cada peinado tiene una parte DETRÁS de la cara (pelo largo) y otra DELANTE (flequillo). */
type Hair = { back?: string; front?: string };
function hairStyle(gender: AvatarGender, index: number, c: string): Hair {
  const cap = `<path d="M92 120c0-48 30-74 68-74s68 26 68 74c-16-20-36-30-68-30s-52 10-68 30Z" fill="${c}" ${SW}/>`;
  const longBack = `<path d="M84 120c0-50 30-82 76-82s76 32 76 82v120c0 10-8 18-18 18H102c-10 0-18-8-18-18Z" fill="${c}" ${SW}/>`;
  const bobBack = `<path d="M84 124c0-52 30-84 76-84s76 32 76 84v62c0 8-6 14-14 14H98c-8 0-14-6-14-14Z" fill="${c}" ${SW}/>`;
  const curlsBack = `<g fill="${c}" ${SW}>${[[96, 110], [86, 150], [92, 192], [110, 226], [224, 110], [234, 150], [228, 192], [210, 226], [160, 60], [124, 72], [196, 72]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="28"/>`)
    .join('')}</g>`;
  const bun = `<circle cx="160" cy="42" r="24" fill="${c}" ${SW}/>`;
  const sidePart = `<path d="M92 124c-2-52 28-80 70-80 40 0 66 26 66 66-30-6-56-16-74-34-12 22-36 38-62 48Z" fill="${c}" ${SW}/>`;
  const buzz = `<path d="M96 116c4-42 30-64 64-64s60 22 64 64c-20-12-40-16-64-16s-44 4-64 16Z" fill="${c}" opacity=".85" ${SW}/>`;
  const curlyTop = `<g fill="${c}" ${SW}>${[[104, 98], [126, 76], [152, 66], [178, 68], [204, 80], [222, 102]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="20"/>`).join('')}</g>`;
  const ponytail = `<path d="M222 96c34 6 46 46 30 86-6 16-18 24-30 22 10-26 10-58 0-80Z" fill="${c}" ${SW}/>`;
  const shine = `<path d="M128 84c10-8 22-12 34-12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>`;
  const styles: Record<AvatarGender, Hair[]> = {
    f: [{ back: longBack, front: cap }, { front: cap + bun }, { back: curlsBack, front: curlyTop }, { back: ponytail, front: cap }, { back: bobBack, front: cap }],
    m: [{ front: cap }, { front: sidePart }, { front: buzz }, { front: curlyTop }, { front: shine }],
    x: [{ front: cap }, { back: curlsBack, front: curlyTop }, { back: bobBack, front: cap }, { front: cap + bun }, { front: buzz }],
  };
  return styles[gender][index % 5];
}

function detailSvg(gender: AvatarGender, detail: number, hairColor: string): string {
  const earrings = `<circle cx="96" cy="170" r="7" fill="#ffd427" ${SW}/><circle cx="224" cy="170" r="7" fill="#ffd427" ${SW}/>`;
  const map: Record<AvatarGender, string[]> = {
    f: ['', earrings, `<circle cx="196" cy="168" r="3.5" fill="${INK}"/>`],
    m: [
      '',
      `<path d="M96 150c2 46 28 74 64 74s62-28 64-74c-8 22-22 30-32 30-10-10-22-14-32-14s-22 4-32 14c-10 0-24-8-32-30Z" fill="${hairColor}" ${SW}/>`,
      `<path d="M132 170c10-10 20-10 28-4 8-6 18-6 28 4-10 6-20 6-28 0-8 6-18 6-28 0Z" fill="${hairColor}" ${SW}/>`,
    ],
    x: ['', earrings, `<g fill="#a0522d" opacity=".6">${[[124, 156], [132, 162], [118, 164], [196, 156], [188, 162], [202, 164]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6"/>`).join('')}</g>`],
  };
  return map[gender][detail % 3];
}

export function avatarSVG(o: AvatarOptions): string {
  const gender = o.gender ?? 'x';
  const bg = PASTEL[o.colorway];
  const dot = HALFTONE[o.colorway];
  const skin = SKIN_SWATCHES[o.skin % SKIN_SWATCHES.length];
  const hairColor = HAIR_SWATCHES[(o.hairColor ?? o.hair) % HAIR_SWATCHES.length];
  const hair = hairStyle(gender, o.hair, hairColor);
  const lashes = gender === 'f' ? `<path d="M124 132l-6-6M130 129l-2-8M196 132l6-6M190 129l2-8" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` : '';
  const mouths = [
    `<path d="M140 182c10 12 30 12 40 0" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
    `<ellipse cx="160" cy="186" rx="10" ry="12" fill="${INK}"/>`,
    `<path d="M138 180c14 16 34 14 46-2" fill="#fff" ${SW}/>`,
  ];
  const lips = gender === 'f' && o.mood === 0 ? `<path d="M142 182c10 10 26 10 36 0" fill="none" stroke="#d9433f" stroke-width="5" stroke-linecap="round"/>` : mouths[o.mood % 3];
  const eyes =
    o.mood === 2
      ? `<ellipse cx="136" cy="140" rx="11" ry="13" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="138" cy="141" r="6" fill="${INK}"/><circle cx="140" cy="138" r="2" fill="#fff"/><path d="M176 141h18" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`
      : `<g stroke="${INK}" stroke-width="3"><ellipse cx="136" cy="140" rx="11" ry="13" fill="#fff"/><ellipse cx="184" cy="140" rx="11" ry="13" fill="#fff"/></g><circle cx="138" cy="141" r="6" fill="${INK}"/><circle cx="186" cy="141" r="6" fill="${INK}"/><circle cx="140" cy="138" r="2" fill="#fff"/><circle cx="188" cy="138" r="2" fill="#fff"/>`;
  const brows =
    o.mood === 1
      ? `<path d="M119 121c8-9 20-11 31-5M170 116c11-6 23-4 31 5" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`
      : o.mood === 2
        ? `<path d="M119 119c9-5 20-5 30 0M172 117l24-5" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`
        : `<path d="M120 121c8-6 19-7 29-2M171 119c10-5 21-4 29 2" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  const nose = `<path d="M160 149c-4 7-7 13-3 17 3 2 7 2 10-1" fill="none" stroke="#6b4330" stroke-width="3" stroke-linecap="round"/>`;
  const acc = [
    '',
    `<g fill="none" ${SW}><circle cx="136" cy="140" r="20"/><circle cx="184" cy="140" r="20"/><path d="M156 140h8"/></g>`,
    `<path d="M88 150c0-52 32-88 72-88s72 36 72 88" fill="none" stroke="${INK}" stroke-width="10"/><rect x="74" y="134" width="26" height="44" rx="12" fill="${dot}" ${SW}/><rect x="220" y="134" width="26" height="44" rx="12" fill="${dot}" ${SW}/>`,
    `<path d="M94 108c4-36 30-56 66-56s62 20 66 56Z" fill="${dot}" ${SW}/><path d="M150 106h108c0 12-14 20-32 20h-76Z" fill="${dot}" ${SW}/>`,
  ];
  const bodyShape = gender === 'f' ? `<path d="M64 320c10-60 48-90 96-90s86 30 96 90Z" fill="#fff" ${SW}/>` : `<path d="M60 320c8-64 48-96 100-96s92 32 100 96Z" fill="#fff" ${SW}/>`;
  const body = `${bodyShape}<path d="M136 232l24 26 24-26" fill="none" ${SW}/><path d="M160 258v30" fill="none" stroke="#c3ecf6" stroke-width="5" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">
<defs><pattern id="p" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="9" cy="9" r="3" fill="${dot}"/></pattern></defs>
<rect width="320" height="320" fill="${bg}"/><rect width="320" height="320" fill="url(#p)" opacity=".7"/>
${hair.back ?? ''}
${body}
<rect x="142" y="200" width="36" height="34" fill="${skin}" ${SW}/>
<ellipse cx="160" cy="144" rx="66" ry="72" fill="${skin}" ${SW}/>
${hair.front ?? ''}
${brows}${eyes}${lashes}
${nose}
<circle cx="120" cy="166" r="9" fill="#ff7daf" opacity=".55"/><circle cx="200" cy="166" r="9" fill="#ff7daf" opacity=".55"/>
${detailSvg(gender, o.detail ?? 0, hairColor)}
${lips}
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
