// Íconos SVG (Lucide) en lugar de emojis: trazo uniforme, accesibles y consistentes entre sistemas.
// Para React usamos lucide-react; para strings HTML (vista ingenua, marcadores de Leaflet) usamos lucide.
import { Landmark, Mountain, TreePalm, Trees, Utensils, createElement, type IconNode } from 'lucide';
import type { PlaceKind } from '../trip/places';

const KIND_NODE: Record<PlaceKind, IconNode> = {
  playa: TreePalm,
  naturaleza: Trees,
  cultura: Landmark,
  aventura: Mountain,
  gastronomía: Utensils,
};

export function kindIconSvg(kind: PlaceKind, size = 18): string {
  const el = createElement(KIND_NODE[kind]);
  el.setAttribute('width', String(size));
  el.setAttribute('height', String(size));
  el.setAttribute('aria-hidden', 'true');
  return el.outerHTML;
}
