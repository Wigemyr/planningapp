import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from './icons';

export interface SelectOption {
  value: string;
  label: string;
  /** Optional small colored dot rendered before the label */
  dot?: string;
  /** Optional inline icon (lucide) rendered before the label */
  icon?: React.ReactNode;
  /** Optional explicit color override for the displayed value */
  color?: string;
}

interface Props {
  value: string;
  options: SelectOption[];
  onChange: (next: string) => void;
  ariaLabel: string;
  /** Width of the trigger; menu auto-sizes to at least the trigger width */
  className?: string;
  /** Optional styling overrides for trigger */
  triggerStyle?: React.CSSProperties;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * A small custom dropdown that renders its menu in a z-index above modals,
 * dodging the native-select clipping that happens inside dialogs on some
 * browsers (Edge/Chrome on Windows can render <select> menus as a sliver
 * inside a `<dialog>`-like overlay).
 */
export function Select({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
  triggerStyle,
  placeholder,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-1.5 rounded-md border border-line bg-panel-2 px-2 py-1 text-[11.5px] text-ink-2 hover:border-line-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
        style={triggerStyle}
      >
        {current?.dot && (
          <span
            className="rounded-full shrink-0"
            style={{ width: 8, height: 8, background: current.dot }}
          />
        )}
        {current?.icon}
        <span
          className="flex-1 text-left truncate"
          style={current?.color ? { color: current.color } : undefined}
        >
          {current?.label ?? placeholder ?? ''}
        </span>
        <ChevronDown
          className="w-3 h-3 shrink-0 opacity-70"
          strokeWidth={2}
        />
      </button>

      {open && menuPos && (
        <div
          ref={menuRef}
          role="listbox"
          aria-label={ariaLabel}
          className="fixed z-[60] rounded-md border border-line-2 bg-panel-2 shadow-2xl shadow-black/50 py-1 max-h-[280px] overflow-y-auto"
          style={{
            top: menuPos.top,
            left: menuPos.left,
            minWidth: menuPos.width,
          }}
        >
          {options.map((opt) => {
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-left transition-colors ${
                  selected
                    ? 'bg-white/[0.06] text-ink'
                    : 'text-ink-2 hover:bg-white/[0.04] hover:text-ink'
                }`}
              >
                {opt.dot && (
                  <span
                    className="rounded-full shrink-0"
                    style={{ width: 8, height: 8, background: opt.dot }}
                  />
                )}
                {opt.icon}
                <span className="flex-1 truncate" style={opt.color ? { color: opt.color } : undefined}>
                  {opt.label}
                </span>
                {selected && <span className="text-accent text-[10px]">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
