import type { Status, ItemType } from './types';

export interface StatusConfig {
  id: Status;
  label: string;
  dot: string;       // CSS color for the dot
  tintBg: string;    // subtle column background
  border: string;    // optional column border tint
  cardBorder?: string; // tint for the card border in this column (active/blocked)
  dim?: boolean;     // visually de-emphasize cards (hold/discard)
  strike?: boolean;  // strike-through titles (resolved/discarded)
}

export const STATUS_CONFIG: Record<Status, StatusConfig> = {
  backlog: {
    id: 'backlog',
    label: 'Backlog',
    dot: '#8a8a8d',
    tintBg: 'transparent',
    border: 'transparent',
  },
  active: {
    id: 'active',
    label: 'Active',
    dot: '#5b8def',
    tintBg: 'transparent',
    border: 'transparent',
    cardBorder: 'rgba(91,141,239,0.22)',
  },
  waiting: {
    id: 'waiting',
    label: 'Waiting',
    dot: '#c79348',
    tintBg: 'transparent',
    border: 'transparent',
  },
  blocked: {
    id: 'blocked',
    label: 'Blocked',
    dot: '#c66e6b',
    tintBg: 'transparent',
    border: 'transparent',
    cardBorder: 'rgba(198,110,107,0.24)',
  },
  resolved: {
    id: 'resolved',
    label: 'Resolved',
    dot: '#6aa57d',
    tintBg: 'transparent',
    border: 'transparent',
    strike: true,
  },
};

export interface TypeConfig {
  id: ItemType;
  label: string;
  color: string;
  bg: string;
  border: string;
}

/** Warm-neutral type palette shared by the board card pills, the detail-page
 * Type chip, and the new-item type picker. Kept aligned with TYPE_PILL in
 * ItemCard.tsx so the colour you see on a card matches the chip on its detail. */
export const TYPE_CONFIG: Record<ItemType, TypeConfig> = {
  bug: {
    id: 'bug',
    label: 'Bug',
    color: '#c66e6b',
    bg: 'rgba(198,110,107,0.12)',
    border: 'rgba(198,110,107,0.24)',
  },
  feature: {
    id: 'feature',
    label: 'Feature',
    color: '#6aa57d',
    bg: 'rgba(106,165,125,0.12)',
    border: 'rgba(106,165,125,0.24)',
  },
  task: {
    id: 'task',
    label: 'Task',
    color: '#bda88a',
    bg: 'rgba(168,150,125,0.12)',
    border: 'rgba(168,150,125,0.24)',
  },
  idea: {
    id: 'idea',
    label: 'Idea',
    color: '#c79348',
    bg: 'rgba(199,147,72,0.12)',
    border: 'rgba(199,147,72,0.24)',
  },
};

/** Compact label for pills (cards, detail meta row). Stays short on purpose. */
export const PRIORITY_LABEL: Record<string, string> = {
  p0: 'P0',
  p1: 'P1',
  p2: 'P2',
  p3: 'P3',
};

/** Full label for menus and pickers where you have room to spell out the
 * severity ("P0 alone could be misread as the lowest level). */
export const PRIORITY_LABEL_FULL: Record<string, string> = {
  p0: 'P0 — Critical',
  p1: 'P1 — High',
  p2: 'P2 — Medium',
  p3: 'P3 — Low',
};

/** Priority colour ramp — hot to cool, so urgency reads at a glance.
 *   P0 critical -> warm brick red
 *   P1 high     -> warm amber
 *   P2 medium   -> warm parchment tan
 *   P3 low      -> neutral grey
 * P0 vs P1 used to share the same brick red, only differentiated by bg alpha.
 * That wasn't enough at pill size — they looked identical on a card. */
export const PRIORITY_COLOR: Record<string, { color: string; bg: string }> = {
  p0: { color: '#d68a86', bg: 'rgba(198,110,107,0.16)' },
  p1: { color: '#d49e5f', bg: 'rgba(199,147,72,0.14)' },
  p2: { color: '#bda88a', bg: 'rgba(168,150,125,0.12)' },
  p3: { color: '#8a8a8d', bg: 'rgba(138,138,141,0.10)' },
};

// Tints for use as the **trigger** background of property-panel selects.
export const STATUS_TINT: Record<Status, { bg: string; border: string; text: string }> = {
  backlog:   { bg: 'rgba(138,138,141,0.10)', border: 'rgba(138,138,141,0.28)', text: '#b8b8bb' },
  active:    { bg: 'rgba(91,141,239,0.12)',  border: 'rgba(91,141,239,0.32)',  text: '#a5b9f4' },
  waiting:   { bg: 'rgba(199,147,72,0.12)',  border: 'rgba(199,147,72,0.32)',  text: '#d49e5f' },
  blocked:   { bg: 'rgba(198,110,107,0.12)', border: 'rgba(198,110,107,0.32)', text: '#d68a86' },
  resolved:  { bg: 'rgba(106,165,125,0.12)', border: 'rgba(106,165,125,0.32)', text: '#8bbb9c' },
};

/** Mirror of PRIORITY_COLOR for the detail-page Priority select trigger. */
export const PRIORITY_TINT: Record<string, { bg: string; border: string; text: string }> = {
  none: { bg: 'transparent',                 border: 'rgba(255,255,255,0.10)', text: '#8a8a8d' },
  p0:   { bg: 'rgba(198,110,107,0.16)',      border: 'rgba(198,110,107,0.36)', text: '#d68a86' },
  p1:   { bg: 'rgba(199,147,72,0.14)',       border: 'rgba(199,147,72,0.32)',  text: '#d49e5f' },
  p2:   { bg: 'rgba(168,150,125,0.12)',      border: 'rgba(168,150,125,0.28)', text: '#bda88a' },
  p3:   { bg: 'rgba(138,138,141,0.10)',      border: 'rgba(138,138,141,0.24)', text: '#b8b8bb' },
};

export const STORAGE_KEY = 'planningapp.db.v1';
export const SCHEMA_VERSION = 1;
