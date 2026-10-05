// Suscripciones GRANULARES al store: cada componente lee solo lo que necesita.
// Si llega texto del título, las tarjetas de hospedaje ni se enteran.
import { useSyncExternalStore } from 'react';
import type { DocStore, DocStatus, ListItem } from '../genui/doc-store';

export function useField<T = unknown>(store: DocStore, key: string): T | undefined {
  return useSyncExternalStore(store.subscribe, () => store.field<T>(key));
}

export function useItem(store: DocStore, key: string, index: number): ListItem | undefined {
  return useSyncExternalStore(store.subscribe, () => store.item(key, index));
}

export function useListLength(store: DocStore, key: string): number {
  return useSyncExternalStore(store.subscribe, () => store.state.lists[key]?.length ?? 0);
}

export function useStatus(store: DocStore): DocStatus {
  return useSyncExternalStore(store.subscribe, () => store.state.status);
}

/** El valor anterior (generación previa) para mostrar mientras llega el nuevo. */
export function usePrevious<T = unknown>(store: DocStore, key: string): T | undefined {
  return useSyncExternalStore(store.subscribe, () => store.state.previous?.[key] as T | undefined);
}
