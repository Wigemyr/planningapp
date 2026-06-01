import { useMemo } from 'react';
import { create } from 'zustand';
import type { Item, ItemType, Priority } from '@/lib/types';

export const CREATED_WITHIN_OPTIONS = ['24h', '7d', '30d'] as const;
export type CreatedWithin = (typeof CREATED_WITHIN_OPTIONS)[number] | null;

export const CREATED_WITHIN_LABEL: Record<Exclude<CreatedWithin, null>, string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};

interface FiltersState {
  search: string;
  assignees: string[];        // user ids
  priorities: Priority[];     // includes null for "no priority"
  types: ItemType[];
  labels: string[];
  createdWithin: CreatedWithin;

  setSearch: (s: string) => void;
  toggleAssignee: (id: string) => void;
  togglePriority: (p: Priority) => void;
  toggleType: (t: ItemType) => void;
  toggleLabel: (l: string) => void;
  setCreatedWithin: (v: CreatedWithin) => void;
  clearAll: () => void;

  hasActive: () => boolean;
}

function toggleIn<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export const useFilters = create<FiltersState>((set, get) => ({
  search: '',
  assignees: [],
  priorities: [],
  types: [],
  labels: [],
  createdWithin: null,

  setSearch: (s) => set({ search: s }),
  toggleAssignee: (id) => set((st) => ({ assignees: toggleIn(st.assignees, id) })),
  togglePriority: (p) => set((st) => ({ priorities: toggleIn(st.priorities, p) })),
  toggleType: (t) => set((st) => ({ types: toggleIn(st.types, t) })),
  toggleLabel: (l) => set((st) => ({ labels: toggleIn(st.labels, l) })),
  setCreatedWithin: (v) => set({ createdWithin: v }),
  clearAll: () =>
    set({
      search: '',
      assignees: [],
      priorities: [],
      types: [],
      labels: [],
      createdWithin: null,
    }),

  hasActive: () => {
    const s = get();
    return (
      s.search.length > 0 ||
      s.assignees.length > 0 ||
      s.priorities.length > 0 ||
      s.types.length > 0 ||
      s.labels.length > 0 ||
      s.createdWithin !== null
    );
  },
}));

const MS = { '24h': 86_400_000, '7d': 7 * 86_400_000, '30d': 30 * 86_400_000 };

/** Apply the active filters to a list of items. */
export function useFilteredItems(items: Item[]): Item[] {
  const search = useFilters((s) => s.search);
  const assignees = useFilters((s) => s.assignees);
  const priorities = useFilters((s) => s.priorities);
  const types = useFilters((s) => s.types);
  const labels = useFilters((s) => s.labels);
  const createdWithin = useFilters((s) => s.createdWithin);

  return useMemo(() => {
    const needle = search.trim().toLowerCase();
    const cutoff = createdWithin ? Date.now() - MS[createdWithin] : null;
    return items.filter((it) => {
      if (needle) {
        const hay = `${it.shortId} ${it.title} ${it.description}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (assignees.length > 0) {
        if (!it.assigneeId || !assignees.includes(it.assigneeId)) return false;
      }
      if (priorities.length > 0) {
        if (!priorities.includes(it.priority)) return false;
      }
      if (types.length > 0) {
        if (!types.includes(it.type)) return false;
      }
      if (labels.length > 0) {
        if (!labels.some((l) => it.labels.includes(l))) return false;
      }
      if (cutoff !== null) {
        if (new Date(it.createdAt).getTime() < cutoff) return false;
      }
      return true;
    });
  }, [items, search, assignees, priorities, types, labels, createdWithin]);
}
