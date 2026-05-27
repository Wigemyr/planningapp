import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, ATTACHMENTS_BUCKET } from '@/lib/supabase';
import type {
  Attachment,
  Comment,
  Item,
  ItemType,
  Notification,
  NotificationKind,
  Priority,
  Project,
  Status,
  User,
  Workspace,
} from '@/lib/types';
import { LEGACY_STATUS_REMAP } from '@/lib/types';

/** Normalize legacy statuses (e.g. 'discarded') to currently-supported ones. */
function normalizeStatus(s: string): Status {
  return (LEGACY_STATUS_REMAP[s] ?? s) as Status;
}

const CURRENT_WS_KEY = 'planning.currentWorkspaceId';

/* ---------- DB row types (matching the SQL migration) ---------- */

interface DbProfile { id: string; email: string; name: string; initials: string; color: string; created_at: string; }
interface DbWorkspace { id: string; name: string; initials: string; owner_id: string; created_at: string; }
interface DbProject { id: string; workspace_id: string; name: string; color: string; short_prefix: string; position: number | null; created_at: string; }
interface DbItem {
  id: string; workspace_id: string; project_id: string; short_id: string;
  title: string; description: string;
  status: Status; type: ItemType; priority: Priority;
  labels: string[]; assignee_id: string | null;
  position: number; created_at: string; updated_at: string;
  started_at: string | null; resolved_at: string | null;
  created_by: string | null; updated_by: string | null;
}
interface DbAttachment {
  id: string; item_id: string; filename: string; storage_path: string;
  size_bytes: number; mime_type: string; uploaded_by: string | null; created_at: string;
}
interface DbComment {
  id: string; workspace_id: string; item_id: string; author_id: string | null;
  body: string; mentions: string[] | null; created_at: string; updated_at: string;
}
interface DbNotification {
  id: string; recipient_id: string; workspace_id: string; item_id: string;
  comment_id: string | null; actor_id: string | null;
  kind: NotificationKind; read_at: string | null; created_at: string;
}

/* ---------- Mappers ---------- */

const dbToUser = (r: DbProfile): User => ({
  id: r.id, name: r.name, initials: r.initials, email: r.email, color: r.color,
});
const dbToWorkspace = (r: DbWorkspace): Workspace => ({
  id: r.id, name: r.name, initials: r.initials,
});
const dbToProject = (r: DbProject): Project => ({
  id: r.id,
  workspaceId: r.workspace_id,
  name: r.name,
  color: r.color,
  shortPrefix: r.short_prefix,
  position: r.position ?? 0,
});
const dbToAttachment = (r: DbAttachment): Attachment => ({
  id: r.id,
  filename: r.filename,
  storagePath: r.storage_path,
  sizeBytes: r.size_bytes,
  mimeType: r.mime_type,
  createdAt: r.created_at,
});
const dbToNotification = (r: DbNotification): Notification => ({
  id: r.id,
  recipientId: r.recipient_id,
  workspaceId: r.workspace_id,
  itemId: r.item_id,
  commentId: r.comment_id,
  actorId: r.actor_id,
  kind: r.kind,
  readAt: r.read_at,
  createdAt: r.created_at,
});
const dbToComment = (r: DbComment): Comment => ({
  id: r.id,
  workspaceId: r.workspace_id,
  itemId: r.item_id,
  authorId: r.author_id,
  body: r.body,
  mentions: r.mentions ?? [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const dbToItem = (r: DbItem, atts: DbAttachment[]): Item => ({
  id: r.id,
  shortId: r.short_id,
  workspaceId: r.workspace_id,
  projectId: r.project_id,
  title: r.title,
  description: r.description,
  status: normalizeStatus(r.status),
  type: r.type,
  priority: r.priority,
  labels: r.labels ?? [],
  assigneeId: r.assignee_id,
  attachments: atts.map(dbToAttachment),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  startedAt: r.started_at,
  resolvedAt: r.resolved_at,
  createdBy: r.created_by,
  updatedBy: r.updated_by,
  position: r.position,
});

/* ---------- Store ---------- */

interface NewItemInput {
  title: string;
  description?: string;
  projectId: string;
  type: ItemType;
  status?: Status;
  priority?: Priority;
  labels?: string[];
}

export interface WorkspaceMember {
  workspaceId: string;
  user: User;
  role: 'owner' | 'member';
}
export interface PendingInvite {
  id: string;
  workspaceId: string;
  email: string;
  invitedBy: string | null;
  createdAt: string;
}

interface StoreState {
  // identity
  currentUserId: string | null;
  currentUserEmail: string | null;
  users: User[];

  // domain
  workspaces: Workspace[];
  projects: Project[];
  items: Item[];
  comments: Comment[];
  notifications: Notification[];
  members: WorkspaceMember[];
  invites: PendingInvite[];

  // ui
  currentWorkspaceId: string | null;
  currentProjectId: string | null;
  /** True when the signed-in user has no workspace and no pending invite. */
  needsInvite: boolean;

  // status
  loading: boolean;
  errorMsg: string | null;

  // realtime
  channel: RealtimeChannel | null;

  // lifecycle
  bootstrap: () => Promise<void>;
  teardown: () => Promise<void>;
  signOut: () => Promise<void>;

  // members & invites
  inviteMember: (email: string) => Promise<{ kind: 'added_existing' | 'pending_invite' }>;
  revokeInvite: (inviteId: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  refreshMembersAndInvites: () => Promise<void>;

  // Workspaces
  createWorkspace: (name: string) => Promise<Workspace>;
  deleteWorkspace: (id: string) => Promise<void>;

  // Projects
  createProject: (input: { name: string; color: string; shortPrefix: string }) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  reorderProjects: (orderedIds: string[]) => Promise<void>;

  // CRUD (async, optimistic)
  createItem: (input: NewItemInput) => Promise<Item>;
  updateItem: (id: string, patch: Partial<Item>) => Promise<void>;
  moveItem: (id: string, newStatus: Status, newIndex: number) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;

  // comments
  addComment: (itemId: string, body: string, mentions: string[]) => Promise<Comment>;
  updateComment: (id: string, body: string, mentions: string[]) => Promise<void>;
  deleteComment: (id: string) => Promise<void>;

  // notifications
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;

  // attachments
  addAttachment: (itemId: string, file: File) => Promise<void>;
  addAttachmentsFromBlobs: (
    itemId: string,
    blobs: { blob: Blob; filename?: string }[],
  ) => Promise<void>;
  removeAttachment: (itemId: string, attachmentId: string) => Promise<void>;
  /** Refresh signed URLs for the given attachment ids. */
  refreshAttachmentUrls: (atts: Attachment[]) => Promise<Map<string, string>>;

  // ui
  setCurrentProject: (projectId: string | null) => void;
  setCurrentWorkspace: (id: string) => Promise<void>;

  // helpers
  currentUser: () => User | undefined;
  currentWorkspace: () => Workspace | undefined;
}

export const useStore = create<StoreState>((set, get) => ({
  currentUserId: null,
  currentUserEmail: null,
  users: [],
  workspaces: [],
  projects: [],
  items: [],
  comments: [],
  notifications: [],
  members: [],
  invites: [],
  currentWorkspaceId: null,
  currentProjectId: null,
  needsInvite: false,
  loading: false,
  errorMsg: null,
  channel: null,

  bootstrap: async () => {
    set({ loading: true, errorMsg: null, needsInvite: false });
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        set({ loading: false });
        return;
      }

      // Step 1: claim any pending invites for this email (idempotent if none).
      // Handles the case where the owner invited an already-signed-up user
      // (the handle_new_user trigger only fires for fresh signups).
      try {
        await supabase.rpc('claim_invites');
      } catch (err) {
        console.warn('[planning] claim_invites failed (non-fatal)', err);
      }

      // Step 2: load every profile we can see
      const { data: profilesRes } = await supabase.from('profiles').select('*');
      const profiles = (profilesRes ?? []) as DbProfile[];
      const users = profiles.map(dbToUser);

      // Step 3: my workspace memberships
      const { data: memberRes } = await supabase
        .from('workspace_members')
        .select('workspace_id, role, workspaces(*)')
        .eq('user_id', user.id);
      type MemberWithWs = { workspace_id: string; role: string; workspaces: DbWorkspace | null };
      let workspaces: DbWorkspace[] = ((memberRes ?? []) as unknown as MemberWithWs[])
        .map((m) => m.workspaces)
        .filter((w): w is DbWorkspace => !!w);

      // Step 4: if no workspace, only auto-create if this is the very first
      // user in the whole system. Otherwise show "pending invite" screen.
      if (workspaces.length === 0) {
        const { data: isFirst } = await supabase.rpc('is_first_user');
        if (!isFirst) {
          set({
            currentUserId: user.id,
            currentUserEmail: user.email ?? null,
            users,
            workspaces: [],
            projects: [],
            items: [],
            comments: [],
            notifications: [],
            members: [],
            invites: [],
            currentWorkspaceId: null,
            needsInvite: true,
            loading: false,
          });
          return;
        }
        // First user — create a personal workspace
        const emailPrefix = (user.email ?? 'me').split('@')[0];
        const wsName = `${capitalize(emailPrefix)}'s workspace`;
        const initials = emailPrefix.slice(0, 1).toUpperCase();
        const { data: newWs, error: wsErr } = await supabase
          .from('workspaces')
          .insert({ name: wsName, initials, owner_id: user.id })
          .select()
          .single();
        if (wsErr || !newWs) throw wsErr ?? new Error('Failed to create workspace');
        const { error: memErr } = await supabase
          .from('workspace_members')
          .insert({ workspace_id: newWs.id, user_id: user.id, role: 'owner' });
        if (memErr) throw memErr;
        await supabase.rpc('seed_default_projects', { p_workspace_id: newWs.id });
        workspaces = [newWs as DbWorkspace];
      }

      // Step 5: pick current workspace and load its data
      const persistedWsId = localStorage.getItem(CURRENT_WS_KEY);
      const currentWs = workspaces.find((w) => w.id === persistedWsId) ?? workspaces[0];

      const [{ data: projectsRes }, { data: itemsRes }] = await Promise.all([
        supabase.from('projects').select('*').eq('workspace_id', currentWs.id),
        supabase.from('items').select('*').eq('workspace_id', currentWs.id),
      ]);
      const dbProjects = (projectsRes ?? []) as DbProject[];
      const dbItems = (itemsRes ?? []) as DbItem[];
      const itemIds = dbItems.map((i) => i.id);
      const { data: attRes } =
        itemIds.length > 0
          ? await supabase.from('attachments').select('*').in('item_id', itemIds)
          : { data: [] as DbAttachment[] };
      const dbAtts = (attRes ?? []) as DbAttachment[];
      const attByItem = new Map<string, DbAttachment[]>();
      dbAtts.forEach((a) => {
        const arr = attByItem.get(a.item_id) ?? [];
        arr.push(a);
        attByItem.set(a.item_id, arr);
      });
      const items = dbItems.map((r) => dbToItem(r, attByItem.get(r.id) ?? []));

      // Comments across the workspace — cheap to load up-front so the detail
      // view renders instantly when navigated to.
      const { data: commentsRes } = await supabase
        .from('comments')
        .select('*')
        .eq('workspace_id', currentWs.id)
        .order('created_at', { ascending: true });
      const comments = ((commentsRes ?? []) as DbComment[]).map(dbToComment);

      // Notifications for the signed-in user. Scoped to this workspace so we
      // don't carry over bell badges from a workspace they just switched out
      // of. Limit recent so the bell popover doesn't have to paginate.
      const { data: notifRes } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .eq('workspace_id', currentWs.id)
        .order('created_at', { ascending: false })
        .limit(50);
      const notifications = ((notifRes ?? []) as DbNotification[]).map(dbToNotification);

      // Step 6: load members + invites for current workspace
      const { membersForWs, invitesForWs } = await fetchMembersAndInvites(
        currentWs.id,
        users,
      );

      set({
        currentUserId: user.id,
        currentUserEmail: user.email ?? null,
        users,
        workspaces: workspaces.map(dbToWorkspace),
        projects: dbProjects.map(dbToProject),
        items,
        comments,
        notifications,
        members: membersForWs,
        invites: invitesForWs,
        currentWorkspaceId: currentWs.id,
        needsInvite: false,
        loading: false,
      });

      localStorage.setItem(CURRENT_WS_KEY, currentWs.id);
      startRealtime(currentWs.id, set, get);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[planning] bootstrap failed:', message, err);
      set({ loading: false, errorMsg: message });
    }
  },

  teardown: async () => {
    const ch = get().channel;
    if (ch) {
      await supabase.removeChannel(ch);
    }
    set({
      currentUserId: null,
      currentUserEmail: null,
      users: [],
      workspaces: [],
      projects: [],
      items: [],
      comments: [],
      notifications: [],
      members: [],
      invites: [],
      currentWorkspaceId: null,
      currentProjectId: null,
      needsInvite: false,
      channel: null,
    });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    // teardown is called by AuthGate when session becomes null
  },

  createWorkspace: async (name) => {
    const userId = get().currentUserId;
    if (!userId) throw new Error('Not signed in');
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Workspace name is required');
    const initials = trimmed.slice(0, 1).toUpperCase() || '?';

    const { data: newWs, error: wsErr } = await supabase
      .from('workspaces')
      .insert({ name: trimmed, initials, owner_id: userId })
      .select()
      .single();
    if (wsErr || !newWs) throw wsErr ?? new Error('Failed to create workspace');

    const { error: memErr } = await supabase
      .from('workspace_members')
      .insert({ workspace_id: newWs.id, user_id: userId, role: 'owner' });
    if (memErr) throw memErr;

    // Seed default projects so the new workspace isn't empty
    try {
      await supabase.rpc('seed_default_projects', { p_workspace_id: newWs.id });
    } catch (err) {
      console.warn('[planning] seed_default_projects failed (non-fatal)', err);
    }

    const ws = dbToWorkspace(newWs as DbWorkspace);
    set((s) => ({ workspaces: [...s.workspaces, ws] }));
    // Switch into the new workspace — re-bootstrap loads its data + realtime.
    await get().setCurrentWorkspace(ws.id);
    return ws;
  },

  deleteWorkspace: async (id) => {
    const state = get();
    const target = state.workspaces.find((w) => w.id === id);
    if (!target) return;

    const { error } = await supabase.from('workspaces').delete().eq('id', id);
    if (error) throw error;

    // Optimistic local update
    const remaining = state.workspaces.filter((w) => w.id !== id);
    set({ workspaces: remaining });

    // If we just nuked the current workspace, jump into another one (or clear
    // state entirely if it was the last). setCurrentWorkspace re-bootstraps,
    // which also rebinds realtime.
    if (state.currentWorkspaceId === id) {
      if (remaining.length > 0) {
        await get().setCurrentWorkspace(remaining[0].id);
      } else {
        try {
          localStorage.removeItem(CURRENT_WS_KEY);
        } catch {
          // ignore
        }
        await get().teardown();
        await get().bootstrap();
      }
    }
  },

  createProject: async (input) => {
    const wsId = get().currentWorkspaceId;
    if (!wsId) throw new Error('No active workspace');
    const id = crypto.randomUUID();
    // New projects land at the end of the current order.
    const wsProjects = get().projects.filter((p) => p.workspaceId === wsId);
    const nextPosition = wsProjects.length === 0
      ? 1
      : Math.max(...wsProjects.map((p) => p.position)) + 1;
    const optimistic: Project = {
      id,
      workspaceId: wsId,
      name: input.name.trim() || 'Untitled project',
      color: input.color || '#5b8def',
      shortPrefix: (input.shortPrefix || 'PRJ').toUpperCase().slice(0, 6),
      position: nextPosition,
    };
    set((s) => ({ projects: [...s.projects, optimistic] }));
    const { data, error } = await supabase
      .from('projects')
      .insert({
        id,
        workspace_id: wsId,
        name: optimistic.name,
        color: optimistic.color,
        short_prefix: optimistic.shortPrefix,
        position: optimistic.position,
      })
      .select()
      .single();
    if (error || !data) {
      set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
      throw error ?? new Error('Failed to create project');
    }
    const final = dbToProject(data as DbProject);
    set((s) => ({ projects: s.projects.map((p) => (p.id === id ? final : p)) }));
    return final;
  },

  reorderProjects: async (orderedIds) => {
    const prev = get().projects;
    // Optimistic: assign 1..N positions in the given order, leave foreign workspaces alone.
    const idToIndex = new Map(orderedIds.map((id, i) => [id, i + 1]));
    set((s) => ({
      projects: s.projects.map((p) =>
        idToIndex.has(p.id) ? { ...p, position: idToIndex.get(p.id)! } : p,
      ),
    }));
    try {
      await Promise.all(
        orderedIds.map((id, i) =>
          supabase.from('projects').update({ position: i + 1 }).eq('id', id),
        ),
      );
    } catch (err) {
      // Rollback to previous order on failure.
      set({ projects: prev });
      throw err;
    }
  },

  deleteProject: async (id) => {
    const prev = get().projects.find((p) => p.id === id);
    if (!prev) return;
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      items: s.items.filter((i) => i.projectId !== id),
      currentProjectId: s.currentProjectId === id ? null : s.currentProjectId,
    }));
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) {
      set((s) => ({ projects: [...s.projects, prev] }));
      throw error;
    }
  },

  createItem: async (input) => {
    const state = get();
    const workspaceId = state.currentWorkspaceId;
    const userId = state.currentUserId;
    if (!workspaceId || !userId) throw new Error('Not signed in');

    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const targetStatus = input.status ?? 'backlog';

    // Position: bugs land at top of column, others appended.
    const colItems = state.items.filter(
      (i) => i.projectId === input.projectId && i.status === targetStatus,
    );
    const position =
      input.type === 'bug'
        ? Math.min(0, ...colItems.map((i) => i.position)) - 1
        : Math.max(-1, ...colItems.map((i) => i.position)) + 1;

    // Short id is allocated optimistically client-side from existing items
    // visible to us. May collide if two clients create at the same instant —
    // the DB unique constraint will catch it and we'll surface an error.
    const project = state.projects.find((p) => p.id === input.projectId);
    const prefix = project?.shortPrefix ?? 'ITM';
    const shortId = nextShortId(prefix, state.items.map((i) => i.shortId));

    const optimistic: Item = {
      id,
      shortId,
      workspaceId,
      projectId: input.projectId,
      title: input.title.trim() || 'Untitled',
      description: input.description ?? '',
      status: targetStatus,
      type: input.type,
      priority: input.priority ?? null,
      labels: input.labels ?? [],
      assigneeId: userId,
      attachments: [],
      createdAt: nowIso,
      updatedAt: nowIso,
      startedAt: targetStatus === 'active' ? nowIso : null,
      resolvedAt: targetStatus === 'resolved' ? nowIso : null,
      createdBy: userId,
      updatedBy: userId,
      position,
    };

    set((s) => ({ items: [...s.items, optimistic] }));

    const { data, error } = await supabase
      .from('items')
      .insert({
        id,
        workspace_id: workspaceId,
        project_id: input.projectId,
        short_id: shortId,
        title: optimistic.title,
        description: optimistic.description,
        status: optimistic.status,
        type: optimistic.type,
        priority: optimistic.priority,
        labels: optimistic.labels,
        assignee_id: optimistic.assigneeId,
        position: optimistic.position,
        started_at: optimistic.startedAt,
        resolved_at: optimistic.resolvedAt,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error || !data) {
      // Rollback
      set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
      throw error ?? new Error('Failed to create item');
    }
    // Merge authoritative server row
    const final = dbToItem(data as DbItem, []);
    set((s) => ({ items: s.items.map((i) => (i.id === id ? final : i)) }));
    return final;
  },

  updateItem: async (id, patch) => {
    const prev = get().items.find((i) => i.id === id);
    if (!prev) return;
    const currentUserId = get().currentUserId;

    // Compute derived timestamps
    const nowIso = new Date().toISOString();
    const merged: Item = {
      ...prev,
      ...patch,
      updatedAt: nowIso,
      updatedBy: currentUserId ?? prev.updatedBy,
      startedAt:
        patch.status === 'active' && !prev.startedAt ? nowIso : prev.startedAt,
      resolvedAt:
        patch.status === 'resolved'
          ? (prev.resolvedAt ?? nowIso)
          : patch.status
            ? null
            : prev.resolvedAt,
    };

    // Optimistic apply
    set((s) => ({ items: s.items.map((i) => (i.id === id ? merged : i)) }));

    const dbPatch: Record<string, unknown> = {};
    if (patch.title !== undefined) dbPatch.title = merged.title;
    if (patch.description !== undefined) dbPatch.description = merged.description;
    if (patch.status !== undefined) {
      dbPatch.status = merged.status;
      dbPatch.started_at = merged.startedAt;
      dbPatch.resolved_at = merged.resolvedAt;
    }
    if (patch.type !== undefined) dbPatch.type = merged.type;
    if (patch.priority !== undefined) dbPatch.priority = merged.priority;
    if (patch.projectId !== undefined) dbPatch.project_id = merged.projectId;
    if (patch.assigneeId !== undefined) dbPatch.assignee_id = merged.assigneeId;
    if (patch.labels !== undefined) dbPatch.labels = merged.labels;
    if (patch.position !== undefined) dbPatch.position = merged.position;
    // Stamp the updater on every persisted update so the Activity panel shows
    // "Updated by …" even for moves and reorders. created_by is never patched.
    if (currentUserId) dbPatch.updated_by = currentUserId;

    const { error } = await supabase.from('items').update(dbPatch).eq('id', id);
    if (error) {
      // Rollback
      set((s) => ({ items: s.items.map((i) => (i.id === id ? prev : i)) }));
      throw error;
    }
  },

  moveItem: async (id, newStatus, newIndex) => {
    const items = get().items;
    const moving = items.find((i) => i.id === id);
    if (!moving) return;

    // Compute new positions for the target column
    const colItems = items
      .filter((i) => i.status === newStatus && i.id !== id)
      .sort((a, b) => a.position - b.position);
    const newOrder = [...colItems];
    const idx = Math.max(0, Math.min(newIndex, newOrder.length));
    newOrder.splice(idx, 0, moving);

    // Renumber positions in this column
    const positionUpdates: Array<{ id: string; position: number }> = newOrder.map(
      (it, i) => ({ id: it.id, position: i }),
    );

    const nowIso = new Date().toISOString();
    const prevSnapshot = items.map((i) => ({
      id: i.id,
      position: i.position,
      status: i.status,
      startedAt: i.startedAt,
      resolvedAt: i.resolvedAt,
      updatedAt: i.updatedAt,
    }));

    // Optimistic apply
    set((s) => ({
      items: s.items.map((i) => {
        if (i.id === id) {
          return {
            ...i,
            status: newStatus,
            position: positionUpdates.find((p) => p.id === id)!.position,
            updatedAt: nowIso,
            startedAt:
              newStatus === 'active' && !i.startedAt ? nowIso : i.startedAt,
            resolvedAt:
              newStatus === 'resolved' ? (i.resolvedAt ?? nowIso) : null,
          };
        }
        const pu = positionUpdates.find((p) => p.id === i.id);
        if (pu) return { ...i, position: pu.position };
        return i;
      }),
    }));

    // Persist: one row update per position change. Small column sizes make this OK.
    try {
      // The moving item gets the rich patch
      const { error: movErr } = await supabase
        .from('items')
        .update({
          status: newStatus,
          position: positionUpdates.find((p) => p.id === id)!.position,
          started_at:
            newStatus === 'active' && !moving.startedAt ? nowIso : moving.startedAt,
          resolved_at:
            newStatus === 'resolved' ? (moving.resolvedAt ?? nowIso) : null,
        })
        .eq('id', id);
      if (movErr) throw movErr;

      // The other items only get the new position
      const others = positionUpdates.filter((p) => p.id !== id);
      await Promise.all(
        others.map((p) =>
          supabase.from('items').update({ position: p.position }).eq('id', p.id),
        ),
      );
    } catch (err) {
      // Rollback all
      set((s) => ({
        items: s.items.map((i) => {
          const snap = prevSnapshot.find((p) => p.id === i.id);
          if (!snap) return i;
          return {
            ...i,
            status: snap.status,
            position: snap.position,
            startedAt: snap.startedAt,
            resolvedAt: snap.resolvedAt,
            updatedAt: snap.updatedAt,
          };
        }),
      }));
      throw err;
    }
  },

  deleteItem: async (id) => {
    const prev = get().items.find((i) => i.id === id);
    if (!prev) return;
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) {
      set((s) => ({ items: [...s.items, prev] }));
      throw error;
    }
  },

  addComment: async (itemId, body, mentions) => {
    const state = get();
    const workspaceId = state.currentWorkspaceId;
    const userId = state.currentUserId;
    if (!workspaceId || !userId) throw new Error('Not signed in');
    const trimmed = body.trim();
    if (!trimmed) throw new Error('Comment cannot be empty');

    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const optimistic: Comment = {
      id,
      workspaceId,
      itemId,
      authorId: userId,
      body: trimmed,
      mentions,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    set((s) => ({ comments: [...s.comments, optimistic] }));

    const { data, error } = await supabase
      .from('comments')
      .insert({
        id,
        workspace_id: workspaceId,
        item_id: itemId,
        author_id: userId,
        body: trimmed,
        mentions,
      })
      .select()
      .single();
    if (error || !data) {
      set((s) => ({ comments: s.comments.filter((c) => c.id !== id) }));
      throw error ?? new Error('Failed to add comment');
    }
    const final = dbToComment(data as DbComment);
    set((s) => ({ comments: s.comments.map((c) => (c.id === id ? final : c)) }));
    return final;
  },

  updateComment: async (id, body, mentions) => {
    const prev = get().comments.find((c) => c.id === id);
    if (!prev) return;
    const trimmed = body.trim();
    if (!trimmed) throw new Error('Comment cannot be empty');
    const nowIso = new Date().toISOString();
    const merged: Comment = { ...prev, body: trimmed, mentions, updatedAt: nowIso };
    set((s) => ({ comments: s.comments.map((c) => (c.id === id ? merged : c)) }));
    const { error } = await supabase
      .from('comments')
      .update({ body: trimmed, mentions })
      .eq('id', id);
    if (error) {
      set((s) => ({ comments: s.comments.map((c) => (c.id === id ? prev : c)) }));
      throw error;
    }
  },

  deleteComment: async (id) => {
    const prev = get().comments.find((c) => c.id === id);
    if (!prev) return;
    set((s) => ({ comments: s.comments.filter((c) => c.id !== id) }));
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) {
      set((s) => ({ comments: [...s.comments, prev] }));
      throw error;
    }
  },

  markNotificationRead: async (id) => {
    const prev = get().notifications.find((n) => n.id === id);
    if (!prev || prev.readAt) return;
    const nowIso = new Date().toISOString();
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, readAt: nowIso } : n,
      ),
    }));
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: nowIso })
      .eq('id', id);
    if (error) {
      set((s) => ({
        notifications: s.notifications.map((n) => (n.id === id ? prev : n)),
      }));
      throw error;
    }
  },

  markAllNotificationsRead: async () => {
    const state = get();
    const userId = state.currentUserId;
    if (!userId) return;
    const unread = state.notifications.filter((n) => !n.readAt);
    if (unread.length === 0) return;
    const nowIso = new Date().toISOString();
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.readAt ? n : { ...n, readAt: nowIso },
      ),
    }));
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: nowIso })
      .eq('recipient_id', userId)
      .is('read_at', null);
    if (error) {
      // Rollback to prior unread set
      set((s) => ({
        notifications: s.notifications.map((n) => {
          if (!unread.some((u) => u.id === n.id)) return n;
          return { ...n, readAt: null };
        }),
      }));
      throw error;
    }
  },

  dismissNotification: async (id) => {
    const prev = get().notifications.find((n) => n.id === id);
    if (!prev) return;
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }));
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) {
      set((s) => ({ notifications: [...s.notifications, prev] }));
      throw error;
    }
  },

  addAttachment: async (itemId, file) => {
    await get().addAttachmentsFromBlobs(itemId, [{ blob: file, filename: file.name }]);
  },

  addAttachmentsFromBlobs: async (itemId, blobs) => {
    const state = get();
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return;
    const workspaceId = item.workspaceId;
    const userId = state.currentUserId;

    for (const { blob, filename } of blobs) {
      const ext = (blob.type.split('/')[1] || 'bin').replace('jpeg', 'jpg');
      const fileId = crypto.randomUUID();
      const storagePath = `${workspaceId}/${itemId}/${fileId}.${ext}`;
      const safeName =
        filename ||
        `pasted-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(storagePath, blob, {
          contentType: blob.type || 'application/octet-stream',
          cacheControl: '3600',
          upsert: false,
        });
      if (upErr) throw upErr;

      const { data: attRow, error: insErr } = await supabase
        .from('attachments')
        .insert({
          item_id: itemId,
          filename: safeName,
          storage_path: storagePath,
          size_bytes: blob.size,
          mime_type: blob.type || 'application/octet-stream',
          uploaded_by: userId,
        })
        .select()
        .single();
      if (insErr || !attRow) {
        // Best-effort cleanup of orphaned object
        await supabase.storage.from(ATTACHMENTS_BUCKET).remove([storagePath]);
        throw insErr ?? new Error('Failed to register attachment');
      }
      const att = dbToAttachment(attRow as DbAttachment);
      // Get a signed URL for immediate display
      const { data: signed } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .createSignedUrl(att.storagePath, 60 * 60 * 24);
      att.url = signed?.signedUrl;

      set((s) => ({
        items: s.items.map((i) =>
          i.id === itemId
            ? { ...i, attachments: [...i.attachments, att], updatedAt: att.createdAt }
            : i,
        ),
      }));
    }
  },

  removeAttachment: async (itemId, attachmentId) => {
    const item = get().items.find((i) => i.id === itemId);
    if (!item) return;
    const att = item.attachments.find((a) => a.id === attachmentId);
    if (!att) return;

    // Optimistic local remove
    set((s) => ({
      items: s.items.map((i) =>
        i.id === itemId
          ? { ...i, attachments: i.attachments.filter((a) => a.id !== attachmentId) }
          : i,
      ),
    }));

    const { error: dbErr } = await supabase
      .from('attachments')
      .delete()
      .eq('id', attachmentId);
    if (dbErr) {
      // Rollback
      set((s) => ({
        items: s.items.map((i) =>
          i.id === itemId ? { ...i, attachments: [...i.attachments, att] } : i,
        ),
      }));
      throw dbErr;
    }
    // Best-effort remove the storage object
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([att.storagePath]);
  },

  refreshAttachmentUrls: async (atts) => {
    const map = new Map<string, string>();
    if (atts.length === 0) return map;
    const paths = atts.map((a) => a.storagePath);
    const { data, error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrls(paths, 60 * 60 * 24);
    if (error || !data) return map;
    data.forEach((d, i) => {
      if (d.signedUrl) map.set(atts[i].id, d.signedUrl);
    });
    // Merge URLs into local state for cache
    set((s) => ({
      items: s.items.map((it) => ({
        ...it,
        attachments: it.attachments.map((a) =>
          map.has(a.id) ? { ...a, url: map.get(a.id) } : a,
        ),
      })),
    }));
    return map;
  },

  setCurrentProject: (projectId) => {
    set({ currentProjectId: projectId });
  },

  setCurrentWorkspace: async (id) => {
    const ws = get().workspaces.find((w) => w.id === id);
    if (!ws) return;
    localStorage.setItem(CURRENT_WS_KEY, id);
    // Re-bootstrap to load this workspace's data and re-bind realtime
    await get().teardown();
    await get().bootstrap();
  },

  currentUser: () => {
    const s = get();
    return s.users.find((u) => u.id === s.currentUserId);
  },
  currentWorkspace: () => {
    const s = get();
    return s.workspaces.find((w) => w.id === s.currentWorkspaceId);
  },

  inviteMember: async (email) => {
    const wsId = get().currentWorkspaceId;
    if (!wsId) throw new Error('No active workspace');
    const trimmed = email.trim();
    if (!trimmed) throw new Error('Email is required');
    const { data, error } = await supabase.rpc('invite_member', {
      p_workspace_id: wsId,
      p_email: trimmed,
    });
    if (error) throw error;
    await get().refreshMembersAndInvites();
    const kind = (data as { kind?: string } | null)?.kind === 'added_existing'
      ? ('added_existing' as const)
      : ('pending_invite' as const);
    return { kind };
  },

  revokeInvite: async (inviteId) => {
    const { error } = await supabase.rpc('revoke_invite', { p_invite_id: inviteId });
    if (error) throw error;
    set((s) => ({ invites: s.invites.filter((i) => i.id !== inviteId) }));
  },

  removeMember: async (userId) => {
    const wsId = get().currentWorkspaceId;
    if (!wsId) throw new Error('No active workspace');
    const { error } = await supabase.rpc('remove_member', {
      p_workspace_id: wsId,
      p_user_id: userId,
    });
    if (error) throw error;
    set((s) => ({ members: s.members.filter((m) => m.user.id !== userId) }));
  },

  refreshMembersAndInvites: async () => {
    const wsId = get().currentWorkspaceId;
    if (!wsId) return;
    const users = get().users;
    const { membersForWs, invitesForWs } = await fetchMembersAndInvites(wsId, users);
    set({ members: membersForWs, invites: invitesForWs });
  },
}));

async function fetchMembersAndInvites(
  workspaceId: string,
  knownUsers: User[],
): Promise<{ membersForWs: WorkspaceMember[]; invitesForWs: PendingInvite[] }> {
  const userMap = new Map(knownUsers.map((u) => [u.id, u]));
  // Members + their profiles (in case we don't already have them in users)
  const [{ data: membersRes }, { data: profilesRes }, { data: invitesRes }] =
    await Promise.all([
      supabase
        .from('workspace_members')
        .select('workspace_id, user_id, role')
        .eq('workspace_id', workspaceId),
      supabase.from('profiles').select('*'),
      supabase
        .from('workspace_invites')
        .select('*')
        .eq('workspace_id', workspaceId)
        .is('consumed_at', null),
    ]);
  (profilesRes ?? []).forEach((p: DbProfile) => userMap.set(p.id, dbToUser(p)));

  const membersForWs: WorkspaceMember[] = ((membersRes ?? []) as Array<{
    workspace_id: string;
    user_id: string;
    role: 'owner' | 'member';
  }>).map((m) => ({
    workspaceId: m.workspace_id,
    role: m.role,
    user:
      userMap.get(m.user_id) ?? {
        id: m.user_id,
        name: '(unknown user)',
        initials: '?',
        email: '',
        color: '#6b6f78',
      },
  }));

  const invitesForWs: PendingInvite[] = ((invitesRes ?? []) as Array<{
    id: string;
    workspace_id: string;
    email: string;
    invited_by: string | null;
    created_at: string;
  }>).map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    email: r.email,
    invitedBy: r.invited_by,
    createdAt: r.created_at,
  }));

  return { membersForWs, invitesForWs };
}

/* ---------- Sorting selector (used by Board) ---------- */

/** Rank each priority so P0 < P1 < P2 < P3 < no-priority when sorting. */
const PRIORITY_RANK: Record<string, number> = { p0: 0, p1: 1, p2: 2, p3: 3 };

export function sortForColumn(a: Item, b: Item): number {
  // Primary: priority (P0 first, no-priority last).
  const pa = a.priority ? PRIORITY_RANK[a.priority] : 4;
  const pb = b.priority ? PRIORITY_RANK[b.priority] : 4;
  if (pa !== pb) return pa - pb;
  // Tie-breaker: existing position so DnD within the same priority bucket still works.
  return a.position - b.position;
}

export function selectItemsByStatus(items: Item[], projectId: string | null) {
  const filtered = projectId ? items.filter((i) => i.projectId === projectId) : items;
  const byStatus: Record<Status, Item[]> = {
    backlog: [],
    active: [],
    waiting: [],
    blocked: [],
    resolved: [],
  };
  for (const i of filtered) byStatus[i.status].push(i);
  for (const k of Object.keys(byStatus) as Status[]) {
    byStatus[k].sort(sortForColumn);
  }
  return byStatus;
}

/* ---------- Realtime subscriptions ---------- */

function startRealtime(
  workspaceId: string,
  set: (
    partial:
      | Partial<StoreState>
      | ((s: StoreState) => Partial<StoreState>),
  ) => void,
  get: () => StoreState,
) {
  const channel = supabase
    .channel(`workspace:${workspaceId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'items',
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id;
          if (!id) return;
          set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
          return;
        }
        const row = payload.new as DbItem;
        // Preserve any locally-attached attachments+url state
        const existing = get().items.find((i) => i.id === row.id);
        const next = dbToItem(row, []);
        next.attachments = existing?.attachments ?? [];
        set((s) => {
          if (existing) {
            return { items: s.items.map((i) => (i.id === row.id ? next : i)) };
          }
          return { items: [...s.items, next] };
        });
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id;
          if (!id) return;
          set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
          return;
        }
        const project = dbToProject(payload.new as DbProject);
        set((s) => {
          const exists = s.projects.find((p) => p.id === project.id);
          if (exists)
            return { projects: s.projects.map((p) => (p.id === project.id ? project : p)) };
          return { projects: [...s.projects, project] };
        });
      },
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'attachments' },
      async (payload) => {
        const row = payload.new as DbAttachment;
        const item = get().items.find((i) => i.id === row.item_id);
        if (!item) return; // not in our workspace
        if (item.attachments.find((a) => a.id === row.id)) return; // we already have it
        const att = dbToAttachment(row);
        const { data: signed } = await supabase.storage
          .from(ATTACHMENTS_BUCKET)
          .createSignedUrl(att.storagePath, 60 * 60 * 24);
        att.url = signed?.signedUrl;
        set((s) => ({
          items: s.items.map((i) =>
            i.id === row.item_id
              ? { ...i, attachments: [...i.attachments, att] }
              : i,
          ),
        }));
      },
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'attachments' },
      (payload) => {
        const oldRow = payload.old as { id?: string; item_id?: string };
        if (!oldRow.id) return;
        set((s) => ({
          items: s.items.map((i) =>
            oldRow.item_id && i.id === oldRow.item_id
              ? { ...i, attachments: i.attachments.filter((a) => a.id !== oldRow.id) }
              : i,
          ),
        }));
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'comments',
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id;
          if (!id) return;
          set((s) => ({ comments: s.comments.filter((c) => c.id !== id) }));
          return;
        }
        const comment = dbToComment(payload.new as DbComment);
        set((s) => {
          const exists = s.comments.find((c) => c.id === comment.id);
          if (exists) {
            return {
              comments: s.comments.map((c) => (c.id === comment.id ? comment : c)),
            };
          }
          return { comments: [...s.comments, comment] };
        });
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => {
        const myId = get().currentUserId;
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id;
          if (!id) return;
          set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }));
          return;
        }
        const row = payload.new as DbNotification;
        // RLS keeps other recipients' rows out of the response, but the
        // realtime stream isn't policy-filtered — gate client-side.
        if (myId && row.recipient_id !== myId) return;
        const notif = dbToNotification(row);
        set((s) => {
          const exists = s.notifications.find((n) => n.id === notif.id);
          if (exists) {
            return {
              notifications: s.notifications.map((n) =>
                n.id === notif.id ? notif : n,
              ),
            };
          }
          return { notifications: [notif, ...s.notifications] };
        });
      },
    )
    .subscribe();

  set({ channel });
}

/* ---------- helpers ---------- */

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function nextShortId(prefix: string, existing: string[]): string {
  let max = 0;
  for (const id of existing) {
    const m = id.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}
