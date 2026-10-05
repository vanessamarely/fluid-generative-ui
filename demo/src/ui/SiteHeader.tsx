// Encabezado común a TODAS las páginas de la demo: mismo logo, misma posición del menú.
import { SiteMenu } from './SiteMenu';

export function SiteHeader({ current, status, onLab }: { current: 'app' | 'compare'; status?: string; onLab?: () => void }) {
  return (
    <header className="site-header">
      <a className="brand" href="./">
        <span className="brand-mark" aria-hidden="true">
          r
        </span>
        <span className="brand-word">
          rumbo<span>.ai</span>
        </span>
      </a>
      <div className="header-right">
        <span className="engine-pill mono" title="Motor de IA">
          {status || 'IA en tu navegador'}
        </span>
        <SiteMenu current={current} onLab={onLab} />
      </div>
    </header>
  );
}
