import { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
} from './icons';

interface Props {
  /** Stored value — HTML string. */
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** Minimum editor body height in px (excludes the toolbar). Default ~6 lines. */
  minBodyHeight?: number;
  /** Optional key handler — receives the native keydown event on the editor. */
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * Small contenteditable rich-text editor with a fixed toolbar — bold / italic /
 * underline / strikethrough / unordered list / ordered list. Stored as HTML.
 *
 * Why contenteditable + execCommand rather than a library: scope. execCommand
 * is officially deprecated but still works in every browser and is unlikely to
 * be removed. The whole component is ~150 lines and 0 dependencies. If we ever
 * outgrow this (collaborative editing, mentions, slash-menus) we can swap it
 * for TipTap or Slate behind the same `value`/`onChange` API.
 *
 * Security: paste events are intercepted and downgraded to plain text so users
 * can't accidentally (or maliciously) inject `<script>` / `<img onerror>` /
 * etc. The editor itself only emits the simple tags execCommand produces
 * (`<b>`, `<i>`, `<u>`, `<strike>`, `<ul>`, `<ol>`, `<li>`, `<div>`, `<br>`).
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  ariaLabel,
  minBodyHeight = 140,
  onKeyDown,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(!stripTags(value));

  // Set initial HTML exactly once. After that we never overwrite innerHTML
  // from React state, because doing so would reset the caret and selection
  // on every keystroke. The parent receives changes via onChange.
  const initialisedRef = useRef(false);
  useEffect(() => {
    if (!editorRef.current || initialisedRef.current) return;
    editorRef.current.innerHTML = value || '';
    initialisedRef.current = true;
    setIsEmpty(!editorRef.current.textContent?.trim());
  }, [value]);

  // If the parent supplies a brand new value externally (e.g. switching items
  // on the detail page), pull it in. Detected by string-comparing to the
  // current innerHTML.
  useEffect(() => {
    const el = editorRef.current;
    if (!el || !initialisedRef.current) return;
    if (value !== el.innerHTML) {
      el.innerHTML = value || '';
      setIsEmpty(!el.textContent?.trim());
    }
  }, [value]);

  function exec(command: string) {
    // Keep selection inside the editor when a toolbar button is clicked.
    editorRef.current?.focus();
    document.execCommand(command, false);
    handleInput();
  }

  function handleInput() {
    const el = editorRef.current;
    if (!el) return;
    onChange(el.innerHTML);
    setIsEmpty(!el.textContent?.trim());
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    // Downgrade pasted HTML to plain text — prevents pasting an entire web
    // page with scripts/styles and keeps our stored HTML simple.
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }

  return (
    <div
      className="rounded-md border border-line overflow-hidden"
      style={{ background: 'rgba(0,0,0,0.10)' }}
    >
      <div
        className="flex items-center gap-0.5 px-1.5 py-1 border-b border-line"
        style={{ background: 'rgba(0,0,0,0.18)' }}
      >
        <ToolbarButton onAction={() => exec('bold')} title="Bold (Ctrl+B)">
          <Bold className="w-3.5 h-3.5" strokeWidth={2.25} />
        </ToolbarButton>
        <ToolbarButton onAction={() => exec('italic')} title="Italic (Ctrl+I)">
          <Italic className="w-3.5 h-3.5" strokeWidth={2.25} />
        </ToolbarButton>
        <ToolbarButton onAction={() => exec('underline')} title="Underline (Ctrl+U)">
          <Underline className="w-3.5 h-3.5" strokeWidth={2.25} />
        </ToolbarButton>
        <ToolbarButton onAction={() => exec('strikeThrough')} title="Strikethrough">
          <Strikethrough className="w-3.5 h-3.5" strokeWidth={2.25} />
        </ToolbarButton>
        <span className="w-px h-3.5 bg-line mx-1" />
        <ToolbarButton onAction={() => exec('insertUnorderedList')} title="Bullet list">
          <List className="w-3.5 h-3.5" strokeWidth={2} />
        </ToolbarButton>
        <ToolbarButton onAction={() => exec('insertOrderedList')} title="Numbered list">
          <ListOrdered className="w-3.5 h-3.5" strokeWidth={2} />
        </ToolbarButton>
      </div>
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyDown={onKeyDown}
          className="rich-editor px-3 py-2 text-[13.5px] leading-[1.65] text-ink-2 focus:outline-none"
          style={{
            minHeight: minBodyHeight,
            resize: 'vertical',
            overflow: 'auto',
          }}
        />
        {isEmpty && placeholder && (
          <div
            aria-hidden="true"
            className="absolute left-3 top-2 text-[13.5px] leading-[1.65] text-ink-subtle pointer-events-none select-none"
          >
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}

interface ToolbarButtonProps {
  onAction: () => void;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onAction, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      // onMouseDown preventDefault keeps the editor's selection alive — without
      // this the button steals focus and document.execCommand has nothing to
      // act on.
      onMouseDown={(e) => {
        e.preventDefault();
        onAction();
      }}
      className="p-1 rounded text-ink-muted hover:text-ink hover:bg-white/[0.06] transition-colors"
    >
      {children}
    </button>
  );
}

/** Strip HTML tags for plain-text display (e.g. card preview). Decodes the
 * handful of entities execCommand-produced HTML can carry. */
export function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
