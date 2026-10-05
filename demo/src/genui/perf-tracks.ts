// Pistas propias en el panel Performance de Chrome DevTools (API de extensibilidad):
// cada agente aparece como un bloque en la pista "Rumbo · agentes", junto a los
// frames, long tasks y layout shifts. Ideal para debuggear el workflow (y para
// que AI assistance de DevTools tenga contexto).
type DevToolsColor = 'primary' | 'secondary' | 'tertiary' | 'primary-light' | 'secondary-light' | 'tertiary-dark' | 'warning' | 'error';

export function trackSpan(track: string, name: string, start: number, end = performance.now(), color: DevToolsColor = 'primary', properties: [string, string][] = []) {
  try {
    performance.measure(`${track}: ${name}`, {
      start,
      end,
      detail: {
        devtools: {
          dataType: 'track-entry',
          track,
          trackGroup: 'Rumbo · agentes',
          color,
          tooltipText: name,
          properties,
        },
      },
    });
  } catch {
    /* navegadores sin soporte para `detail` */
  }
}

export function trackMarker(name: string, color: DevToolsColor = 'secondary') {
  try {
    performance.mark(name, { detail: { devtools: { dataType: 'marker', color, tooltipText: name } } });
  } catch {
    /* noop */
  }
}
