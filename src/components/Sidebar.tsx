import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useStore } from '@/store/useStore';
import { useUi } from '@/store/useUi';
import { Avatar } from './Avatar';
import {
  Plus,
  User,
  ChevronDown,
  Settings,
  LogOut,
  Folder,
  Layers,
  GripVertical,
  MoreHorizontal,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
} from './icons';
import type { Project } from '@/lib/types';

export function Sidebar() {
  const projects = useStore((s) => s.projects);
  const workspaces = useStore((s) => s.workspaces);
  const currentWorkspaceId = useStore((s) => s.currentWorkspaceId);
  const currentProjectId = useStore((s) => s.currentProjectId);
  const setCurrentProject = useStore((s) => s.setCurrentProject);
  const items = useStore((s) => s.items);
  const currentUser = useStore((s) => s.currentUser());
  const signOut = useStore((s) => s.signOut);
  const members = useStore((s) => s.members);
  const currentUserId = useStore((s) => s.currentUserId);
  const openNewItem = useUi((s) => s.openNewItem);
  const openNewProject = useUi((s) => s.openNewProject);
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggleSidebar = useUi((s) => s.toggleSidebar);
  const reorderProjects = useStore((s) => s.reorderProjects);
  const deleteProject = useStore((s) => s.deleteProject);
  const navigate = useNavigate();

  const isOwner =
    members.find((m) => m.user.id === currentUserId)?.role === 'owner';

  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountOpen) return;
    function onClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [accountOpen]);

  const workspace = workspaces.find((w) => w.id === currentWorkspaceId);

  const projectCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      if (it.status === 'resolved') continue;
      map.set(it.projectId, (map.get(it.projectId) ?? 0) + 1);
    }
    return map;
  }, [items]);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.position - b.position),
    [projects],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedProjects.findIndex((p) => p.id === active.id);
    const newIndex = sortedProjects.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(sortedProjects, oldIndex, newIndex);
    void reorderProjects(next.map((p) => p.id));
  }

  const width = collapsed ? 56 : 244;

  return (
    <aside
      className="shrink-0 border-r border-line flex flex-col"
      style={{
        width,
        background: 'var(--bg)',
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div className="p-2 space-y-1.5">
        <button
          type="button"
          className="surface-button"
          title={workspace?.name ?? ''}
          aria-haspopup="listbox"
        >
          {collapsed ? (
            <Layers className="w-4 h-4 mx-auto" strokeWidth={1.75} />
          ) : (
            <>
              <span className="flex-1 text-left truncate">{workspace?.name}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" strokeWidth={1.75} />
            </>
          )}
        </button>

        <button
          type="button"
          className="surface-button"
          onClick={() => openNewItem()}
          title="New item"
        >
          <Plus className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          {!collapsed && (
            <>
              <span className="text-left">New item</span>
              <span className="kbd ml-auto">C</span>
            </>
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="px-4 mt-1.5 mb-1.5 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-ink-subtle">
            Projects
          </span>
          <button
            type="button"
            onClick={openNewProject}
            className="text-ink-subtle hover:text-ink-2 p-0.5 rounded transition-colors"
            aria-label="New project"
          >
            <Plus className="w-3 h-3" strokeWidth={2} />
          </button>
        </div>
      )}

      <div className="px-2 flex-1 overflow-y-auto space-y-0.5">
        <button
          type="button"
          onClick={() => setCurrentProject(null)}
          className={`sidebar-link w-full ${currentProjectId === null ? 'active' : ''}`}
          style={collapsed ? { justifyContent: 'center', gap: 0, padding: '8px 0' } : undefined}
          title="All projects"
        >
          <Layers className="w-4 h-4 shrink-0" style={{ color: 'var(--ink-3)' }} strokeWidth={1.75} />
          {!collapsed && (
            <>
              <span className="flex-1 truncate text-left">All projects</span>
              <span className="meta-text">
                {items.filter((i) => i.status !== 'resolved').length}
              </span>
            </>
          )}
        </button>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedProjects.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedProjects.map((p) => (
              <SortableProjectRow
                key={p.id}
                project={p}
                active={currentProjectId === p.id}
                count={projectCounts.get(p.id) ?? 0}
                collapsed={collapsed}
                onSelect={() => setCurrentProject(p.id)}
                onDelete={() => {
                  if (window.confirm(`Delete project "${p.name}"? All its items will be deleted too.`)) {
                    void deleteProject(p.id);
                  }
                }}
              />
            ))}
          </SortableContext>
        </DndContext>

        {!collapsed && (
          <button
            type="button"
            onClick={openNewProject}
            className="sidebar-link w-full text-ink-muted hover:text-ink-2"
          >
            <Plus className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span className="flex-1 text-left">New project</span>
          </button>
        )}
      </div>

      <div className="px-2 pb-1">
        <button
          type="button"
          onClick={toggleSidebar}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11.5px] text-ink-muted hover:text-ink-2 hover:bg-white/[0.04] transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4 mx-auto" strokeWidth={1.75} />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              <span>Collapse sidebar</span>
            </>
          )}
        </button>
      </div>

      <div
        ref={accountRef}
        className="relative border-t border-line p-2 flex items-center gap-2"
        style={collapsed ? { justifyContent: 'center' } : undefined}
      >
        <Avatar user={currentUser} />
        {!collapsed && (
          <>
            <div className="text-[12px] flex-1 min-w-0">
              <div className="truncate">{currentUser?.name}</div>
              <div className="truncate text-[10px] text-ink-subtle">{currentUser?.email}</div>
            </div>
            <button
              type="button"
              onClick={() => setAccountOpen((o) => !o)}
              className="text-ink-subtle hover:text-ink-2 p-1 rounded transition-colors"
              aria-label="Account menu"
              aria-expanded={accountOpen}
            >
              <Settings className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </>
        )}

        {accountOpen && (
          <div
            role="menu"
            className="absolute bottom-full right-2 mb-2 w-[200px] border border-line-2 shadow-2xl shadow-black/40 py-1 z-20"
            style={{ background: 'rgba(28,28,32,0.96)', backdropFilter: 'blur(14px)', borderRadius: 8 }}
          >
            <div className="px-3 py-2 text-[11px] text-ink-subtle border-b border-line">
              Signed in as
              <div className="text-ink-2 text-[12px] truncate">{currentUser?.email}</div>
            </div>
            {isOwner && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAccountOpen(false);
                  navigate('/settings');
                }}
                className="w-full px-3 py-1.5 text-left text-[12.5px] text-ink-2 hover:bg-white/[0.04] hover:text-ink flex items-center gap-2 transition-colors"
              >
                <User className="w-3.5 h-3.5" strokeWidth={1.75} />
                Members & invites
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAccountOpen(false);
                void signOut();
              }}
              className="w-full px-3 py-1.5 text-left text-[12.5px] text-ink-2 hover:bg-white/[0.04] hover:text-[#d68a86] flex items-center gap-2 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

interface RowProps {
  project: Project;
  active: boolean;
  count: number;
  collapsed: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SortableProjectRow({ project, active, count, collapsed, onSelect, onDelete }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.id });

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group"
    >
      <div
        className={`sidebar-link w-full ${active ? 'active' : ''}`}
        style={collapsed ? { justifyContent: 'center', gap: 0, padding: '8px 0' } : undefined}
      >
        {!collapsed && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 -ml-1.5 -mr-0.5 cursor-grab active:cursor-grabbing text-ink-subtle"
            aria-label="Drag to reorder"
            tabIndex={-1}
          >
            <GripVertical className="w-3 h-3" strokeWidth={2} />
          </button>
        )}
        <button
          type="button"
          onClick={onSelect}
          className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
          title={project.name}
        >
          <Folder
            className="w-4 h-4 shrink-0"
            style={{
              color: project.color,
              fill: project.color,
              fillOpacity: 0.18,
            }}
            strokeWidth={1.5}
          />
          {!collapsed && (
            <span className="flex-1 truncate">{project.name}</span>
          )}
        </button>
        {!collapsed && (
          <>
            <span className="meta-text">{count}</span>
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((o) => !o);
                }}
                className="opacity-0 group-hover:opacity-100 text-ink-subtle hover:text-ink-2 p-0.5 -mr-1 rounded transition-colors"
                aria-label="Project actions"
              >
                <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute top-full right-0 mt-1 w-[160px] border border-line-2 shadow-2xl shadow-black/50 py-1 z-30"
                  style={{ background: 'rgba(28,28,32,0.96)', backdropFilter: 'blur(14px)', borderRadius: 8 }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDelete();
                    }}
                    className="w-full px-3 py-1.5 text-left text-[12.5px] text-ink-2 hover:bg-[rgba(198,110,107,0.12)] hover:text-[#d68a86] flex items-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    Delete project
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
