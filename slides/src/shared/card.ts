// Card de cada asistente, estilo DevFest (línea de 2px, pasteles, colourway por tipo).
// Se usa en el celular (preview + descarga PNG) y en el muro del deck.
import type { CardData, CardType } from './realtime';

export const TYPE_META: Record<CardType, { label: string; colorway: 'blue' | 'green' | 'yellow' | 'red'; icon: string; emoji: string }> = {
  web: { label: 'Web', colorway: 'green', icon: 'globe', emoji: '🌐' },
  ia: { label: 'IA', colorway: 'red', icon: 'asterisk', emoji: '✳️' },
  cloud: { label: 'Cloud', colorway: 'blue', icon: 'cloud', emoji: '☁️' },
  mobile: { label: 'Mobile', colorway: 'yellow', icon: 'puzzle-hash', emoji: '#️⃣' },
};

export const POWERS = ['Angular', 'React', 'Firebase', 'Gemini', 'Flutter', 'Kotlin', 'CSS', 'Accesibilidad', 'Cloud Run', 'WebMCP', 'Node.js', 'Python'];

export const PASTEL: Record<string, string> = { blue: '#c3ecf6', green: '#ccf6c5', yellow: '#ffe7a5', red: '#f8d8d8' };
export const CORE: Record<string, string> = { blue: '#4285f4', green: '#34a853', yellow: '#f9ab00', red: '#ea4335' };
export const HALFTONE: Record<string, string> = { blue: '#57caff', green: '#5cdb6d', yellow: '#ffd427', red: '#ff7daf' };

export const hpFor = (years: number) => Math.min(250, 40 + years * 15);
export const damageFor = (years: number, power: string) => 20 + years * 7 + (power.length % 5) * 5;

const ABILITY: Record<CardType, string[]> = {
  web: ['Reserva el espacio antes de que llegue el contenido: CLS 0.', 'Reutiliza el DOM con claves estables y nunca pierde un clic.', 'Lanza View Transitions sin marear a nadie.'],
  ia: ['Corre Gemini Nano sin red, sin costo y sin filtrar datos.', 'Convierte tokens en interfaces con un schema cerrado.', 'Verifica lo que propone el modelo antes de mostrarlo.'],
  cloud: ['Despliega en Firebase antes de que termine el café.', 'Cae a la nube solo cuando el dispositivo no puede.', 'Escala a mil asistentes sin pestañear.'],
  mobile: ['Funciona offline y en el peor 3G del evento.', 'Respeta prefers-reduced-motion como buena persona.', 'Diseña para el pulgar primero.'],
};

export function abilityFor(type: CardType, name: string): string {
  const list = ABILITY[type];
  return list[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % list.length];
}

/** Código corto y estable por usuario: el ganador lo ve en su celular y en la pantalla. */
export function winnerCode(uid: string): string {
  let h = 2166136261;
  for (const c of uid) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += alphabet[(h >>> (i * 5)) & 31];
  }
  return out;
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** HTML de la card. `image` es un data URL generado EN EL DISPOSITIVO. */
export function cardHTML(card: Pick<CardData, 'name' | 'type' | 'power' | 'years' | 'ability' | 'image'>, extra = ''): string {
  const meta = TYPE_META[card.type];
  return `<article class="dev-card" data-colorway="${meta.colorway}" ${extra}>
  <header class="dc-top"><span class="dc-name">${esc(card.name)}</span><span class="dc-hp">HP ${hpFor(card.years)}</span></header>
  <div class="dc-art"><img src="${esc(card.image)}" alt="" width="320" height="320" decoding="async"></div>
  <div class="dc-type"><img src="/brand/${meta.icon}.svg" alt="" width="18" height="18"><span>Tipo ${meta.label}</span><span class="dc-years">${card.years} años programando</span></div>
  <div class="dc-move"><strong>${esc(card.power)}</strong><span>${damageFor(card.years, card.power)}</span></div>
  <p class="dc-ability">${esc(card.ability)}</p>
  <footer class="dc-foot">DevFest Santo Domingo 2026 · IA rápida, UI fluida</footer>
</article>`;
}

/** Dibuja la card en un canvas para descargarla como PNG (todo local). */
export async function cardPNG(card: Pick<CardData, 'name' | 'type' | 'power' | 'years' | 'ability' | 'image'>): Promise<Blob> {
  const W = 630;
  const H = 880;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const meta = TYPE_META[card.type];
  const ink = '#1e1e1e';
  await document.fonts?.ready;
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
  };
  rr(4, 4, W - 8, H - 8, 36);
  g.fillStyle = PASTEL[meta.colorway];
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = ink;
  g.stroke();
  g.fillStyle = ink;
  g.font = '700 38px "Google Sans", system-ui, sans-serif';
  g.fillText(card.name.slice(0, 18), 36, 70);
  g.font = '500 28px "Google Sans", system-ui, sans-serif';
  g.textAlign = 'right';
  g.fillText(`HP ${hpFor(card.years)}`, W - 36, 70);
  g.textAlign = 'left';
  const img = new Image();
  img.src = card.image;
  await img.decode().catch(() => undefined);
  rr(36, 96, W - 72, W - 72, 24);
  g.save();
  g.clip();
  g.fillStyle = '#fff';
  g.fillRect(36, 96, W - 72, W - 72);
  if (img.naturalWidth) g.drawImage(img, 36, 96, W - 72, W - 72);
  g.restore();
  rr(36, 96, W - 72, W - 72, 24);
  g.stroke();
  const y = 96 + W - 72 + 44;
  g.font = '300 22px "Roboto Mono", monospace';
  g.fillText(`Tipo ${meta.label} · ${card.years} años programando`, 36, y);
  g.font = '700 32px "Google Sans", system-ui, sans-serif';
  g.fillText(card.power, 36, y + 50);
  g.textAlign = 'right';
  g.fillText(String(damageFor(card.years, card.power)), W - 36, y + 50);
  g.textAlign = 'left';
  g.font = '400 22px "Google Sans", system-ui, sans-serif';
  wrap(g, card.ability, 36, y + 92, W - 72, 28);
  g.font = '300 16px "Roboto Mono", monospace';
  g.fillText('DevFest Santo Domingo 2026 · IA rápida, UI fluida', 36, H - 30);
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > max && line) {
      g.fillText(line, x, y);
      line = word;
      y += lh;
    } else line = test;
  }
  if (line) g.fillText(line, x, y);
}
