import { useStore } from '@/store/useStore';
import { useUi } from '@/store/useUi';
import { Board } from '@/components/Board';
import {
  Plus,
  Search,
  Columns,
  Rows3,
  Filter,
  ArrowDownUp,
  ListFilter,
} from '@/components/icons';

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
        <div className="flex items-center gap-2 text-[12.5px]">
          <span className="text-ink-muted">{workspace?.name}</span>
          <span className="text-ink-subtle">›</span>
          <span className="font-medium">
            {project ? project.name : 'All projects'}
          </span>
        </div>
        <span
          className="text-[10.5px] px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(113,112,255,0.10)', color: '#7170ff' }}
        >
          {activeCount} active
        </span>

        <div className="flex-1 flex justify-center">
          <button
            type="button"
            className="flex items-center gap-2 text-[12.5px] px-3 py-1.5 rounded-md border border-line w-80 max-w-full text-ink-muted bg-[#0a0c0f] hover:border-line-2 transition-colors"
          >
            <Search className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span className="flex-1 text-left">Search items, projects…</span>
            <span className="kbd">⌘K</span>
          </button>
        </div>

        <div className="flex items-center rounded-md border border-line p-0.5">
          <button
            type="button"
            className="px-2.5 py-1 rounded text-[12px] font-medium flex items-center gap-1.5 text-ink bg-line-2"
          >
            <Columns className="w-3.5 h-3.5" strokeWidth={1.75} />
            Board
          </button>
          <button
            type="button"
            className="px-2.5 py-1 rounded text-[12px] flex items-center gap-1.5 text-ink-muted hover:text-ink-2 transition-colors"
            title="List view — coming soon"
            disabled
          >
            <Rows3 className="w-3.5 h-3.5" strokeWidth={1.75} />
            List
          </button>
        </div>

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
        <button
          type="button"
          className="px-2 py-1 rounded hover:bg-white/[0.04] flex items-center gap-1.5"
        >
          <Filter className="w-3.5 h-3.5" strokeWidth={1.75} /> Filter
        </button>
        <button
          type="button"
          className="px-2 py-1 rounded hover:bg-white/[0.04] flex items-center gap-1.5"
        >
          <ArrowDownUp className="w-3.5 h-3.5" strokeWidth={1.75} /> Sort
        </button>
        <button
          type="button"
          className="px-2 py-1 rounded hover:bg-white/[0.04] flex items-center gap-1.5"
        >
          <ListFilter className="w-3.5 h-3.5" strokeWidth={1.75} /> Group: Status
        </button>
        <div className="w-px h-4 bg-line" />
        <span>{viewItems.length} items</span>
        <div className="flex-1" />
        <span className="text-[11px] text-ink-subtle">
          Drag to reorder · Bugs auto-pin to top
        </span>
      </div>

      <Board />
    </>
  );
}
