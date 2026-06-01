import { useEffect } from 'react';
import type { Attachment } from '@/lib/types';
import { formatBytes } from '@/lib/format';
import { X, ChevronLeft, ChevronRight } from './icons';

interface Props {
  attachments: Attachment[];
  index: number;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}

/** Image preview overlay — shows the current attachment at up to 90vw / 86vh,
 * supports prev/next with arrow keys or on-screen buttons, and closes on
 * Esc / X / backdrop click. Not full-screen; the dimmed backdrop keeps the
 * drawer visible at the edges. */
export function ImageLightbox({ attachments, index, onClose, onIndexChange }: Props) {
  const current = attachments[index];
  const hasMultiple = attachments.length > 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft' && hasMultiple) {
        e.preventDefault();
        onIndexChange((index - 1 + attachments.length) % attachments.length);
      } else if (e.key === 'ArrowRight' && hasMultiple) {
        e.preventDefault();
        onIndexChange((index + 1) % attachments.length);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, attachments.length, hasMultiple, onClose, onIndexChange]);

  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${current.filename}`}
      className="fixed inset-0 z-[60] flex items-center justify-center px-6 py-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        background: 'rgba(8,8,12,0.78)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Close (top-right) */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
        style={{
          background: 'rgba(28,28,32,0.85)',
          border: '1px solid var(--line-2)',
          color: 'var(--ink-2)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(40,40,46,0.95)';
          e.currentTarget.style.color = 'var(--ink-1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(28,28,32,0.85)';
          e.currentTarget.style.color = 'var(--ink-2)';
        }}
      >
        <X className="w-4 h-4" strokeWidth={1.75} />
      </button>

      {/* Prev */}
      {hasMultiple && (
        <button
          type="button"
          onClick={() => onIndexChange((index - 1 + attachments.length) % attachments.length)}
          aria-label="Previous image"
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
          style={{
            background: 'rgba(28,28,32,0.85)',
            border: '1px solid var(--line-2)',
            color: 'var(--ink-2)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(40,40,46,0.95)';
            e.currentTarget.style.color = 'var(--ink-1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(28,28,32,0.85)';
            e.currentTarget.style.color = 'var(--ink-2)';
          }}
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={1.75} />
        </button>
      )}

      {/* Next */}
      {hasMultiple && (
        <button
          type="button"
          onClick={() => onIndexChange((index + 1) % attachments.length)}
          aria-label="Next image"
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
          style={{
            background: 'rgba(28,28,32,0.85)',
            border: '1px solid var(--line-2)',
            color: 'var(--ink-2)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(40,40,46,0.95)';
            e.currentTarget.style.color = 'var(--ink-1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(28,28,32,0.85)';
            e.currentTarget.style.color = 'var(--ink-2)';
          }}
        >
          <ChevronRight className="w-5 h-5" strokeWidth={1.75} />
        </button>
      )}

      {/* Image + caption stack */}
      <div className="flex flex-col items-center gap-3 max-w-full max-h-full">
        <img
          src={current.url ?? ''}
          alt={current.filename}
          className="rounded-md shadow-2xl shadow-black/60"
          style={{
            maxWidth: 'min(90vw, 1280px)',
            maxHeight: '78vh',
            objectFit: 'contain',
            background: 'rgba(20,20,24,0.6)',
          }}
        />
        <div
          className="flex items-center gap-3 text-[12px] tabular-nums px-3 py-1.5 rounded-full"
          style={{
            background: 'rgba(20,20,24,0.85)',
            border: '1px solid var(--line-1)',
            color: 'var(--ink-2)',
          }}
        >
          <span className="truncate max-w-[360px]" title={current.filename}>
            {current.filename}
          </span>
          <span style={{ color: 'var(--ink-4)' }}>·</span>
          <span>{formatBytes(current.sizeBytes)}</span>
          {hasMultiple && (
            <>
              <span style={{ color: 'var(--ink-4)' }}>·</span>
              <span>
                {index + 1} / {attachments.length}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
