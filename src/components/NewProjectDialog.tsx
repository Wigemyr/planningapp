import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store/useStore';
import { X } from './icons';

const COLORS = [
  '#7170ff', '#f59e0b', '#10b981', '#ec4899',
  '#06b6d4', '#a855f7', '#ef4444', '#8b5cf6',
  '#14b8a6', '#f97316',
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
}

export function NewProjectDialog({ open, onClose, onCreated }: Props) {
  const createProject = useStore((s) => s.createProject);
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setPrefix('');
      setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
      setErrorMsg(null);
      setSubmitting(false);
      setTimeout(() => nameRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Auto-derive prefix from name (3 letters, uppercase) — user can override.
  function suggestPrefix(n: string) {
    return n
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 3);
  }

  if (!open) return null;

  async function submit() {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const project = await createProject({
        name: name.trim(),
        color,
        shortPrefix: (prefix.trim() || suggestPrefix(name) || 'PRJ').toUpperCase(),
      });
      onCreated?.(project.id);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create project');
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[14vh] px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        className="w-full max-w-[440px] bg-panel border border-line shadow-2xl shadow-black/50"
        style={{ borderRadius: 10 }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h2 id="new-project-title" className="text-[13px] font-semibold">
            New project
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-ink-muted hover:text-ink hover:bg-white/[0.05]"
            aria-label="Close"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <label className="block">
            <span className="text-[11px] text-ink-muted uppercase tracking-[0.14em] font-semibold">
              Name
            </span>
            <input
              ref={nameRef}
              type="text"
              required
              placeholder="e.g. Billing Platform"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              className="mt-1.5 w-full px-3 py-2 rounded-md bg-panel-2 border border-line text-[14px] text-ink placeholder:text-ink-subtle focus:outline-none focus:border-accent transition-colors"
            />
          </label>

          <label className="block">
            <span className="text-[11px] text-ink-muted uppercase tracking-[0.14em] font-semibold">
              Short prefix
            </span>
            <span className="text-[10.5px] text-ink-subtle ml-1.5">
              used for ticket IDs like {(prefix || suggestPrefix(name) || 'PRJ').toUpperCase()}-001
            </span>
            <input
              type="text"
              placeholder={suggestPrefix(name) || 'PRJ'}
              value={prefix}
              maxLength={6}
              onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              className="mt-1.5 w-32 px-3 py-2 rounded-md bg-panel-2 border border-line text-[14px] tabular-nums tracking-wider text-ink placeholder:text-ink-subtle focus:outline-none focus:border-accent transition-colors"
            />
          </label>

          <div>
            <span className="text-[11px] text-ink-muted uppercase tracking-[0.14em] font-semibold">
              Color
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  className={`w-7 h-7 rounded-md border-2 transition-all ${
                    color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {errorMsg && (
            <p role="alert" className="text-[12px] text-[#fca5a5]">{errorMsg}</p>
          )}
        </div>

        <div
          className="flex items-center justify-end gap-2 px-4 py-3 border-t border-line bg-[#13161c]"
          style={{ borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}
        >
          <button
            type="button"
            onClick={onClose}
            className="text-[12px] px-3 py-1.5 rounded text-ink-2 hover:bg-white/[0.04]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!name.trim() || submitting}
            className="text-[12px] font-medium px-3 py-1.5 rounded text-white bg-accent hover:bg-accent-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  );
}
