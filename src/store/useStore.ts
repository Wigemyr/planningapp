import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, ATTACHMENTS_BUCKET } from '@/lib/supabase';
import type {
  Attachment,
  Item,
  ItemType,
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
}
interface DbAttachment {
  id: string; item_id: string; filename: string; storage_path: string;
  size_bytes: number; mime_type: string; uploaded_by: string | null; created_at: string;
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

  // Projects
  createProject: (input: { name: string; color: string; shortPrefix: string }) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  reorderProjects: (orderedIds: string[]) => Promise<void>;

  // CRUD (async, optimistic)
  createItem: (input: NewItemInput) => Promise<Item>;
  updateItem: (id: string, patch: Partial<Item>) => Promise<void>;
  moveItem: (id: string, newStatus: Status, newIndex: number) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;

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

      // Step 4: if no workspace, only auto-create if this is the very first user
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
            members: [],
            invites: [],
            currentWorkspaceId: null,
            needsInvite: true,
            loading: false,
          });
          return;
        }
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
  },

  createProject: async (input) => {
    const wsId = get().currentWorkspaceId;
    if (!wsId) throw new Error('No active workspace');
    const id = crypto.randomUUID();
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

    const colItems = state.items.filter(
      (i) => i.projectId === input.projectId && i.status === targetStatus,
    );
    const position =
      input.type === 'bug'
        ? Math.min(0, ...colItems.map((i) => i.position)) - 1
        : Math.max(-1, ...colItems.map((i) => i.position)) + 1;

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
      })
      .select()
      .single();

    if (error || !data) {
      set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
      throw error ?? new Error('Failed to create item');
    }
    const final = dbToItem(data as DbItem, []);
    set((s) => ({ items: s.items.map((i) => (i.id === id ? final : i)) }));
    return final;
  },

  updateItem: async (id, patch) => {
    const prev = get().items.find((i) => i.id === id);
    if (!prev) return;

    const nowIso = new Date().toISOString();
    const merged: Item = {
      ...prev,
      ...patch,
      updatedAt: nowIso,
      startedAt:
        patch.status === 'active' && !prev.startedAt ? nowIso : prev.startedAt,
      resolvedAt:
        patch.status === 'resolved'
          ? (prev.resolvedAt ?? nowIso)
          : patch.status
            ? null
            : prev.resolvedAt,
    };

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

    const { error } = await supabase.from('items').update(dbPatch).eq('id', id);
    if (error) {
      set((s) => ({ items: s.items.map((i) => (i.id === id ? prev : i)) }));
      throw error;
    }
  },

  moveItem: async (id, newStatus, newIndex) => {
    const items = get().items;
    const moving = items.find((i) => i.id === id);
    if (!moving) return;

    const colItems = items
      .filter((i) => i.status === newStatus && i.id !== id)
      .sort((a, b) => a.position - b.position);
    const newOrder = [...colItems];
    const idx = Math.max(0, Math.min(newIndex, newOrder.length));
    newOrder.splice(idx, 0, moving);

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

    try {
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

      const others = positionUpdates.filter((p) => p.id !== id);
      await Promise.all(
        others.map((p) =>
          supabase.from('items').update({ position: p.position }).eq('id', p.id),
        ),
      );
    } catch (err) {
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
        await supabase.storage.from(ATTACHMENTS_BUCKET).remove([storagePath]);
        throw insErr ?? new Error('Failed to register attachment');
      }
      const att = dbToAttachment(attRow as DbAttachment);
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
      set((s) => ({
        items: s.items.map((i) =>
          i.id === itemId ? { ...i, attachments: [...i.attachments, att] } : i,
        ),
      }));
      throw dbErr;
    }
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

export function sortForColumn(a: Item, b: Item): number {
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
        if (!item) return;
        if (item.attachments.find((a) => a.id === row.id)) return;
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
    .subscribe();

  set({ channel });
}

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
