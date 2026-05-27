import { useMemo } from 'react';
import { create } from 'zustand';
import type { Item, ItemType, Priority } from '@/lib/types';
import { useStore } from './useStore';

interface FiltersState {
  search: string;
  assignees: string[];        // user ids; ['me'] is a magic value resolved at filter-time
  priorities: Priority[];     // includes null for "no priority"
  types: ItemType[];
  labels: string[];

  setSearch: (s: string) => void;
  toggleAssignee: (id: string) => void;
  togglePriority: (p: Priority) => void;
  toggleType: (t: ItemType) => void;
  toggleLabel: (l: string) => void;
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

  setSearch: (s) => set({ search: s }),
  toggleAssignee: (id) => set((st) => ({ assignees: toggleIn(st.assignees, id) })),
  togglePriority: (p) => set((st) => ({ priorities: toggleIn(st.priorities, p) })),
  toggleType: (t) => set((st) => ({ types: toggleIn(st.types, t) })),
  toggleLabel: (l) => set((st) => ({ labels: toggleIn(st.labels, l) })),
  clearAll: () =>
    set({ search: '', assignees: [], priorities: [], types: [], labels: [] }),

  hasActive: () => {
    const s = get();
    return (
      s.search.length > 0 ||
      s.assignees.length > 0 ||
      s.priorities.length > 0 ||
      s.types.length > 0 ||
      s.labels.length > 0
    );
  },
}));

/** Apply the active filters to a list of items. */
export function useFilteredItems(items: Item[]): Item[] {
  const search = useFilters((s) => s.search);
  const assignees = useFilters((s) => s.assignees);
  const priorities = useFilters((s) => s.priorities);
  const types = useFilters((s) => s.types);
  const labels = useFilters((s) => s.labels);
  const currentUserId = useStore((s) => s.currentUserId);

  return useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((it) => {
      if (needle) {
        const hay = `${it.shortId} ${it.title} ${it.description}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (assignees.length > 0) {
        const want = assignees.map((a) => (a === 'me' ? currentUserId : a));
        const matches = want.some(
          (uid) => uid != null && it.assigneeId === uid,
        );
        if (!matches) return false;
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
      return true;
    });
  }, [items, search, assignees, priorities, types, labels, currentUserId]);
}
