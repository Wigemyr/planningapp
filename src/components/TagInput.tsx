import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X } from './icons';

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** Existing labels in the workspace, used for the autocomplete suggestions. */
  allLabels: string[];
}

/**
 * Editable tag list for the item detail panel. Click "Add tag" → input
 * appears with a dropdown of existing labels (filtered as you type). Enter
 * commits a new or matching tag; Esc closes the dropdown; click an X on any
 * chip to remove. Tag names are normalized to lowercase + trimmed so
 * "Billing", " billing", and "BILLING" all dedupe to one tag.
 */
export function TagInput({ value, onChange, allLabels }: TagInputProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalized = useMemo(
    () => value.map((v) => normalizeTag(v)).filter(Boolean),
    [value],
  );

  // Suggestions: labels seen in the workspace minus ones already on this item,
  // filtered by what the user is typing. Case-insensitive substring match.
  const suggestions = useMemo(() => {
    const taken = new Set(normalized);
    const q = normalizeTag(draft);
    return allLabels
      .map(normalizeTag)
      .filter((l) => l && !taken.has(l))
      .filter((l) => (q ? l.includes(q) : true))
      .sort()
      .slice(0, 8);
  }, [allLabels, normalized, draft]);

  // Open editor when the user clicks the add button; focus the input.
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Click outside the wrapper closes the editor.
  useEffect(() => {
    if (!editing) return;
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        commitOrCancel();
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, draft]);

  function addTag(raw: string) {
    const tag = normalizeTag(raw);
    if (!tag) return;
    if (normalized.includes(tag)) {
      setDraft('');
      return;
    }
    onChange([...normalized, tag]);
    setDraft('');
  }

  function removeTag(tag: string) {
    onChange(normalized.filter((t) => t !== tag));
  }

  /** Used by outside-click + Esc: commit whatever's in the input then close. */
  function commitOrCancel() {
    if (draft.trim()) {
      addTag(draft);
    }
    setEditing(false);
    setDraft('');
  }

  return (
    <div
      ref={wrapperRef}
      className="prop-control bg-panel-2 border-line flex flex-wrap gap-1 items-center relative"
      style={{ minHeight: 30, paddingTop: 4, paddingBottom: 4 }}
      onClick={(e) => {
        // Clicking empty space inside the chip well opens the editor — but
        // not when clicking on a chip's X (those have their own handler).
        if ((e.target as HTMLElement).closest('[data-tag-chip]')) return;
        if (!editing) setEditing(true);
      }}
    >
      {normalized.map((tag) => (
        <span
          key={tag}
          data-tag-chip
          className="pill inline-flex items-center gap-1"
          style={{
            background: 'rgba(138,143,153,0.14)',
            color: '#c9cbd2',
          }}
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(tag);
            }}
            aria-label={`Remove ${tag}`}
            className="opacity-60 hover:opacity-100 -mr-0.5"
          >
            <X className="w-2.5 h-2.5" strokeWidth={2.5} />
          </button>
        </span>
      ))}

      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (draft.trim()) addTag(draft);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setEditing(false);
              setDraft('');
            } else if (
              e.key === 'Backspace' &&
              draft === '' &&
              normalized.length > 0
            ) {
              // Backspace on empty input nukes the last tag (Linear-style).
              e.preventDefault();
              removeTag(normalized[normalized.length - 1]);
            }
          }}
          placeholder="Type a tag…"
          className="bg-transparent text-[11.5px] placeholder:text-ink-subtle focus:outline-none min-w-[80px] flex-1"
        />
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          className="text-[11px] flex items-center gap-0.5 text-ink-subtle hover:text-ink-2 transition-colors"
          aria-label="Add tag"
        >
          <Plus className="w-3 h-3" strokeWidth={2} />
          {normalized.length === 0 && <span>Add tag</span>}
        </button>
      )}

      {/* Suggestions dropdown — only when editing and we have matches. */}
      {editing && suggestions.length > 0 && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+4px)] w-full max-h-[200px] overflow-y-auto rounded-md border border-line-2 shadow-2xl shadow-black/40 py-1 z-30"
          style={{
            background: 'rgba(28,28,32,0.96)',
            backdropFilter: 'blur(14px)',
          }}
        >
          {draft.trim() && !suggestions.includes(normalizeTag(draft)) && (
            <button
              type="button"
              role="option"
              aria-selected="false"
              onClick={(e) => {
                e.stopPropagation();
                addTag(draft);
              }}
              className="w-full text-left px-2.5 py-1.5 text-[12px] text-ink-2 hover:bg-white/[0.05] hover:text-ink flex items-center gap-1.5"
            >
              <Plus className="w-3 h-3" strokeWidth={2} />
              Create <span className="text-ink font-medium">{normalizeTag(draft)}</span>
            </button>
          )}
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected="false"
              onClick={(e) => {
                e.stopPropagation();
                addTag(s);
              }}
              className="w-full text-left px-2.5 py-1.5 text-[12px] text-ink-2 hover:bg-white/[0.05] hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Lowercase + trim + collapse whitespace. Returns '' for input that's just
 * whitespace or special chars only — caller should check before adding. */
function normalizeTag(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '-');
}
