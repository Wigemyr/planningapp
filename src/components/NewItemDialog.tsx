import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store/useStore';
import { useUi } from '@/store/useUi';
import { useNavigate } from 'react-router-dom';
import { ITEM_TYPES, type ItemType, type Status } from '@/lib/types';
import { TYPE_CONFIG } from '@/lib/constants';
import { Bug, X } from './icons';

export function NewItemDialog() {
  const open = useUi((s) => s.newItemOpen);
  const defaults = useUi((s) => s.newItemDefaults);
  const close = useUi((s) => s.closeNewItem);
  const projects = useStore((s) => s.projects);
  const currentProjectId = useStore((s) => s.currentProjectId);
  const createItem = useStore((s) => s.createItem);
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [type, setType] = useState<ItemType>('task');
  const [status, setStatus] = useState<Status>('backlog');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setProjectId(currentProjectId || projects[0]?.id || '');
      setType('task');
      setStatus((defaults?.status as Status) ?? 'backlog');
      // Focus title on next tick
      setTimeout(() => titleRef.current?.focus(), 10);
    }
  }, [open, currentProjectId, projects, defaults]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  async function submit(navigateToItem = false) {
    if (!title.trim() || !projectId) return;
    try {
      const item = await createItem({
        title,
        description,
        projectId,
        type,
        status,
      });
      close();
      if (navigateToItem) navigate(`/items/${item.id}`);
    } catch (err) {
      console.error('[planning] createItem failed', err);
      // Leave the dialog open so the user can try again.
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 backdrop-blur-sm pt-[12vh] px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-item-title"
        className="w-full max-w-[560px] bg-panel border border-line rounded-lg shadow-2xl shadow-black/40"
        style={{ borderRadius: 10 }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h2 id="new-item-title" className="text-[13px] font-semibold">
            New item
          </h2>
          <button
            type="button"
            onClick={close}
            className="p-1 rounded text-ink-muted hover:text-ink hover:bg-white/[0.05]"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <input
            ref={titleRef}
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void submit(false);
              }
            }}
            className="w-full bg-transparent text-[16px] font-medium leading-snug placeholder:text-ink-subtle focus:outline-none"
          />
          <textarea
            placeholder="Add a description (optional)…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-transparent text-[13.5px] leading-relaxed text-ink-2 placeholder:text-ink-subtle resize-none focus:outline-none"
          />

          <div className="flex items-center gap-1.5 pt-2 flex-wrap">
            {/* Type picker */}
            <div className="flex items-center rounded-md border border-line p-0.5">
              {ITEM_TYPES.map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-2 py-1 text-[11.5px] rounded inline-flex items-center gap-1 transition-colors ${
                    type === t ? 'bg-line-2 text-ink' : 'text-ink-muted hover:text-ink-2'
                  }`}
                  aria-pressed={type === t}
                >
                  {t === 'bug' && <Bug className="w-3 h-3" strokeWidth={2.25} style={{ color: TYPE_CONFIG.bug.color }} />}
                  <span className="capitalize">{t}</span>
                </button>
              ))}
            </div>

            {/* Status picker */}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className="text-[11.5px] bg-panel-2 border border-line rounded px-2 py-1 text-ink-2"
              aria-label="Status"
            >
              <option value="backlog">Backlog</option>
              <option value="active">Active</option>
              <option value="waiting">Waiting</option>
              <option value="blocked">Blocked</option>
              <option value="resolved">Resolved</option>
              <option value="discarded">Discarded</option>
            </select>

            {/* Project picker */}
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="text-[11.5px] bg-panel-2 border border-line rounded px-2 py-1 text-ink-2 max-w-[180px]"
              aria-label="Project"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-line bg-[#0b0d11]" style={{ borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
          <span className="text-[11px] text-ink-subtle">
            <span className="kbd">⌘</span> <span className="kbd">↵</span> to create
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={close}
              className="text-[12px] px-3 py-1.5 rounded text-ink-2 hover:bg-white/[0.04]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit(false)}
              disabled={!title.trim() || !projectId}
              className="text-[12px] font-medium px-3 py-1.5 rounded text-white bg-accent hover:bg-accent-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
