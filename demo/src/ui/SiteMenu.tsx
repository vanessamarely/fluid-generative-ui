// Menú hamburguesa: cambiar de pantalla (planificador, comparación, laboratorio)
// y saltar al slide deck o al repo. Accesible: aria-expanded, Esc, foco y clic afuera.
import { useEffect, useRef, useState } from 'react';
import { REPO_URL, SLIDES_URL } from '../shared/config';

export function SiteMenu({ current, onLab }: { current: 'app' | 'compare'; onLab?: () => void }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    addEventListener('keydown', onKey);
    addEventListener('pointerdown', onClick);
    return () => {
      removeEventListener('keydown', onKey);
      removeEventListener('pointerdown', onClick);
    };
  }, [open]);

  return (
    <div className="site-menu">
      <button ref={button} className="menu-button" type="button" aria-expanded={open} aria-controls="site-menu-panel" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
      <div ref={panel} id="site-menu-panel" className="menu-panel" hidden={!open}>
        <nav aria-label="Pantallas">
          <a href="./" aria-current={current === 'app' ? 'page' : undefined}>
            <strong>Planificador</strong>
            <span>Workflow de agentes, mapa, verificador y asistente</span>
          </a>
          <a href="./compare.html" aria-current={current === 'compare' ? 'page' : undefined}>
            <strong>Ingenuo vs fluido</strong>
            <span>El mismo stream renderizado de dos formas</span>
          </a>
          {onLab && (
            <button
              type="button"
              onClick={() => {
                onLab();
                setOpen(false);
              }}
            >
              <strong>Laboratorio</strong>
              <span>Métricas, motor de IA y APIs integradas (tecla D)</span>
            </button>
          )}
        </nav>
        <nav aria-label="Enlaces de la charla" className="menu-secondary">
          <a href={SLIDES_URL} target="_blank" rel="noreferrer">
            <strong>Slide deck ↗</strong>
            <span>IA rápida, UI fluida</span>
          </a>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            <strong>Repositorio ↗</strong>
            <span>github.com/vanessamarely/fluid-generative-ui</span>
          </a>
        </nav>
      </div>
    </div>
  );
}
