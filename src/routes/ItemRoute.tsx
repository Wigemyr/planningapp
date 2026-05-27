import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import type { Item, ItemType, Priority, Status } from '@/lib/types';
import { STATUSES, ITEM_TYPES } from '@/lib/types';
import {
  STATUS_CONFIG,
  STATUS_TINT,
  TYPE_CONFIG,
  PRIORITY_TINT,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
} from '@/lib/constants';
import { Avatar } from '@/components/Avatar';
import { formatAbsolute, formatRelative, formatBytes } from '@/lib/format';
import {
  ArrowLeft,
  Bug,
  Paperclip,
  Upload,
  X,
  Trash2,
  Share2,
  Link2,
  MoreHorizontal,
  Check,
  CornerDownLeft,
} from '@/components/icons';

/** Editable subset of an Item that the user composes before pressing Save. */
type ItemDraft = {
  title: string;
  description: string;
  status: Status;
  type: ItemType;
  projectId: string;
  priority: Priority;
};

function getDraft(item: Item): ItemDraft {
  return {
    title: item.title,
    description: item.description,
    status: item.status,
    type: item.type,
    projectId: item.projectId,
    priority: item.priority,
  };
}

function draftsDiffer(a: ItemDraft, b: ItemDraft) {
  return (
    a.title !== b.title ||
    a.description !== b.description ||
    a.status !== b.status ||
    a.type !== b.type ||
    a.projectId !== b.projectId ||
    a.priority !== b.priority
  );
}

export default function ItemRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  const items = useStore((s) => s.items);
  const projects = useStore((s) => s.projects);
  const users = useStore((s) => s.users);

  const updateItem = useStore((s) => s.updateItem);
  const deleteItem = useStore((s) => s.deleteItem);
  const addAttachment = useStore((s) => s.addAttachment);
  const addAttachmentsFromBlobs = useStore((s) => s.addAttachmentsFromBlobs);
  const removeAttachment = useStore((s) => s.removeAttachment);
  const refreshAttachmentUrls = useStore((s) => s.refreshAttachmentUrls);

  const item = items.find((i) => i.id === id);

  // ----- Draft state -----
  const [draft, setDraft] = useState<ItemDraft | null>(() =>
    item ? getDraft(item) : null,
  );
  const [savedFlash, setSavedFlash] = useState(false);
  const [pasteFlash, setPasteFlash] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /**
   * When set, an "Unsaved changes" overlay is shown. The `action` is what to run
   * if the user chooses Save & close or Discard. If they choose Go back, we just
   * clear this state.
   */
  const [closeRequest, setCloseRequest] = useState<{ action: () => void } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset draft whenever the item we're viewing changes id (navigation).
  const lastIdRef = useRef(item?.id);
  useEffect(() => {
    if (item && item.id !== lastIdRef.current) {
      setDraft(getDraft(item));
      lastIdRef.current = item.id;
      setErrorMsg(null);
    }
  }, [item]);

  // Refresh signed URLs for any attachments that don't have one yet (e.g. on
  // first navigation to this item, or after their previous URL expired).
  useEffect(() => {
    if (!item) return;
    const missing = item.attachments.filter((a) => !a.url);
    if (missing.length === 0) return;
    refreshAttachmentUrls(missing).catch((err) =>
      console.error('[planning] signed URL fetch failed', err),
    );
  }, [item?.id, item?.attachments.length, refreshAttachmentUrls, item]);

  const dirty = useMemo(() => {
    if (!item || !draft) return false;
    return draftsDiffer(draft, getDraft(item));
  }, [draft, item]);

  // ----- Save / discard -----
  async function save() {
    if (!item || !draft || !dirty) return;
    try {
      await updateItem(item.id, draft);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
    } catch (err) {
      setErrorMsg(
        'Could not save — ' +
          (err instanceof Error ? err.message : 'unknown error'),
      );
      console.error(err);
    }
  }
  function discard() {
    if (!item) return;
    setDraft(getDraft(item));
  }
  function setField<K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  // ⌘S / Ctrl+S → save · Esc → close (with dirty-check)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // While the close overlay is open, the overlay-specific handler below takes over.
      if (closeRequest) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty) save();
        return;
      }
      if (e.key === 'Escape') {
        // Don't intercept Esc inside a `<select>` — the browser uses it to close
        // the open dropdown. Detect by checking the focused element.
        const target = e.target as HTMLElement | null;
        if (target?.tagName?.toLowerCase() === 'select') return;
        e.preventDefault();
        requestClose(() => navigate('/'));
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, closeRequest]);

  // While the overlay is open: Esc dismisses it (= "Go back"), Enter saves & closes.
  useEffect(() => {
    if (!closeRequest) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setCloseRequest(null);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const action = closeRequest!.action;
        save()
          .then(() => {
            setCloseRequest(null);
            action();
          })
          .catch(() => {
            // keep overlay open; error banner already shown by save()
          });
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeRequest]);

  function requestClose(action: () => void) {
    if (dirty) {
      setCloseRequest({ action });
    } else {
      action();
    }
  }

  // Confirm before leaving with unsaved changes (browser back, refresh, close)
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Image paste handler — image attachments are committed instantly (not part of draft).
  useEffect(() => {
    if (!item) return;
    async function onPaste(e: ClipboardEvent) {
      const data = e.clipboardData;
      if (!data) return;
      const blobs: { blob: Blob; filename?: string }[] = [];
      for (const it of Array.from(data.items)) {
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const file = it.getAsFile();
          if (file) blobs.push({ blob: file, filename: file.name || undefined });
        }
      }
      if (blobs.length === 0) return;
      e.preventDefault();
      try {
        await addAttachmentsFromBlobs(item!.id, blobs);
        setPasteFlash(true);
        setTimeout(() => setPasteFlash(false), 800);
      } catch (err) {
        setErrorMsg(
          'Storage quota exceeded — image is too large for localStorage. Try a smaller screenshot or remove other attachments.',
        );
        console.error(err);
      }
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [item, addAttachmentsFromBlobs]);

  if (!item || !draft) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-muted">
        Item not found.
      </div>
    );
  }

  const project = projects.find((p) => p.id === draft.projectId);
  const assignee = users.find((u) => u.id === item.assigneeId);
  const typeCfg = TYPE_CONFIG[draft.type];
  const statusTint = STATUS_TINT[draft.status];
  const priorityTint = PRIORITY_TINT[draft.priority ?? 'none'];

  function handleBack() {
    requestClose(() => navigate('/'));
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    try {
      for (const f of Array.from(files)) {
        if (!f.type.startsWith('image/')) continue;
        await addAttachment(item!.id, f);
      }
    } catch (err) {
      setErrorMsg(
        'Storage quota exceeded — try a smaller image or remove existing attachments.',
      );
      console.error(err);
    }
  }

  return (
    <>
      <header className="h-12 border-b border-line flex items-center px-4 gap-3 shrink-0">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1.5 text-[12.5px] px-1.5 py-1 rounded hover:bg-white/[0.04] text-ink-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
          Board
        </button>
        <div className="flex items-center gap-2 text-[12.5px] min-w-0">
          <span className="text-ink-subtle">›</span>
          <span className="text-ink-muted truncate">{project?.name}</span>
          <span className="text-ink-subtle">›</span>
          <span className="font-medium">{item.shortId}</span>
        </div>

        <div className="flex-1" />

        {dirty ? (
          <>
            <span className="text-[11.5px] text-[#fbbf24] flex items-center gap-1.5">
              <span className="dot" style={{ background: '#fbbf24', width: 6, height: 6 }} />
              Unsaved changes
            </span>
            <button
              type="button"
              onClick={discard}
              className="text-[12.5px] px-3 py-1.5 rounded text-ink-2 hover:bg-white/[0.04] transition-colors"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={save}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium text-white bg-accent hover:bg-accent-2 transition-colors"
            >
              <Check className="w-3.5 h-3.5" strokeWidth={2.25} />
              Save
              <span
                className="kbd"
                style={{
                  background: 'rgba(0,0,0,0.28)',
                  borderColor: 'rgba(255,255,255,0.18)',
                  color: 'rgba(255,255,255,0.85)',
                }}
              >
                ⌘
              </span>
              <span
                className="kbd"
                style={{
                  background: 'rgba(0,0,0,0.28)',
                  borderColor: 'rgba(255,255,255,0.18)',
                  color: 'rgba(255,255,255,0.85)',
                }}
              >
                S
              </span>
            </button>
          </>
        ) : (
          <>
            {savedFlash && (
              <span
                className="text-[11.5px] text-[#86efac] flex items-center gap-1.5"
                aria-live="polite"
              >
                <Check className="w-3 h-3" strokeWidth={2.5} />
                Saved
              </span>
            )}
            <button
              type="button"
              className="flex items-center gap-1.5 text-[12.5px] px-2 py-1 rounded hover:bg-white/[0.04] text-ink-2"
            >
              <Share2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              Share
            </button>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(window.location.href)}
              className="flex items-center gap-1.5 text-[12.5px] px-2 py-1 rounded hover:bg-white/[0.04] text-ink-2"
            >
              <Link2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              Copy link
            </button>
            <button
              type="button"
              className="p-1 rounded hover:bg-white/[0.04] text-ink-2"
              aria-label="More"
            >
              <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </>
        )}
      </header>

      {errorMsg && (
        <div
          role="alert"
          className="border-b border-line bg-[rgba(239,68,68,0.08)] text-[12.5px] text-[#fca5a5] px-4 py-2 flex items-center gap-2"
        >
          <span className="flex-1">{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-[#fca5a5] hover:text-white p-1"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden flex">
        {/* main content */}
        <div className="flex-1 overflow-y-auto min-w-0">
          <div className="max-w-[760px] mx-auto px-8 py-7">
            {/* meta row */}
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <span className="meta-text">{item.shortId}</span>
              {draft.type === 'bug' && (
                <span className="type-bug-pill">
                  <Bug strokeWidth={2.25} />
                  Bug
                </span>
              )}
              {draft.priority && (
                <span
                  className="pill"
                  style={{
                    background: PRIORITY_COLOR[draft.priority].bg,
                    color: PRIORITY_COLOR[draft.priority].color,
                  }}
                >
                  {PRIORITY_LABEL[draft.priority]}
                </span>
              )}
              <span className="meta-text">·</span>
              <span className="meta-text">
                Created {formatAbsolute(item.createdAt)} · Updated {formatRelative(item.updatedAt)}
              </span>
            </div>

            {/* title */}
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setField('title', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-full bg-transparent text-[24px] leading-tight font-semibold tracking-tight mb-5 placeholder:text-ink-subtle focus:outline-none"
              aria-label="Title"
              placeholder="Title"
            />

            {/* description */}
            <textarea
              value={draft.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Add a description… Paste images anywhere on this page with Ctrl+V — they'll attach below."
              className="w-full bg-transparent text-[13.5px] leading-[1.65] text-ink-2 placeholder:text-ink-subtle resize-none focus:outline-none min-h-[120px]"
              rows={Math.max(4, draft.description.split('\n').length + 1)}
              aria-label="Description"
            />

            {/* attachments (instant-save) */}
            <section className="mt-7 pt-6 border-t border-line">
              <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />
                  <h2 className="text-[14px] font-semibold">Attachments</h2>
                  <span className="meta-text">{item.attachments.length}</span>
                  {pasteFlash && (
                    <span className="text-[11px] text-[#86efac]" aria-live="polite">
                      ✓ Pasted
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[12px] flex items-center gap-1.5 px-2 py-1 rounded text-ink-2 border border-line hover:border-line-2 hover:bg-white/[0.03] transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" strokeWidth={1.75} />
                    Upload
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      handleFiles(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <span className="text-[11.5px] text-ink-muted flex items-center gap-1">
                    or paste with <span className="kbd">Ctrl</span>{' '}
                    <span className="kbd">V</span>
                  </span>
                </div>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add('ring-1', 'ring-accent/40');
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove('ring-1', 'ring-accent/40');
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('ring-1', 'ring-accent/40');
                  handleFiles(e.dataTransfer.files);
                }}
                className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 rounded-lg p-0.5 transition-shadow"
              >
                {item.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="relative group rounded-md border border-line overflow-hidden bg-panel cursor-zoom-in"
                    style={{ aspectRatio: '16 / 10' }}
                  >
                    <img
                      src={att.url ?? ''}
                      alt={att.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute left-1.5 bottom-1.5 text-[10.5px] px-1.5 py-0.5 rounded bg-black/55 text-ink-2 backdrop-blur-sm pointer-events-none truncate max-w-[calc(100%-12px)]">
                      {att.filename} · {formatBytes(att.sizeBytes)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Remove ${att.filename}?`)) {
                          void removeAttachment(item.id, att.id);
                        }
                      }}
                      className="absolute top-1.5 right-1.5 w-[22px] h-[22px] rounded bg-black/55 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm hover:bg-black/75"
                      aria-label={`Remove ${att.filename}`}
                    >
                      <X className="w-3 h-3" strokeWidth={2} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center flex-col gap-1.5 rounded-md border border-dashed border-line-2 text-ink-muted hover:border-accent hover:bg-accent/[0.04] hover:text-ink-2 transition-colors p-3"
                  style={{ aspectRatio: '16 / 10' }}
                >
                  <Upload className="w-5 h-5" strokeWidth={1.5} />
                  <span className="text-[11.5px]">Drop, paste or click</span>
                  <span className="text-[10.5px] text-ink-subtle">PNG, JPG</span>
                </button>
              </div>
              <p className="text-[11px] text-ink-subtle mt-2">
                Attachments save immediately (so a pasted screenshot won't be lost
                if you discard other edits).
              </p>
            </section>

            {/* danger zone */}
            <div className="mt-7 pt-6 border-t border-line">
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete ${item.shortId}? This cannot be undone.`)) {
                    void deleteItem(item.id).then(() => navigate('/'));
                  }
                }}
                className="text-[12px] flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.04] text-ink-muted hover:text-[#ef4444] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                Delete item
              </button>
            </div>

            <div className="h-10" />
          </div>
        </div>

        {/* right rail: properties */}
        <aside className="w-[280px] shrink-0 border-l border-line overflow-y-auto bg-[#08090b]">
          <div className="p-4">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold mb-3 text-ink-subtle">
              Properties
            </div>

            <div className="space-y-1">
              <PropertyRow label="Status">
                <TintedSelect
                  value={draft.status}
                  onChange={(v) => setField('status', v as Status)}
                  tint={statusTint}
                  ariaLabel="Status"
                  leadingDot={STATUS_CONFIG[draft.status].dot}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s} className="bg-panel text-ink">
                      {STATUS_CONFIG[s].label}
                    </option>
                  ))}
                </TintedSelect>
              </PropertyRow>

              <PropertyRow label="Type">
                <TintedSelect
                  value={draft.type}
                  onChange={(v) => setField('type', v as ItemType)}
                  tint={{
                    bg: typeCfg.bg,
                    border: typeCfg.border,
                    text: typeCfg.color,
                  }}
                  ariaLabel="Type"
                  leadingIcon={
                    draft.type === 'bug' ? (
                      <Bug
                        className="w-3 h-3"
                        strokeWidth={2.25}
                        style={{ color: typeCfg.color }}
                      />
                    ) : null
                  }
                >
                  {ITEM_TYPES.map((t) => (
                    <option key={t} value={t} className="bg-panel text-ink capitalize">
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </TintedSelect>
              </PropertyRow>

              <PropertyRow label="Assignee">
                <div className="prop-control bg-panel-2 border-line flex items-center gap-2 cursor-default">
                  <Avatar user={assignee} size={18} />
                  <span className="truncate">{assignee?.name ?? 'Unassigned'}</span>
                </div>
              </PropertyRow>

              <PropertyRow label="Project">
                <TintedSelect
                  value={draft.projectId}
                  onChange={(v) => setField('projectId', v)}
                  tint={{ bg: '#14171c', border: '#1c1f25', text: '#e8e9ed' }}
                  ariaLabel="Project"
                  leadingDot={project?.color}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-panel text-ink">
                      {p.name}
                    </option>
                  ))}
                </TintedSelect>
              </PropertyRow>

              <PropertyRow label="Priority">
                <TintedSelect
                  value={draft.priority ?? ''}
                  onChange={(v) => setField('priority', (v || null) as Priority)}
                  tint={priorityTint}
                  ariaLabel="Priority"
                >
                  <option value="" className="bg-panel text-ink">None</option>
                  <option value="p0" className="bg-panel text-ink">P0 — critical</option>
                  <option value="p1" className="bg-panel text-ink">P1 — high</option>
                  <option value="p2" className="bg-panel text-ink">P2 — medium</option>
                  <option value="p3" className="bg-panel text-ink">P3 — low</option>
                </TintedSelect>
              </PropertyRow>

              {item.labels.length > 0 && (
                <PropertyRow label="Labels">
                  <div className="prop-control bg-panel-2 border-line flex flex-wrap gap-1 items-center cursor-default">
                    {item.labels.map((l) => (
                      <span
                        key={l}
                        className="pill"
                        style={{
                          background: 'rgba(138,143,153,0.14)',
                          color: '#c9cbd2',
                        }}
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                </PropertyRow>
              )}
            </div>

            <div className="my-5 border-t border-line" />

            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold mb-3 text-ink-subtle">
              Activity
            </div>
            <div className="space-y-1">
              <PropertyRow label="Created">
                <span className="prop-static">{formatAbsolute(item.createdAt)}</span>
              </PropertyRow>
              <PropertyRow label="Updated">
                <span className="prop-static">{formatRelative(item.updatedAt)}</span>
              </PropertyRow>
              {item.startedAt && (
                <PropertyRow label="Started">
                  <span className="prop-static">{formatAbsolute(item.startedAt)}</span>
                </PropertyRow>
              )}
              {item.resolvedAt && (
                <PropertyRow label="Resolved">
                  <span className="prop-static">{formatAbsolute(item.resolvedAt)}</span>
                </PropertyRow>
              )}
            </div>

            {dirty && (
              <div className="mt-5 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={save}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[12.5px] font-medium text-white bg-accent hover:bg-accent-2 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" strokeWidth={2.25} />
                  Save changes
                  <CornerDownLeft className="w-3 h-3 ml-1" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={discard}
                  className="w-full mt-1.5 text-[11.5px] text-ink-muted hover:text-ink-2 py-1.5 transition-colors"
                >
                  Discard changes
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Unsaved-changes overlay */}
      {closeRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCloseRequest(null);
          }}
          role="presentation"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="unsaved-title"
            aria-describedby="unsaved-desc"
            className="w-full max-w-[440px] bg-panel border border-line shadow-2xl shadow-black/50"
            style={{ borderRadius: 10 }}
          >
            <div className="p-5">
              <h2 id="unsaved-title" className="text-[15px] font-semibold mb-1.5">
                Unsaved changes
              </h2>
              <p id="unsaved-desc" className="text-[13px] text-ink-2 leading-relaxed">
                You have unsaved edits on{' '}
                <span className="text-ink font-medium">{item.shortId}</span>. What
                do you want to do?
              </p>
            </div>
            <div
              className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line bg-[#0b0d11]"
              style={{ borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}
            >
              <button
                type="button"
                onClick={() => {
                  const action = closeRequest.action;
                  setCloseRequest(null);
                  action();
                }}
                className="text-[12.5px] px-3 py-1.5 rounded text-ink-muted hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)] transition-colors"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => setCloseRequest(null)}
                className="text-[12.5px] px-3 py-1.5 rounded text-ink-2 hover:bg-white/[0.04] transition-colors"
              >
                Go back
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  const action = closeRequest.action;
                  save()
                    .then(() => {
                      setCloseRequest(null);
                      action();
                    })
                    .catch(() => {});
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium text-white bg-accent hover:bg-accent-2 transition-colors"
              >
                <Check className="w-3.5 h-3.5" strokeWidth={2.25} />
                Save &amp; close
                <span
                  className="kbd ml-1"
                  style={{
                    background: 'rgba(0,0,0,0.28)',
                    borderColor: 'rgba(255,255,255,0.18)',
                    color: 'rgba(255,255,255,0.85)',
                  }}
                >
                  ↵
                </span>
              </button>
            </div>
            <div className="px-5 pb-3 -mt-1">
              <span className="text-[11px] text-ink-subtle">
                Press <span className="kbd">Esc</span> to go back ·{' '}
                <span className="kbd">↵</span> to save &amp; close
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ───────── small render helpers ───────── */

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="grid items-center gap-2 px-0.5 py-0.5"
      style={{ gridTemplateColumns: '78px 1fr' }}
    >
      <span className="text-[12px] text-ink-muted">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

interface TintedSelectProps {
  value: string;
  onChange: (next: string) => void;
  tint: { bg: string; border: string; text: string };
  children: React.ReactNode;
  ariaLabel: string;
  leadingDot?: string;
  leadingIcon?: React.ReactNode;
}

/**
 * A right-rail select that visually matches the chip styling of preview-4.
 * Native <select> for accessibility; the trigger is styled via wrapper.
 */
function TintedSelect({
  value,
  onChange,
  tint,
  children,
  ariaLabel,
  leadingDot,
  leadingIcon,
}: TintedSelectProps) {
  return (
    <label
      className="prop-control relative flex items-center gap-1.5 cursor-pointer transition-colors"
      style={{
        background: tint.bg,
        borderColor: tint.border,
        color: tint.text,
      }}
    >
      {leadingDot && (
        <span
          className="dot"
          style={{ background: leadingDot, width: 8, height: 8 }}
        />
      )}
      {leadingIcon}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="appearance-none bg-transparent border-0 outline-none flex-1 min-w-0 cursor-pointer text-[12.5px] pr-4 truncate"
        style={{ color: 'inherit' }}
      >
        {children}
      </select>
      <span className="absolute right-2 pointer-events-none text-[10px] opacity-70">▾</span>
    </label>
  );
}
