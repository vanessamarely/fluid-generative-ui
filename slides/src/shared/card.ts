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

const TYPE_CONTEXT: Record<CardType, string> = { web: 'Web', ia: 'IA', cloud: 'Cloud', mobile: 'Mobile' };
const POWER_MOVE: Record<string, string> = {
  Angular: 'ordena componentes con claridad',
  React: 'actualiza solo lo que cambia',
  Firebase: 'sincroniza cada cambio al instante',
  Gemini: 'convierte ideas en sugerencias',
  Flutter: 'lleva la interfaz a otras pantallas',
  Kotlin: 'estructura la lógica con seguridad',
  CSS: 'adapta cada pantalla al espacio',
  Accesibilidad: 'abre el flujo a más personas',
  'Cloud Run': 'escala servicios cuando sube la demanda',
  WebMCP: 'conecta agentes con herramientas',
  'Node.js': 'atiende eventos sin bloquear la interfaz',
  Python: 'automatiza tareas repetitivas',
};

export function abilityFor(type: CardType, power: string): string {
  const move = POWER_MOVE[power] ?? 'resuelve retos con creatividad';
  return `${TYPE_CONTEXT[type]} · ${power}: ${move}.`;
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
  rr(8, 8, W - 16, H - 16, 36);
  g.fillStyle = 'rgba(30, 30, 30, 0.2)';
  g.fill();
  rr(4, 4, W - 8, H - 8, 36);
  g.fillStyle = PASTEL[meta.colorway];
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = ink;
  g.stroke();
  g.fillStyle = ink;
  rr(28, 24, W - 210, 58, 18);
  g.fillStyle = '#fff';
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = ink;
  g.stroke();
  g.fillStyle = ink;
  g.font = '700 34px "Google Sans", system-ui, sans-serif';
  g.fillText(card.name.slice(0, 18), 42, 62);
  rr(W - 166, 24, 132, 58, 29);
  g.fillStyle = '#fff';
  g.fill();
  g.stroke();
  g.fillStyle = ink;
  g.font = '500 24px "Roboto Mono", monospace';
  g.textAlign = 'center';
  g.fillText(`HP ${hpFor(card.years)}`, W - 100, 61);
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
  const y = 96 + W - 72 + 36;
  g.font = '300 19px "Roboto Mono", monospace';
  g.fillText(`Tipo ${meta.label} · ${card.years} años programando`, 36, y);
  rr(36, y + 12, W - 72, 72, 18);
  g.fillStyle = '#fff';
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = ink;
  g.stroke();
  g.fillStyle = ink;
  g.font = '300 14px "Roboto Mono", monospace';
  g.fillText('SUPERPODER', 52, y + 34);
  g.font = '700 27px "Google Sans", system-ui, sans-serif';
  g.fillText(card.power, 52, y + 63);
  rr(W - 102, y + 22, 48, 48, 24);
  g.fillStyle = HALFTONE[meta.colorway];
  g.fill();
  g.strokeStyle = ink;
  g.stroke();
  g.fillStyle = ink;
  g.font = '700 21px "Google Sans", system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText(String(damageFor(card.years, card.power)), W - 78, y + 52);
  g.textAlign = 'left';
  rr(36, y + 94, W - 72, 52, 14);
  g.fillStyle = 'rgba(255, 255, 255, 0.65)';
  g.fill();
  g.setLineDash([7, 5]);
  g.strokeStyle = ink;
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = ink;
  g.font = '400 19px "Google Sans", system-ui, sans-serif';
  wrap(g, card.ability, 50, y + 115, W - 100, 22, 2);
  g.font = '300 16px "Roboto Mono", monospace';
  g.fillText('DevFest Santo Domingo 2026 · IA rápida, UI fluida', 36, H - 22);
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number, maxLines: number) {
  let line = '';
  let lines = 0;
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > max && line) {
      if (lines >= maxLines - 1) break;
      g.fillText(line, x, y);
      line = word;
      y += lh;
      lines++;
    } else line = test;
  }
  if (line && lines < maxLines) g.fillText(line, x, y);
}
