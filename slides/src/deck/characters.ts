// Personajes de las viñetas (SVG con la línea de 2px y los pasteles de la guía DevFest).
// Se inyectan una vez como <symbol> y se usan con <svg><use href="#lucia"/></svg>.
const INK = '#1e1e1e';
const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;

const luciaBase = (mouth: string, brows: string) => `
  <path d="M30 168c4-34 24-52 50-52s46 18 50 52Z" fill="#c3ecf6" ${S}/>
  <path d="M38 78c-6-44 16-66 42-66s50 22 42 66c-6 22-10 34-10 34H48s-4-12-10-34Z" fill="#5a3825" ${S}/>
  <circle cx="80" cy="16" r="13" fill="#5a3825" ${S}/>
  <rect x="70" y="100" width="20" height="20" fill="#f6d3b3" ${S}/>
  <ellipse cx="80" cy="72" rx="34" ry="38" fill="#f6d3b3" ${S}/>
  <path d="M46 62c6-22 22-30 34-30s28 8 34 30c-14-8-24-12-34-8-12-4-22 0-34 8Z" fill="#5a3825"/>
  <g fill="none" ${S}><circle cx="66" cy="74" r="10"/><circle cx="94" cy="74" r="10"/><path d="M76 74h8"/></g>
  <circle cx="66" cy="75" r="3" fill="${INK}"/><circle cx="94" cy="75" r="3" fill="${INK}"/>
  ${brows}
  <circle cx="56" cy="90" r="5" fill="#ff7daf" opacity=".5"/><circle cx="104" cy="90" r="5" fill="#ff7daf" opacity=".5"/>
  ${mouth}`;

export const CHARACTERS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0" aria-hidden="true">
<symbol id="lucia" viewBox="0 0 160 170">${luciaBase(`<path d="M70 94c6 6 14 6 20 0" fill="none" ${S}/>`, '')}</symbol>
<symbol id="lucia-happy" viewBox="0 0 160 170">${luciaBase(`<path d="M66 90c6 12 22 12 28 0Z" fill="#fff" ${S}/>`, '')}</symbol>
<symbol id="lucia-angry" viewBox="0 0 160 170">${luciaBase(`<path d="M68 98c6-6 18-6 24 0" fill="none" ${S}/>`, `<path d="M56 58l18 6M104 58l-18 6" ${S}/>`)}
  <path d="M124 30l10-8M128 44l12-2M120 20l4-12" ${S}/></symbol>
<symbol id="lucia-wait" viewBox="0 0 160 170">${luciaBase(`<path d="M72 96h16" ${S}/>`, `<path d="M58 60l14-2M102 60l-14-2" ${S}/>`)}
  <text x="122" y="34" font-family="Google Sans,sans-serif" font-size="22" font-weight="700" fill="${INK}">z</text><text x="134" y="18" font-family="Google Sans,sans-serif" font-size="16" font-weight="700" fill="${INK}">z</text></symbol>

<symbol id="nano" viewBox="0 0 140 160">
  <path d="M70 8v18" ${S}/><circle cx="70" cy="8" r="7" fill="#ea4335" ${S}/>
  <rect x="22" y="26" width="96" height="74" rx="24" fill="#fff" ${S}/>
  <rect x="34" y="38" width="72" height="50" rx="14" fill="${INK}"/>
  <ellipse cx="56" cy="60" rx="7" ry="9" fill="#57caff"/><ellipse cx="84" cy="60" rx="7" ry="9" fill="#57caff"/>
  <path d="M58 76c8 6 16 6 24 0" fill="none" stroke="#57caff" stroke-width="3" stroke-linecap="round"/>
  <rect x="36" y="104" width="68" height="44" rx="16" fill="#c3ecf6" ${S}/>
  <circle cx="54" cy="126" r="5" fill="#4285f4" ${S}/><circle cx="66" cy="126" r="5" fill="#ea4335" ${S}/><circle cx="78" cy="126" r="5" fill="#f9ab00" ${S}/><circle cx="90" cy="126" r="5" fill="#34a853" ${S}/>
  <path d="M36 116l-16 14M104 116l16 14" ${S}/>
</symbol>
<symbol id="nano-shield" viewBox="0 0 160 160">
  <use href="#nano" x="0" y="0" width="140" height="160"/>
  <path d="M118 84l30 10v22c0 20-14 32-30 38-16-6-30-18-30-38V94Z" fill="#ccf6c5" ${S}/>
  <path d="M106 118l9 9 18-20" fill="none" ${S}/>
</symbol>
<symbol id="nano-sweat" viewBox="0 0 140 160">
  <use href="#nano" x="0" y="0" width="140" height="160"/>
  <path d="M120 40c6 8 6 14 0 16-6-2-6-8 0-16Z" fill="#57caff" ${S}/>
  <path d="M10 46c6 8 6 14 0 16-6-2-6-8 0-16Z" fill="#57caff" ${S}/>
</symbol>

<symbol id="gremlin" viewBox="0 0 150 150">
  <path d="M40 40L30 8l26 22M110 40l10-32-26 22" fill="#ff7daf" ${S}/>
  <path d="M28 96c0-44 20-66 47-66s47 22 47 66c0 30-20 44-47 44s-47-14-47-44Z" fill="#ff7daf" ${S}/>
  <path d="M120 112c18 0 24-14 18-24" fill="none" ${S}/>
  <path d="M46 70l18 8M104 70l-18 8" ${S}/>
  <circle cx="58" cy="84" r="6" fill="${INK}"/><circle cx="92" cy="84" r="6" fill="${INK}"/>
  <path d="M50 104c12 14 38 14 50 0Z" fill="#fff" ${S}/>
  <path d="M62 104v7M75 104v9M88 104v7" ${S}/>
  <rect x="56" y="122" width="38" height="16" rx="8" fill="#fff" ${S}/>
  <text x="75" y="134" text-anchor="middle" font-family="Roboto Mono,monospace" font-size="11" font-weight="700" fill="${INK}">CLS</text>
</symbol>
</svg>`;

export function injectCharacters() {
  if (document.getElementById('nano')) return;
  document.body.insertAdjacentHTML('afterbegin', CHARACTERS_SVG);
}
