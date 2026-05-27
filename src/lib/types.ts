export const STATUSES = [
  'backlog',
  'active',
  'waiting',
  'blocked',
  'resolved',
] as const;
export type Status = (typeof STATUSES)[number];

/** Statuses that still exist in the DB but are no longer surfaced.
 * Loaded items in any of these are folded into `resolved` at read time. */
export const LEGACY_STATUS_REMAP: Record<string, Status> = {
  discarded: 'resolved',
};

export const ITEM_TYPES = ['bug', 'feature', 'task', 'idea'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const PRIORITIES = ['p0', 'p1', 'p2', 'p3'] as const;
export type Priority = (typeof PRIORITIES)[number] | null;

export interface Workspace {
  id: string;
  name: string;
  initials: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  shortPrefix: string; // e.g. "ACM" for short IDs like ACM-119
  position: number;
}

export interface Attachment {
  id: string;
  filename: string;
  /** Path inside the Supabase `attachments` bucket (workspaceId/itemId/uuid.ext). */
  storagePath: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: string;
  /** Optional transient signed URL — populated on demand by the detail view. */
  url?: string;
}

export interface Item {
  id: string;
  shortId: string; // ACM-119
  workspaceId: string;
  projectId: string;
  title: string;
  description: string;
  status: Status;
  type: ItemType;
  priority: Priority;
  labels: string[];
  assigneeId: string | null;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  resolvedAt: string | null;
  /** Profile id of the person who created this item. NULL for items created
   * before the column existed, or if the author's profile was deleted. */
  createdBy: string | null;
  /** Profile id of the most recent updater. Stamped by updateItem. */
  updatedBy: string | null;
  /** Ordering within a column. Lower = higher. Bugs ignore this within their group. */
  position: number;
}

export interface User {
  id: string;
  name: string;
  initials: string;
  email: string;
  color: string;
}

export interface Comment {
  id: string;
  workspaceId: string;
  itemId: string;
  authorId: string | null;
  /** HTML produced by RichTextEditor. */
  body: string;
  /** Profile ids the author @-mentioned. Drives notifications later. */
  mentions: string[];
  createdAt: string;
  updatedAt: string;
}

// (DbShape was for the localStorage v1 store; v2 fetches live from Supabase.)
