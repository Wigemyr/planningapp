import { create } from 'zustand';
import type { ReactNode } from 'react';

const SIDEBAR_KEY = 'planning.sidebarCollapsed';
const BOARD_LAYOUT_KEY = 'planning.boardLayout';

export type BoardLayout = 'horizontal' | 'vertical';

export interface ConfirmConfig {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button in the danger red tone (for destructive ops). */
  danger?: boolean;
  /** Called when the user confirms. May be async — the dialog stays open with a
   * "Working…" label while the promise resolves, then closes on success. */
  onConfirm: () => void | Promise<void>;
}

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  /** Render in the destructive red tone. */
  danger?: boolean;
  /** Disabled items still render but don't fire. */
  disabled?: boolean;
  onClick: () => void;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

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

  confirmDialog: ConfirmConfig | null;
  openConfirm: (cfg: ConfirmConfig) => void;
  closeConfirm: () => void;

  contextMenu: ContextMenuState | null;
  openContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
  closeContextMenu: () => void;

  /** When non-null, ProjectAppearanceDialog renders for this project id. */
  appearanceProjectId: string | null;
  openProjectAppearance: (projectId: string) => void;
  closeProjectAppearance: () => void;

  agentChatOpen: boolean;
  toggleAgentChat: () => void;
  closeAgentChat: () => void;
}

function initialSidebar(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
}

/** Always defaults to horizontal. User flips with the toggle button — choice
 * persists in localStorage. No auto-detection based on viewport. */
function initialBoardLayout(): BoardLayout {
  try {
    const saved = localStorage.getItem(BOARD_LAYOUT_KEY);
    if (saved === 'horizontal' || saved === 'vertical') return saved;
  } catch {
    // ignore
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

  confirmDialog: null,
  openConfirm: (cfg) => set({ confirmDialog: cfg }),
  closeConfirm: () => set({ confirmDialog: null }),

  contextMenu: null,
  openContextMenu: (x, y, items) => set({ contextMenu: { x, y, items } }),
  closeContextMenu: () => set({ contextMenu: null }),

  appearanceProjectId: null,
  openProjectAppearance: (projectId) => set({ appearanceProjectId: projectId }),
  closeProjectAppearance: () => set({ appearanceProjectId: null }),

  agentChatOpen: false,
  toggleAgentChat: () => set((s) => ({ agentChatOpen: !s.agentChatOpen })),
  closeAgentChat: () => set({ agentChatOpen: false }),
}));
