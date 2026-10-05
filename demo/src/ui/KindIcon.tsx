import { Landmark, Mountain, TreePalm, Trees, Utensils, type LucideIcon } from 'lucide-react';
import type { PlaceKind } from '../trip/places';

const KIND: Record<PlaceKind, LucideIcon> = { playa: TreePalm, naturaleza: Trees, cultura: Landmark, aventura: Mountain, gastronomía: Utensils };

export function KindIcon({ kind, size = 20 }: { kind: PlaceKind; size?: number }) {
  const Icon = KIND[kind];
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}
