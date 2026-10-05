// Personajes de las viñetas (SVG con la línea de 2px y los pasteles de la guía DevFest).
// Se inyectan una vez como <symbol> y se usan con <svg><use href="#lucia"/></svg>.
const INK = '#1e1e1e';
const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;

const luciaBase = (mouth: string, brows: string, eyes = `
  <g fill="none" ${S}><circle cx="66" cy="74" r="10"/><circle cx="94" cy="74" r="10"/><path d="M76 74h8"/></g>
  <circle cx="66" cy="75" r="3.5" fill="${INK}"/><circle cx="94" cy="75" r="3.5" fill="${INK}"/>
  <circle cx="67" cy="74" r="1.2" fill="#fff"/><circle cx="95" cy="74" r="1.2" fill="#fff"/>`) => `
  <path d="M30 168c4-34 24-52 50-52s46 18 50 52Z" fill="#c3ecf6" ${S}/>
  <path d="M65 119l15 15 15-15" fill="#fff" ${S}/><path d="M80 135v21" fill="none" ${S}/><circle cx="80" cy="151" r="3" fill="#4285f4"/>
  <path d="M38 78c-6-44 16-66 42-66s50 22 42 66c-6 22-10 34-10 34H48s-4-12-10-34Z" fill="#5a3825" ${S}/>
  <path d="M51 49c7-14 17-22 29-25M110 48c-4-12-11-19-19-23" fill="none" stroke="#9a6545" stroke-width="4" stroke-linecap="round"/>
  <circle cx="80" cy="16" r="13" fill="#5a3825" ${S}/><circle cx="80" cy="16" r="5" fill="#9a6545"/>
  <ellipse cx="46" cy="78" rx="8" ry="11" fill="#f6d3b3" ${S}/><ellipse cx="114" cy="78" rx="8" ry="11" fill="#f6d3b3" ${S}/>
  <rect x="70" y="100" width="20" height="20" fill="#f6d3b3" ${S}/>
  <ellipse cx="80" cy="72" rx="34" ry="38" fill="#f6d3b3" ${S}/>
  <path d="M46 62c6-22 22-30 34-30s28 8 34 30c-14-8-24-12-34-8-12-4-22 0-34 8Z" fill="#5a3825"/>
  <path d="M54 47c6-8 12-12 19-14M95 34c5 3 9 7 12 13" fill="none" stroke="#9a6545" stroke-width="3" stroke-linecap="round"/>
  ${eyes}
  <path d="M58 61c5-4 10-4 15-1M87 60c5-3 10-3 15 1" fill="none" stroke="#5a3825" stroke-width="3" stroke-linecap="round"/>
  ${brows}
  <path d="M80 78c-3 4-4 7-1 9" fill="none" stroke="#d69b7b" stroke-width="2.5" stroke-linecap="round"/>
  <ellipse cx="56" cy="90" rx="6" ry="4" fill="#ff7daf" opacity=".45"/><ellipse cx="104" cy="90" rx="6" ry="4" fill="#ff7daf" opacity=".45"/>
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
  <ellipse cx="56" cy="59" rx="8" ry="10" fill="#57caff"/><ellipse cx="84" cy="59" rx="8" ry="10" fill="#57caff"/>
  <circle cx="58" cy="56" r="2.5" fill="#fff"/><circle cx="86" cy="56" r="2.5" fill="#fff"/>
  <path d="M56 77c8 7 20 7 28 0" fill="none" stroke="#57caff" stroke-width="3" stroke-linecap="round"/>
  <rect x="36" y="104" width="68" height="44" rx="16" fill="#c3ecf6" ${S}/>
  <path d="M52 146v4c0 3 3 5 6 5h10v-5l-5-4M88 146v4c0 3-3 5-6 5H72v-5l5-4" fill="#4285f4" ${S}/>
  <circle cx="52" cy="124" r="4" fill="#4285f4" ${S}/><circle cx="64" cy="124" r="4" fill="#ea4335" ${S}/><circle cx="76" cy="124" r="4" fill="#f9ab00" ${S}/><circle cx="88" cy="124" r="4" fill="#34a853" ${S}/>
  <path d="M36 113l-14 13M104 113l14 13" ${S}/><circle cx="21" cy="127" r="5" fill="#fff" ${S}/><circle cx="119" cy="127" r="5" fill="#fff" ${S}/>
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
  <path d="M34 33l10 8-8-20M106 33l-10 8 8-20" fill="#f9ab00" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M34 100c-18 0-24 11-19 21 4 8 14 8 22 2M116 100c18 0 24 11 19 21-4 8-14 8-22 2" fill="#ff7daf" ${S}/>
  <path d="M54 130v4l-12 5c-4 2-2 6 2 6h21l5-7M96 130v4l12 5c4 2 2 6-2 6H83l-5-7" fill="#ea4335" ${S}/>
  <path d="M28 96c0-44 20-66 47-66s47 22 47 66c0 30-20 44-47 44s-47-14-47-44Z" fill="#ff7daf" ${S}/>
  <path d="M44 52c9-13 20-19 31-19M97 39c8 4 14 10 18 19" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".65"/>
  <path d="M120 112c18 0 24-14 18-24" fill="none" ${S}/>
  <path d="M46 68l18 8M104 68l-18 8" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  <ellipse cx="58" cy="85" rx="8" ry="9" fill="#fff" ${S}/><ellipse cx="92" cy="85" rx="8" ry="9" fill="#fff" ${S}/>
  <circle cx="60" cy="85" r="4" fill="${INK}"/><circle cx="90" cy="85" r="4" fill="${INK}"/>
  <path d="M50 104c12 14 38 14 50 0Z" fill="#fff" ${S}/>
  <path d="M62 104v7M75 104v9M88 104v7" ${S}/>
  <path d="M40 95l7 3M110 95l-7 3" fill="none" stroke="#ea4335" stroke-width="4" stroke-linecap="round"/>
  <rect x="56" y="122" width="38" height="16" rx="8" fill="#fff" ${S}/>
  <text x="75" y="134" text-anchor="middle" font-family="Roboto Mono,monospace" font-size="11" font-weight="700" fill="${INK}">CLS</text>
</symbol>
</svg>`;

export function injectCharacters() {
  if (document.getElementById('nano')) return;
  document.body.insertAdjacentHTML('afterbegin', CHARACTERS_SVG);
}
