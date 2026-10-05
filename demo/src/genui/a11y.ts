// Anuncios para lectores de pantalla: pocos, cortos y en momentos clave.
// Un aria-live sobre contenido que cambia 60 veces por segundo es ruido inaccesible.
export function createAnnouncer(region: HTMLElement, minGapMs = 2500) {
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('role', 'status');
  let last = 0;
  let timer = 0;
  let count = 0;
  return {
    say(message: string, force = false) {
      const now = performance.now();
      clearTimeout(timer);
      const write = () => {
        region.textContent = message;
        last = performance.now();
        count++;
      };
      if (force || now - last >= minGapMs) write();
      else timer = window.setTimeout(write, minGapMs - (now - last));
    },
    get count() {
      return count;
    },
  };
}
