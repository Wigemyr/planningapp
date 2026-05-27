import { create } from 'zustand';

const SIDEBAR_KEY = 'planning.sidebarCollapsed';

interface UiState {
  newItemOpen: boolean;
  newItemDefaults: { status?: string } | null;
  openNewItem: (defaults?: { status?: string }) => void;
  closeNewItem: () => void;

  newProjectOpen: boolean;
  openNewProject: () => void;
  closeNewProject: () => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

function initialSidebar(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
}

export const useUi = create<UiState>((set) => ({
  newItemOpen: false,
  newItemDefaults: null,
  openNewItem: (defaults) =>
    set({ newItemOpen: true, newItemDefaults: defaults ?? null }),
  closeNewItem: () => set({ newItemOpen: false, newItemDefaults: null }),

  newProjectOpen: false,
  openNewProject: () => set({ newProjectOpen: true }),
  closeNewProject: () => set({ newProjectOpen: false }),

  sidebarCollapsed: initialSidebar(),
  toggleSidebar: () =>
    set((s) => {
      const next = !s.sidebarCollapsed;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return { sidebarCollapsed: next };
    }),
}));
