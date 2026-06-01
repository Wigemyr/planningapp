import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store/useStore';
import { X, Folder, Check, CornerDownLeft } from './icons';

const COLORS = [
  '#5b8def', '#6aa57d', '#c79348', '#c66e6b',
  '#a78bdc', '#5d9aa2', '#b06f95', '#d59a73',
  '#8a8a8d', '#7ba2f2',
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
}

/** Auto-derive prefix from name (3 letters, uppercase). User can override. */
function suggestPrefix(n: string) {
  return n
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3);
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

  const livePrefix = (prefix || suggestPrefix(name) || 'PRJ').toUpperCase();

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', paddingTop: '13vh' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        className="w-full max-w-[460px] overflow-hidden"
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--line-2)',
          borderRadius: 10,
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
              style={{ background: 'var(--surface-3)', border: '1px solid var(--line-2)' }}
            >
              <Folder className="w-4 h-4" strokeWidth={1.75} style={{ color: 'var(--ink-2)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 id="new-project-title" className="text-[15px] font-semibold leading-tight">
                Create a new project
              </h2>
              <p className="text-[12.5px] text-ink-muted mt-0.5">
                Organize related items into a board
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 -mr-1 rounded-md text-ink-muted hover:text-ink hover:bg-white/[0.05]"
              aria-label="Close"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="border-t border-line" />

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-[11.5px] font-medium text-ink-2 mb-1.5">
              Name
            </label>
            <input
              ref={nameRef}
              type="text"
              required
              placeholder="e.g. Mobile app v2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              className="w-full px-3 py-2 rounded-md text-[14px] text-ink placeholder:text-ink-subtle focus:outline-none transition-colors"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-1)')}
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="text-[11.5px] font-medium text-ink-2">Short prefix</label>
              <span className="text-[11px] text-ink-subtle">
                Tickets will be <span className="font-mono">{livePrefix}-001</span>
              </span>
            </div>
            <input
              type="text"
              placeholder={suggestPrefix(name) || 'PRJ'}
              value={prefix}
              maxLength={6}
              onChange={(e) =>
                setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
              }
              className="w-28 px-3 py-2 rounded-md text-[14px] font-mono tracking-wider uppercase text-ink placeholder:text-ink-subtle focus:outline-none transition-colors"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-1)')}
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-medium text-ink-2 mb-1.5">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  className="relative rounded-md transition-transform hover:scale-105"
                  style={{
                    width: 28,
                    height: 28,
                    background: c,
                    boxShadow: color === c ? '0 0 0 2px var(--surface-2), 0 0 0 4px var(--ink-1)' : undefined,
                  }}
                >
                  {color === c && (
                    <Check
                      className="absolute inset-0 m-auto w-3.5 h-3.5 text-white"
                      strokeWidth={3}
                      style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))' }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <p role="alert" className="text-[12px]" style={{ color: '#d68a86' }}>
              {errorMsg}
            </p>
          )}
        </div>

        <div
          className="flex items-center justify-between px-5 py-3.5 border-t border-line"
          style={{ background: 'rgba(0,0,0,0.18)' }}
        >
          <span className="text-[11.5px] text-ink-subtle flex items-center gap-1.5">
            <CornerDownLeft className="w-3 h-3" strokeWidth={1.75} />
            <span>to create</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-[12.5px] px-3 py-1.5 rounded-md text-ink-2 hover:bg-white/[0.05] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!name.trim() || submitting}
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
              {submitting ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
