import { create } from 'zustand';

const SIDEBAR_KEY = 'planning.sidebarCollapsed';
const BOARD_LAYOUT_KEY = 'planning.boardLayout';

export type BoardLayout = 'horizontal' | 'vertical';

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

  boardLayout: BoardLayout;
  toggleBoardLayout: () => void;
}

function initialSidebar(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
}

/** First time: pick based on viewport (portrait → vertical, else horizontal).
 * After the user toggles, their choice persists in localStorage. */
function initialBoardLayout(): BoardLayout {
  try {
    const saved = localStorage.getItem(BOARD_LAYOUT_KEY);
    if (saved === 'horizontal' || saved === 'vertical') return saved;
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
    return 'vertical';
  }
  return 'horizontal';
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

  boardLayout: initialBoardLayout(),
  toggleBoardLayout: () =>
    set((s) => {
      const next: BoardLayout = s.boardLayout === 'horizontal' ? 'vertical' : 'horizontal';
      try {
        localStorage.setItem(BOARD_LAYOUT_KEY, next);
      } catch {
        // ignore
      }
      return { boardLayout: next };
    }),
}));
