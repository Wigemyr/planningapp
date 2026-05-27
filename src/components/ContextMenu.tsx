import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useUi } from '@/store/useUi';

/** Global right-click context menu — wired to useUi.contextMenu.
 * Call openContextMenu(x, y, items) from any element's onContextMenu handler.
 * The menu auto-positions to stay inside the viewport. */
export function ContextMenu() {
  const state = useUi((s) => s.contextMenu);
  const close = useUi((s) => s.closeContextMenu);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // After the menu mounts, measure it and clamp position to the viewport so it
  // doesn't get clipped off the right or bottom edge.
  useLayoutEffect(() => {
    if (!state || !ref.current) {
      setPos(null);
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    const margin = 6;
    const maxX = window.innerWidth - rect.width - margin;
    const maxY = window.innerHeight - rect.height - margin;
    setPos({
      x: Math.max(margin, Math.min(state.x, maxX)),
      y: Math.max(margin, Math.min(state.y, maxY)),
    });
  }, [state]);

  // Close on outside click, Escape, or scroll.
  useEffect(() => {
    if (!state) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    function onScroll() {
      close();
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [state, close]);

  if (!state) return null;

  const placement = pos ?? state;

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-[55] py-1 min-w-[170px]"
      style={{
        left: placement.x,
        top: placement.y,
        // Pre-measure render is hidden so we don't flash at the wrong position.
        opacity: pos ? 1 : 0,
        background: 'rgba(28,28,32,0.96)',
        backdropFilter: 'blur(14px)',
        border: '1px solid var(--line-2)',
        borderRadius: 8,
        boxShadow: '0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      {state.items.map((item, i) => (
        <button
          key={i}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            close();
            // Fire after the menu closes so consumer code doesn't see a stale UI.
            queueMicrotask(item.onClick);
          }}
          className={`w-full px-3 py-1.5 text-left text-[12.5px] flex items-center gap-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            item.danger
              ? 'text-ink-2 hover:bg-[rgba(198,110,107,0.12)] hover:text-[#d68a86]'
              : 'text-ink-2 hover:bg-white/[0.05] hover:text-ink'
          }`}
        >
          {item.icon && (
            <span className="w-3.5 h-3.5 inline-flex items-center justify-center shrink-0">
              {item.icon}
            </span>
          )}
          <span className="flex-1 truncate">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
