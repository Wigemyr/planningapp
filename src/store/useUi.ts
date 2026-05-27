import { create } from 'zustand';

interface UiState {
  newItemOpen: boolean;
  newItemDefaults: { status?: string } | null;
  openNewItem: (defaults?: { status?: string }) => void;
  closeNewItem: () => void;

  newProjectOpen: boolean;
  openNewProject: () => void;
  closeNewProject: () => void;
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
}));
