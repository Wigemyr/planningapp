import { useStore } from '@/store/useStore';
import { useUi } from '@/store/useUi';
import { Board } from '@/components/Board';
import { BoardFilters } from '@/components/BoardFilters';
import { Plus } from '@/components/icons';

export default function BoardRoute() {
  const projects = useStore((s) => s.projects);
  const workspaces = useStore((s) => s.workspaces);
  const currentWorkspaceId = useStore((s) => s.currentWorkspaceId);
  const currentProjectId = useStore((s) => s.currentProjectId);
  const items = useStore((s) => s.items);
  const openNewItem = useUi((s) => s.openNewItem);

  const workspace = workspaces.find((w) => w.id === currentWorkspaceId);
  const project = projects.find((p) => p.id === currentProjectId);
  const viewItems = currentProjectId
    ? items.filter((i) => i.projectId === currentProjectId)
    : items;
  const activeCount = viewItems.filter((i) => i.status !== 'resolved').length;
  const openBugs = items.filter(
    (i) => i.type === 'bug' && i.status !== 'resolved',
  ).length;

  return (
    <>
      <header className="h-12 border-b border-line flex items-center px-5 gap-3 shrink-0">
        <div className="flex items-center gap-2 text-[13px] min-w-0">
          <span className="text-ink-muted truncate">{workspace?.name}</span>
          <span className="text-ink-subtle">›</span>
          <span className="font-medium truncate">
            {project ? project.name : 'All projects'}
          </span>
        </div>
        <span
          className="pill"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--ink-2)' }}
        >
          {activeCount} active
        </span>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => openNewItem()}
          className="surface-button"
          style={{ width: 'auto', paddingRight: 10 }}
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          <span>New item</span>
          <span className="kbd ml-1">C</span>
        </button>
      </header>

      <BoardFilters />

      <div className="h-7 px-5 flex items-center text-[11.5px] text-ink-muted shrink-0">
        <span>{viewItems.length} items</span>
        <span className="px-1.5 text-ink-subtle">·</span>
        <span>{openBugs} open bugs</span>
      </div>

      <Board />
    </>
  );
}
