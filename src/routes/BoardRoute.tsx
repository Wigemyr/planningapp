import { useStore } from '@/store/useStore';
import { useUi } from '@/store/useUi';
import { Board } from '@/components/Board';
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
  const activeCount = viewItems.filter(
    (i) => i.status !== 'resolved' && i.status !== 'discarded',
  ).length;

  return (
    <>
      <header className="h-12 border-b border-line flex items-center px-4 gap-3 shrink-0">
        <div className="flex items-center gap-2 text-[12.5px] min-w-0">
          <span className="text-ink-muted truncate">{workspace?.name}</span>
          <span className="text-ink-subtle">›</span>
          <span className="font-medium truncate">
            {project ? project.name : 'All projects'}
          </span>
        </div>
        <span
          className="text-[10.5px] px-1.5 py-0.5 rounded shrink-0"
          style={{ background: 'rgba(113,112,255,0.12)', color: '#9b9aff' }}
        >
          {activeCount} active
        </span>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => openNewItem()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12.5px] font-medium text-white bg-accent hover:bg-accent-2 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />
          New item
          <span
            className="kbd"
            style={{
              background: 'rgba(0,0,0,0.28)',
              borderColor: 'rgba(255,255,255,0.18)',
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            C
          </span>
        </button>
      </header>

      <div className="h-9 border-b border-line flex items-center px-4 gap-2 shrink-0 text-[12px] text-ink-muted">
        <span>{viewItems.length} items</span>
        <span className="text-ink-subtle">·</span>
        <span>{items.filter((i) => i.type === 'bug' && i.status !== 'resolved' && i.status !== 'discarded').length} open bugs</span>
        <div className="flex-1" />
        <span className="text-[11px] text-ink-subtle">
          Drag to reorder · Bugs auto-pin to top on creation
        </span>
      </div>

      <Board />
    </>
  );
}
