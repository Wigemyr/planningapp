import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { useUi } from '@/store/useUi';
import { getProjectIcon } from '@/lib/projectAppearance';
import { ArrowLeft, Trash2, Loader2 } from '@/components/icons';
import { formatRelative } from '@/lib/format';
import type { Project, Workspace } from '@/lib/types';

/**
 * Trash bin — lists soft-deleted workspaces and projects with Restore and
 * Delete permanently actions. Items themselves aren't soft-deleted; they're
 * hidden because their project (or workspace) is, and they come back on
 * restore.
 */
export default function TrashRoute() {
  const navigate = useNavigate();
  const workspace = useStore((s) => s.currentWorkspace());
  const loadTrash = useStore((s) => s.loadTrash);
  const restoreWorkspace = useStore((s) => s.restoreWorkspace);
  const restoreProject = useStore((s) => s.restoreProject);
  const purgeWorkspace = useStore((s) => s.purgeWorkspace);
  const purgeProject = useStore((s) => s.purgeProject);
  const openConfirm = useUi((s) => s.openConfirm);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [trashedWorkspaces, setTrashedWorkspaces] = useState<Workspace[]>([]);
  const [trashedProjects, setTrashedProjects] = useState<Project[]>([]);
  /** Set of ids currently being restored or purged. Drives per-row spinners. */
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  async function refresh() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const r = await loadTrash();
      setTrashedWorkspaces(r.workspaces);
      setTrashedProjects(r.projects);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to load trash',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function withBusy(id: string, work: () => Promise<void>) {
    setBusyIds((s) => new Set(s).add(id));
    return work().finally(() =>
      setBusyIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      }),
    );
  }

  function handleRestoreWorkspace(ws: Workspace) {
    withBusy(ws.id, async () => {
      try {
        await restoreWorkspace(ws.id);
        // restoreWorkspace re-bootstraps, so we won't unmount cleanly — but
        // refresh the local list defensively in case the user is still here.
        await refresh();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Restore failed');
      }
    });
  }

  function handlePurgeWorkspace(ws: Workspace) {
    openConfirm({
      title: `Permanently delete "${ws.name}"?`,
      description: (
        <>
          This will permanently delete the workspace along with{' '}
          <strong className="text-ink">all of its projects, items, comments, and attachments</strong>.
          {' '}This cannot be undone.
        </>
      ),
      confirmLabel: 'Delete forever',
      danger: true,
      onConfirm: async () => {
        await withBusy(ws.id, async () => {
          try {
            await purgeWorkspace(ws.id);
            await refresh();
          } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Delete failed');
            throw err;
          }
        });
      },
    });
  }

  function handleRestoreProject(p: Project) {
    withBusy(p.id, async () => {
      try {
        await restoreProject(p.id);
        await refresh();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Restore failed');
      }
    });
  }

  function handlePurgeProject(p: Project) {
    openConfirm({
      title: `Permanently delete "${p.name}"?`,
      description: (
        <>
          This will permanently delete the project and all of its items,
          comments, and attachments. This cannot be undone.
        </>
      ),
      confirmLabel: 'Delete forever',
      danger: true,
      onConfirm: async () => {
        await withBusy(p.id, async () => {
          try {
            await purgeProject(p.id);
            await refresh();
          } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Delete failed');
            throw err;
          }
        });
      },
    });
  }

  const empty = !loading && trashedWorkspaces.length === 0 && trashedProjects.length === 0;

  return (
    <>
      <header className="h-12 border-b border-line flex items-center px-4 gap-3 shrink-0">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-[12.5px] px-1.5 py-1 rounded hover:bg-white/[0.04] text-ink-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
          Board
        </button>
        <div className="flex items-center gap-2 text-[12.5px]">
          <span className="text-ink-subtle">›</span>
          <span className="text-ink-muted">{workspace?.name}</span>
          <span className="text-ink-subtle">›</span>
          <span className="font-medium">Trash</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[760px] mx-auto px-8 py-7">
          <div className="flex items-center gap-2.5 mb-1">
            <Trash2 className="w-5 h-5 text-ink-muted" strokeWidth={1.5} />
            <h1 className="text-[24px] leading-tight font-semibold tracking-tight">
              Trash
            </h1>
          </div>
          <p className="text-[13px] text-ink-2 leading-relaxed mb-6">
            Workspaces and projects you've deleted live here. Restore brings
            them back exactly as they were. <strong className="text-ink">Delete forever</strong>{' '}
            is permanent — items, comments, and attachments go with them.
          </p>

          {errorMsg && (
            <div className="mb-4 text-[12.5px] text-[#fca5a5] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.18)] rounded px-3 py-2">
              {errorMsg}
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-ink-muted text-[13px]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
              Loading…
            </div>
          ) : empty ? (
            <div className="border border-dashed border-line rounded-md py-10 text-center text-ink-muted text-[13px]">
              Trash is empty.
            </div>
          ) : (
            <>
              {trashedWorkspaces.length > 0 && (
                <section className="mb-7">
                  <h2 className="text-[10px] uppercase tracking-[0.16em] font-semibold text-ink-subtle mb-2">
                    Workspaces · {trashedWorkspaces.length}
                  </h2>
                  <ul className="space-y-1.5">
                    {trashedWorkspaces.map((w) => (
                      <TrashRow
                        key={w.id}
                        icon={
                          <span
                            className="inline-flex items-center justify-center text-[10px] font-semibold text-white shrink-0"
                            style={{ width: 22, height: 22, borderRadius: 5, background: '#4b5a73' }}
                          >
                            {w.initials}
                          </span>
                        }
                        title={w.name}
                        subtitle={w.deletedAt ? `Trashed ${formatRelative(w.deletedAt)}` : ''}
                        busy={busyIds.has(w.id)}
                        onRestore={() => handleRestoreWorkspace(w)}
                        onPurge={() => handlePurgeWorkspace(w)}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {trashedProjects.length > 0 && (
                <section>
                  <h2 className="text-[10px] uppercase tracking-[0.16em] font-semibold text-ink-subtle mb-2">
                    Projects · {trashedProjects.length}
                  </h2>
                  <ul className="space-y-1.5">
                    {trashedProjects.map((p) => {
                      const Icon = getProjectIcon(p.icon);
                      return (
                        <TrashRow
                          key={p.id}
                          icon={
                            <span
                              className="inline-flex items-center justify-center shrink-0"
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 5,
                                background: `${p.color}1f`,
                                border: `1px solid ${p.color}3a`,
                              }}
                            >
                              <Icon
                                className="w-3.5 h-3.5"
                                style={{ color: p.color }}
                                strokeWidth={1.75}
                              />
                            </span>
                          }
                          title={p.name}
                          subtitle={p.deletedAt ? `Trashed ${formatRelative(p.deletedAt)}` : ''}
                          busy={busyIds.has(p.id)}
                          onRestore={() => handleRestoreProject(p)}
                          onPurge={() => handlePurgeProject(p)}
                        />
                      );
                    })}
                  </ul>
                </section>
              )}
            </>
          )}

          <div className="h-10" />
        </div>
      </div>
    </>
  );
}

interface TrashRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  busy: boolean;
  onRestore: () => void;
  onPurge: () => void;
}

function TrashRow({ icon, title, subtitle, busy, onRestore, onPurge }: TrashRowProps) {
  return (
    <li
      className="flex items-center gap-3 px-3 py-2 rounded-md border border-line bg-panel"
      style={{ borderRadius: 6 }}
    >
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate">{title}</div>
        <div className="text-[11px] text-ink-subtle">{subtitle}</div>
      </div>
      <button
        type="button"
        onClick={onRestore}
        disabled={busy}
        className="text-[12px] px-2.5 py-1 rounded border border-line text-ink-2 hover:bg-white/[0.04] hover:border-line-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? 'Restoring…' : 'Restore'}
      </button>
      <button
        type="button"
        onClick={onPurge}
        disabled={busy}
        className="text-[12px] flex items-center gap-1.5 px-2.5 py-1 rounded text-ink-muted hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.06)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Trash2 className="w-3 h-3" strokeWidth={1.75} />
        Delete forever
      </button>
    </li>
  );
}
