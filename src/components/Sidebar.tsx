import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { useUi } from '@/store/useUi';
import { Avatar } from './Avatar';
import {
  Search,
  Plus,
  Inbox,
  User,
  ChevronDown,
  Settings,
  LogOut,
} from './icons';

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
  const navigate = useNavigate();

  const isOwner =
    members.find((m) => m.user.id === currentUserId)?.role === 'owner';

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

  const workspace = workspaces.find((w) => w.id === currentWorkspaceId);

  const projectCounts = new Map<string, number>();
  for (const it of items) {
    if (it.status === 'resolved' || it.status === 'discarded') continue;
    projectCounts.set(it.projectId, (projectCounts.get(it.projectId) ?? 0) + 1);
  }

  return (
    <aside className="w-[244px] shrink-0 border-r border-line flex flex-col bg-[#08090b]">
      <button
        type="button"
        className="m-2 px-2 py-1.5 rounded-md flex items-center gap-2 hover:bg-white/[0.04] text-left"
      >
        <div
          className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-semibold text-white"
          style={{ background: '#6d28d9' }}
          aria-hidden
        >
          {workspace?.initials ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-medium truncate">{workspace?.name}</div>
        </div>
        <ChevronDown className="w-3 h-3 text-ink-subtle" />
      </button>

      <div className="px-2 space-y-0.5 mb-3">
        <button type="button" className="sidebar-link w-full">
          <Search className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span className="flex-1 text-left">Search</span>
          <span className="kbd">⌘K</span>
        </button>
        <button
          type="button"
          className="sidebar-link w-full"
          onClick={() => openNewItem()}
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span className="flex-1 text-left">New item</span>
          <span className="kbd">C</span>
        </button>
        <button type="button" className="sidebar-link w-full">
          <User className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span className="flex-1 text-left">My items</span>
        </button>
        <button type="button" className="sidebar-link w-full">
          <Inbox className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span className="flex-1 text-left">Inbox</span>
        </button>
      </div>

      <div className="px-4 mb-1.5 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-ink-subtle">
          Projects
        </span>
        <button type="button" className="text-ink-subtle hover:text-ink-2" aria-label="New project">
          <Plus className="w-3 h-3" strokeWidth={2} />
        </button>
      </div>
      <div className="px-2 space-y-0.5 flex-1 overflow-auto">
        <button
          type="button"
          onClick={() => setCurrentProject(null)}
          className={`sidebar-link w-full ${currentProjectId === null ? 'active' : ''}`}
        >
          <span className="dot" style={{ background: '#a0a3ad' }} />
          <span className="flex-1 truncate text-left">All projects</span>
          <span className="meta-text">{items.filter(i => i.status !== 'resolved' && i.status !== 'discarded').length}</span>
        </button>
        {projects.map((p) => (
          <button
            type="button"
            key={p.id}
            onClick={() => setCurrentProject(p.id)}
            className={`sidebar-link w-full ${currentProjectId === p.id ? 'active' : ''}`}
          >
            <span className="dot" style={{ background: p.color }} />
            <span className="flex-1 truncate text-left">{p.name}</span>
            <span className="meta-text">{projectCounts.get(p.id) ?? 0}</span>
          </button>
        ))}
      </div>

      <div ref={menuRef} className="relative border-t border-line p-2 flex items-center gap-2">
        <Avatar user={currentUser} />
        <div className="text-[12px] flex-1 min-w-0">
          <div className="truncate">{currentUser?.name}</div>
          <div className="truncate text-[10px] text-ink-subtle">{currentUser?.email}</div>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="text-ink-subtle hover:text-ink-2 p-1 rounded transition-colors"
          aria-label="Account menu"
          aria-expanded={menuOpen}
        >
          <Settings className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute bottom-full right-2 mb-2 w-[200px] bg-panel border border-line rounded-md shadow-2xl shadow-black/40 py-1 z-20"
            style={{ borderRadius: 8 }}
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
                  setMenuOpen(false);
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
                setMenuOpen(false);
                void signOut();
              }}
              className="w-full px-3 py-1.5 text-left text-[12.5px] text-ink-2 hover:bg-white/[0.04] hover:text-[#fca5a5] flex items-center gap-2 transition-colors"
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
