import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store/useStore';
import { useUi } from '@/store/useUi';
import { useNavigate } from 'react-router-dom';
import { ITEM_TYPES, STATUSES, type ItemType, type Status } from '@/lib/types';
import { STATUS_CONFIG, TYPE_CONFIG } from '@/lib/constants';
import { Select } from './Select';
import { Bug, X, Paperclip } from './icons';
import { formatBytes } from '@/lib/format';

interface PastedBlob {
  id: string;
  blob: Blob;
  filename: string;
  previewUrl: string;
}

export function NewItemDialog() {
  const open = useUi((s) => s.newItemOpen);
  const defaults = useUi((s) => s.newItemDefaults);
  const close = useUi((s) => s.closeNewItem);
  const projects = useStore((s) => s.projects);
  const currentProjectId = useStore((s) => s.currentProjectId);
  const createItem = useStore((s) => s.createItem);
  const addAttachmentsFromBlobs = useStore((s) => s.addAttachmentsFromBlobs);
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [type, setType] = useState<ItemType>('task');
  const [status, setStatus] = useState<Status>('backlog');
  const [pastedBlobs, setPastedBlobs] = useState<PastedBlob[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setProjectId(currentProjectId || projects[0]?.id || '');
      setType('task');
      setStatus((defaults?.status as Status) ?? 'backlog');
      setPastedBlobs([]);
      setSubmitting(false);
      setTimeout(() => titleRef.current?.focus(), 10);
    }
  }, [open, currentProjectId, projects, defaults]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        close();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    async function onPaste(e: ClipboardEvent) {
      const data = e.clipboardData;
      if (!data) return;
      const blobs: PastedBlob[] = [];
      for (const it of Array.from(data.items)) {
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const file = it.getAsFile();
          if (file) {
            const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
            const previewUrl = URL.createObjectURL(file);
            blobs.push({
              id: crypto.randomUUID(),
              blob: file,
              filename: file.name || `pasted-${Date.now()}.${ext}`,
              previewUrl,
            });
          }
        }
      }
      if (blobs.length === 0) return;
      e.preventDefault();
      setPastedBlobs((prev) => [...prev, ...blobs]);
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [open]);

  useEffect(() => {
    return () => {
      pastedBlobs.forEach((b) => URL.revokeObjectURL(b.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  async function submit(navigateToItem = false) {
    if (!title.trim() || !projectId || submitting) return;
    setSubmitting(true);
    try {
      const item = await createItem({
        title,
        description,
        projectId,
        type,
        status,
      });
      if (pastedBlobs.length > 0) {
        await addAttachmentsFromBlobs(
          item.id,
          pastedBlobs.map((b) => ({ blob: b.blob, filename: b.filename })),
        );
      }
      pastedBlobs.forEach((b) => URL.revokeObjectURL(b.previewUrl));
      close();
      if (navigateToItem) navigate(`/items/${item.id}`);
    } catch (err) {
      console.error('[planning] createItem failed', err);
      setSubmitting(false);
    }
  }

  function removeBlob(id: string) {
    setPastedBlobs((prev) => {
      const toRemove = prev.find((b) => b.id === id);
      if (toRemove) URL.revokeObjectURL(toRemove.previewUrl);
      return prev.filter((b) => b.id !== id);
    });
  }

  const statusOptions = STATUSES.map((s) => ({
    value: s,
    label: STATUS_CONFIG[s].label,
    dot: STATUS_CONFIG[s].dot,
  }));
  const projectOptions = projects.map((p) => ({
    value: p.id,
    label: p.name,
    dot: p.color,
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[12vh] px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-item-title"
        className="w-full max-w-[680px] overflow-hidden shadow-2xl shadow-black/50"
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--line-2)',
          borderRadius: 6,
        }}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <h2 id="new-item-title" className="text-[13px] font-semibold tracking-tight">
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

        <div className="p-5 space-y-3">
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
            placeholder="Add a description (optional)… Ctrl+V to attach images"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-transparent text-[13.5px] leading-relaxed text-ink-2 placeholder:text-ink-subtle resize-none focus:outline-none"
          />

          {pastedBlobs.length > 0 && (
            <div className="pt-1">
              <div className="flex items-center gap-1.5 mb-2 text-[11px] text-ink-muted">
                <Paperclip className="w-3 h-3" strokeWidth={1.75} />
                <span>{pastedBlobs.length} attachment{pastedBlobs.length === 1 ? '' : 's'} ready</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {pastedBlobs.map((b) => (
                  <div
                    key={b.id}
                    className="relative group rounded-md border border-line overflow-hidden bg-panel-2"
                    style={{ aspectRatio: '16 / 10' }}
                  >
                    <img
                      src={b.previewUrl}
                      alt={b.filename}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute left-1.5 bottom-1.5 text-[10px] px-1.5 py-0.5 rounded bg-black/55 text-ink-2 truncate max-w-[calc(100%-12px)]">
                      {formatBytes(b.blob.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeBlob(b.id)}
                      className="absolute top-1 right-1 w-5 h-5 rounded bg-black/55 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      aria-label="Remove attachment"
                    >
                      <X className="w-3 h-3" strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5 pt-2 flex-wrap">
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

            <Select
              value={status}
              onChange={(v) => setStatus(v as Status)}
              options={statusOptions}
              ariaLabel="Status"
            />
            <Select
              value={projectId}
              onChange={setProjectId}
              options={projectOptions}
              ariaLabel="Project"
              className="max-w-[200px]"
              placeholder="Project"
            />
          </div>
        </div>

        <div
          className="flex items-center justify-between px-5 py-3.5 border-t border-line"
          style={{ background: 'rgba(0,0,0,0.18)' }}
        >
          <span className="text-[11.5px] text-ink-subtle">
            <span className="kbd">⌘</span> <span className="kbd">↵</span> to create
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={close}
              className="text-[12.5px] px-3 py-1.5 rounded-md text-ink-2 hover:bg-white/[0.05] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit(false)}
              disabled={!title.trim() || !projectId || submitting}
              className="text-[12.5px] font-medium px-3.5 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'var(--surface-4)',
                border: '1px solid var(--line-2)',
                color: 'var(--ink-1)',
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.borderColor = 'var(--line-3)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--surface-4)';
                e.currentTarget.style.borderColor = 'var(--line-2)';
              }}
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
