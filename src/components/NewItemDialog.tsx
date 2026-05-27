import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/store/useStore';
import { useUi } from '@/store/useUi';
import { useNavigate } from 'react-router-dom';
import { ITEM_TYPES, STATUSES, type ItemType, type Priority, type Status } from '@/lib/types';
import { STATUS_CONFIG, TYPE_CONFIG, PRIORITY_COLOR, PRIORITY_LABEL } from '@/lib/constants';
import { Select } from './Select';
import { X, Paperclip, Check } from './icons';
import { formatBytes } from '@/lib/format';

interface PastedBlob {
  id: string;
  blob: Blob;
  filename: string;
  previewUrl: string;
}

/** Shape of a draft persisted to localStorage. Pasted attachments are NOT
 * included — Blob serialisation would balloon the storage quota and we can't
 * round-trip them reliably. */
interface PersistedDraft {
  title: string;
  description: string;
  projectId: string;
  type: ItemType;
  status: Status;
  priority: Priority;
  savedAt: string;
}

const DRAFT_KEY = 'planning.newItemDraft';

function loadDraft(): PersistedDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedDraft;
    if (!parsed || typeof parsed.title !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDraft(d: PersistedDraft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch (err) {
    console.error('[planning] failed to save draft', err);
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
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
  const [priority, setPriority] = useState<Priority>(null);
  const [pastedBlobs, setPastedBlobs] = useState<PastedBlob[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  const [closePromptOpen, setClosePromptOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  /** CRITICAL: only reset state on the false→true open transition. Earlier this
   * effect listed `projects` and `currentProjectId` as deps, which meant any
   * realtime store update mid-edit would wipe whatever the user had typed. We
   * now gate on a prevOpen ref so reset fires exactly when the dialog opens. */
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const draft = loadDraft();
      if (draft) {
        setTitle(draft.title);
        setDescription(draft.description);
        setProjectId(draft.projectId || currentProjectId || projects[0]?.id || '');
        setType(draft.type);
        setStatus((defaults?.status as Status) ?? draft.status);
        setPriority(draft.priority ?? null);
        setRestoredFromDraft(true);
      } else {
        setTitle('');
        setDescription('');
        setProjectId(currentProjectId || projects[0]?.id || '');
        setType('task');
        setStatus((defaults?.status as Status) ?? 'backlog');
        setPriority(null);
        setRestoredFromDraft(false);
      }
      setPastedBlobs([]);
      setSubmitting(false);
      setClosePromptOpen(false);
      setTimeout(() => titleRef.current?.focus(), 10);
    }
    prevOpenRef.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Track whether the user has typed anything since opening — used to decide
  // whether Esc / X / backdrop click should prompt or close immediately.
  const dirty = useMemo(() => {
    return (
      title.trim().length > 0 ||
      description.trim().length > 0 ||
      pastedBlobs.length > 0
    );
  }, [title, description, pastedBlobs]);

  // Esc → request close (which may show the prompt instead of closing)
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (closePromptOpen) {
          e.preventDefault();
          setClosePromptOpen(false);
          return;
        }
        e.preventDefault();
        requestClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, closePromptOpen, dirty]);

  // Image paste: stage blobs locally; upload after item creation succeeds.
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

  // Clean up preview URLs when blobs are removed or dialog closes
  useEffect(() => {
    return () => {
      pastedBlobs.forEach((b) => URL.revokeObjectURL(b.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function requestClose() {
    if (dirty) {
      setClosePromptOpen(true);
    } else {
      close();
    }
  }

  function handleSaveAsDraft() {
    saveDraft({
      title,
      description,
      projectId,
      type,
      status,
      priority,
      savedAt: new Date().toISOString(),
    });
    setClosePromptOpen(false);
    close();
  }

  function handleDiscardAndClose() {
    clearDraft();
    setClosePromptOpen(false);
    close();
  }

  function handleDiscardDraftHint() {
    clearDraft();
    setTitle('');
    setDescription('');
    setProjectId(currentProjectId || projects[0]?.id || '');
    setType('task');
    setStatus((defaults?.status as Status) ?? 'backlog');
    setPriority(null);
    setRestoredFromDraft(false);
    setTimeout(() => titleRef.current?.focus(), 10);
  }

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
        priority,
      });
      if (pastedBlobs.length > 0) {
        await addAttachmentsFromBlobs(
          item.id,
          pastedBlobs.map((b) => ({ blob: b.blob, filename: b.filename })),
        );
      }
      pastedBlobs.forEach((b) => URL.revokeObjectURL(b.previewUrl));
      clearDraft();
      setClosePromptOpen(false);
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
  /** Priority is optional — '' means "no priority". The Select component takes
   * string values, so we round-trip null <-> '' when reading/writing. */
  const priorityOptions = [
    { value: '', label: 'No priority', dot: 'var(--ink-4)' },
    { value: 'p0', label: PRIORITY_LABEL.p0 + ' — critical', dot: PRIORITY_COLOR.p0.color, color: PRIORITY_COLOR.p0.color },
    { value: 'p1', label: PRIORITY_LABEL.p1 + ' — high',     dot: PRIORITY_COLOR.p1.color, color: PRIORITY_COLOR.p1.color },
    { value: 'p2', label: PRIORITY_LABEL.p2 + ' — medium',   dot: PRIORITY_COLOR.p2.color, color: PRIORITY_COLOR.p2.color },
    { value: 'p3', label: PRIORITY_LABEL.p3 + ' — low',      dot: PRIORITY_COLOR.p3.color, color: PRIORITY_COLOR.p3.color },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[12vh] px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-item-title"
        className="w-full max-w-[680px] overflow-hidden shadow-2xl shadow-black/50 relative"
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
            onClick={requestClose}
            className="p-1 rounded text-ink-muted hover:text-ink hover:bg-white/[0.05]"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {restoredFromDraft && (
          <div
            className="flex items-center justify-between px-5 py-2 text-[11.5px]"
            style={{
              background: 'rgba(255,255,255,0.025)',
              borderBottom: '1px solid var(--line-1)',
              color: 'var(--ink-2)',
            }}
          >
            <span>Restored from your last unsaved draft.</span>
            <button
              type="button"
              onClick={handleDiscardDraftHint}
              className="text-ink-muted hover:text-[#d68a86] underline decoration-dotted underline-offset-2"
            >
              Discard draft
            </button>
          </div>
        )}

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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void submit(false);
              }
            }}
            rows={3}
            className="w-full bg-transparent text-[13.5px] leading-relaxed text-ink-2 placeholder:text-ink-subtle resize-none focus:outline-none"
          />

          {/* Pasted/staged attachments */}
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
            {/* Type segmented picker — each type carries a coloured dot so the
             * options are scannable without reading every label. */}
            <div className="flex items-center rounded-md border border-line p-0.5">
              {ITEM_TYPES.map((t) => {
                const cfg = TYPE_CONFIG[t];
                const active = type === t;
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setType(t)}
                    className={`px-2 py-1 text-[11.5px] rounded inline-flex items-center gap-1.5 transition-colors ${
                      active ? 'bg-line-2 text-ink' : 'text-ink-muted hover:text-ink-2'
                    }`}
                    aria-pressed={active}
                  >
                    <span
                      className="dot"
                      style={{ background: cfg.color, width: 6, height: 6 }}
                    />
                    <span className="capitalize">{t}</span>
                  </button>
                );
              })}
            </div>

            <Select
              value={status}
              onChange={(v) => setStatus(v as Status)}
              options={statusOptions}
              ariaLabel="Status"
            />
            <Select
              value={priority ?? ''}
              onChange={(v) => setPriority((v || null) as Priority)}
              options={priorityOptions}
              ariaLabel="Priority"
              placeholder="Priority"
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
          className="flex items-center justify-between px-5 py-3.5 border-t border-line gap-2 flex-wrap"
          style={{ background: 'rgba(0,0,0,0.18)' }}
        >
          <span className="text-[11.5px] text-ink-subtle">
            <span className="kbd">⌘</span> <span className="kbd">↵</span> to create · Esc to close
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={requestClose}
              className="text-[12.5px] px-3 py-1.5 rounded-md text-ink-2 hover:bg-white/[0.05] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAsDraft}
              disabled={!dirty}
              title="Save your typing and reopen the dialog later with it restored"
              className="text-[12.5px] px-3 py-1.5 rounded-md text-ink-2 hover:bg-white/[0.05] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save as draft
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

        {/* Esc-on-dirty prompt — overlays the dialog body so the user can pick
         * an explicit action instead of losing typing to a stray keypress. */}
        {closePromptOpen && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center px-4"
            style={{
              background: 'rgba(8,8,12,0.72)',
              backdropFilter: 'blur(6px)',
            }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setClosePromptOpen(false);
            }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="close-prompt-title"
          >
            <div
              className="w-full max-w-[420px] shadow-2xl shadow-black/50"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--line-2)',
                borderRadius: 8,
              }}
            >
              <div className="p-5">
                <h3 id="close-prompt-title" className="text-[14px] font-semibold mb-1.5">
                  Keep this new item?
                </h3>
                <p className="text-[12.5px] text-ink-2 leading-relaxed">
                  You've started a new item but haven't created it yet. Save it as a draft
                  to come back to later, create it now, or discard your typing.
                </p>
              </div>
              <div
                className="flex items-center justify-end gap-2 px-5 py-3 flex-wrap"
                style={{
                  borderTop: '1px solid var(--line-1)',
                  background: 'rgba(0,0,0,0.18)',
                  borderBottomLeftRadius: 8,
                  borderBottomRightRadius: 8,
                }}
              >
                <button
                  type="button"
                  onClick={handleDiscardAndClose}
                  className="text-[12px] px-3 py-1.5 rounded-md text-ink-muted hover:text-[#d68a86] hover:bg-[rgba(198,110,107,0.10)] transition-colors"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSaveAsDraft}
                  className="text-[12px] px-3 py-1.5 rounded-md text-ink-2 hover:bg-white/[0.05] transition-colors"
                >
                  Save as draft
                </button>
                <button
                  type="button"
                  onClick={() => void submit(false)}
                  disabled={!title.trim() || !projectId || submitting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <Check className="w-3.5 h-3.5" strokeWidth={2.25} />
                  {submitting ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
