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
    dot: '#8b8fa3',
    tintBg: 'rgba(139,143,163,0.04)',
    border: 'rgba(139,143,163,0.0)',
  },
  active: {
    id: 'active',
    label: 'Active',
    dot: '#7170ff',
    tintBg: 'rgba(113,112,255,0.06)',
    border: 'rgba(113,112,255,0.18)',
    cardBorder: 'rgba(113,112,255,0.22)',
  },
  waiting: {
    id: 'waiting',
    label: 'Waiting',
    dot: '#f59e0b',
    tintBg: 'rgba(245,158,11,0.05)',
    border: 'rgba(245,158,11,0.0)',
  },
  blocked: {
    id: 'blocked',
    label: 'Blocked',
    dot: '#ef4444',
    tintBg: 'rgba(239,68,68,0.05)',
    border: 'rgba(239,68,68,0.0)',
    cardBorder: 'rgba(239,68,68,0.24)',
  },
  resolved: {
    id: 'resolved',
    label: 'Resolved',
    dot: '#10b981',
    tintBg: 'rgba(16,185,129,0.04)',
    border: 'rgba(16,185,129,0.0)',
    strike: true,
  },
  discarded: {
    id: 'discarded',
    label: 'Discarded',
    dot: '#6b6f78',
    tintBg: 'rgba(107,111,120,0.025)',
    border: 'rgba(107,111,120,0.0)',
    dim: true,
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

export const TYPE_CONFIG: Record<ItemType, TypeConfig> = {
  bug: {
    id: 'bug',
    label: 'Bug',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.22)',
  },
  feature: {
    id: 'feature',
    label: 'Feature',
    color: '#7170ff',
    bg: 'rgba(113,112,255,0.12)',
    border: 'rgba(113,112,255,0.22)',
  },
  task: {
    id: 'task',
    label: 'Task',
    color: '#8a8f99',
    bg: 'rgba(138,143,153,0.10)',
    border: 'rgba(138,143,153,0.20)',
  },
  idea: {
    id: 'idea',
    label: 'Idea',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.22)',
  },
};

export const PRIORITY_LABEL: Record<string, string> = {
  p0: 'P0',
  p1: 'P1',
  p2: 'P2',
  p3: 'P3',
};

export const PRIORITY_COLOR: Record<string, { color: string; bg: string }> = {
  p0: { color: '#ef4444', bg: 'rgba(239,68,68,0.14)' },
  p1: { color: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
  p2: { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  p3: { color: '#8a8f99', bg: 'rgba(138,143,153,0.10)' },
};

// Tints for use as the **trigger** background of property-panel selects.
export const STATUS_TINT: Record<Status, { bg: string; border: string; text: string }> = {
  backlog:   { bg: 'rgba(139,143,163,0.10)', border: 'rgba(139,143,163,0.28)', text: '#b0b3c4' },
  active:    { bg: 'rgba(113,112,255,0.12)', border: 'rgba(113,112,255,0.32)', text: '#b9b8ff' },
  waiting:   { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.32)',  text: '#fbbf24' },
  blocked:   { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.32)',   text: '#f87171' },
  resolved:  { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.32)',  text: '#34d399' },
  discarded: { bg: 'rgba(107,111,120,0.12)', border: 'rgba(107,111,120,0.28)', text: '#a1a4ad' },
};

export const PRIORITY_TINT: Record<string, { bg: string; border: string; text: string }> = {
  none: { bg: 'transparent',                 border: '#1c1f25',              text: '#8a8f99' },
  p0:   { bg: 'rgba(239,68,68,0.16)',        border: 'rgba(239,68,68,0.36)', text: '#f87171' },
  p1:   { bg: 'rgba(239,68,68,0.10)',        border: 'rgba(239,68,68,0.26)', text: '#f87171' },
  p2:   { bg: 'rgba(245,158,11,0.10)',       border: 'rgba(245,158,11,0.26)', text: '#fbbf24' },
  p3:   { bg: 'rgba(138,143,153,0.10)',      border: 'rgba(138,143,153,0.24)', text: '#a5a8b8' },
};

export const STORAGE_KEY = 'planningapp.db.v1';
export const SCHEMA_VERSION = 1;
