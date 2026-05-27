import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/store/useStore';
import { useFilters } from '@/store/useFilters';
import { PRIORITIES, ITEM_TYPES, type Priority, type ItemType } from '@/lib/types';
import { PRIORITY_LABEL } from '@/lib/constants';
import { Avatar } from './Avatar';
import {
  Search,
  Flag,
  Tag,
  Users,
  LayoutGrid,
  X,
  ChevronDown,
} from './icons';

/**
 * Top-of-board filter bar. State lives in `useFilters` — transient (not URL-synced).
 * "Just me" is a quick toggle that sets/unsets the magic 'me' assignee marker.
 */
export function BoardFilters() {
  const search = useFilters((s) => s.search);
  const setSearch = useFilters((s) => s.setSearch);
  const assignees = useFilters((s) => s.assignees);
  const priorities = useFilters((s) => s.priorities);
  const types = useFilters((s) => s.types);
  const labels = useFilters((s) => s.labels);
  const toggleAssignee = useFilters((s) => s.toggleAssignee);
  const togglePriority = useFilters((s) => s.togglePriority);
  const toggleType = useFilters((s) => s.toggleType);
  const toggleLabel = useFilters((s) => s.toggleLabel);
  const clearAll = useFilters((s) => s.clearAll);
  const hasActive = useFilters((s) => s.hasActive());

  const members = useStore((s) => s.members);
  const items = useStore((s) => s.items);
  const currentUserId = useStore((s) => s.currentUserId);

  const allLabels = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => it.labels.forEach((l) => set.add(l)));
    return Array.from(set).sort();
  }, [items]);

  const meActive = assignees.includes('me');

  return (
    <div className="border-b border-line flex items-center gap-2 px-4 py-2.5 flex-wrap">
      <div className="relative">
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-subtle"
          strokeWidth={1.75}
        />
        <input
          type="text"
          value={search}
          placeholder="Filter items…"
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 pr-3 py-1.5 w-[220px] text-[12px] rounded-md border border-line bg-panel text-ink placeholder:text-ink-subtle focus:outline-none focus:border-line-2"
        />
      </div>

      <div className="w-px h-5 bg-line" />

      <FilterChip
        active={meActive}
        onClear={meActive ? () => toggleAssignee('me') : undefined}
        onClick={() => toggleAssignee('me')}
      >
        <Avatar
          user={members.find((m) => m.user.id === currentUserId)?.user}
          size={16}
        />
        <span>Assigned to me</span>
      </FilterChip>

      <FilterMenu
        icon={<Flag className="w-3.5 h-3.5" strokeWidth={1.75} />}
        label="Priority"
        activeCount={priorities.length}
        renderItems={() => (
          <>
            {[...PRIORITIES, null].map((p) => {
              const checked = priorities.includes(p);
              return (
                <MenuCheckItem
                  key={String(p)}
                  checked={checked}
                  onClick={() => togglePriority(p as Priority)}
                >
                  <span className="text-[12.5px]">
                    {p ? PRIORITY_LABEL[p] : 'No priority'}
                  </span>
                </MenuCheckItem>
              );
            })}
          </>
        )}
      />

      <FilterMenu
        icon={<LayoutGrid className="w-3.5 h-3.5" strokeWidth={1.75} />}
        label="Type"
        activeCount={types.length}
        renderItems={() => (
          <>
            {ITEM_TYPES.map((t) => {
              const checked = types.includes(t);
              return (
                <MenuCheckItem
                  key={t}
                  checked={checked}
                  onClick={() => toggleType(t as ItemType)}
                >
                  <span className="text-[12.5px] capitalize">{t}</span>
                </MenuCheckItem>
              );
            })}
          </>
        )}
      />

      <FilterMenu
        icon={<Users className="w-3.5 h-3.5" strokeWidth={1.75} />}
        label="Assignee"
        activeCount={assignees.filter((a) => a !== 'me').length}
        renderItems={() => (
          <>
            {members.length === 0 ? (
              <div className="px-2 py-1.5 text-[12px] text-ink-muted">No members</div>
            ) : (
              members.map((m) => {
                const checked = assignees.includes(m.user.id);
                return (
                  <MenuCheckItem
                    key={m.user.id}
                    checked={checked}
                    onClick={() => toggleAssignee(m.user.id)}
                  >
                    <Avatar user={m.user} size={18} />
                    <span className="text-[12.5px]">{m.user.name}</span>
                  </MenuCheckItem>
                );
              })
            )}
          </>
        )}
      />

      {allLabels.length > 0 && (
        <FilterMenu
          icon={<Tag className="w-3.5 h-3.5" strokeWidth={1.75} />}
          label="Labels"
          activeCount={labels.length}
          renderItems={() => (
            <>
              {allLabels.map((l) => {
                const checked = labels.includes(l);
                return (
                  <MenuCheckItem
                    key={l}
                    checked={checked}
                    onClick={() => toggleLabel(l)}
                  >
                    <span className="text-[12.5px]">{l}</span>
                  </MenuCheckItem>
                );
              })}
            </>
          )}
        />
      )}

      <div className="flex-1" />

      {hasActive && (
        <button
          type="button"
          onClick={clearAll}
          className="text-[11.5px] text-ink-muted hover:text-ink-2 px-2 py-1 rounded transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

interface FilterChipProps {
  active?: boolean;
  onClick: () => void;
  onClear?: () => void;
  children: React.ReactNode;
}

function FilterChip({ active, onClick, onClear, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] rounded-md border transition-colors"
      style={{
        background: active ? 'var(--accent-soft)' : 'transparent',
        borderColor: active ? 'rgba(91,141,239,0.32)' : 'var(--line-1)',
        color: active ? '#c2c5f5' : 'var(--ink-2)',
      }}
    >
      {children}
      {onClear && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="opacity-70 hover:opacity-100 ml-0.5"
        >
          <X className="w-3 h-3" strokeWidth={2} />
        </span>
      )}
    </button>
  );
}

interface FilterMenuProps {
  icon: React.ReactNode;
  label: string;
  activeCount: number;
  renderItems: () => React.ReactNode;
}

function FilterMenu({ icon, label, activeCount, renderItems }: FilterMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const active = activeCount > 0;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] rounded-md border transition-colors"
        style={{
          background: active ? 'var(--accent-soft)' : 'transparent',
          borderColor: active ? 'rgba(91,141,239,0.32)' : 'var(--line-1)',
          color: active ? '#c2c5f5' : 'var(--ink-2)',
        }}
      >
        {icon}
        <span>{label}</span>
        {active && (
          <span className="text-[10.5px] bg-white/[0.08] rounded px-1 tabular-nums">
            {activeCount}
          </span>
        )}
        <ChevronDown className="w-3 h-3 text-ink-subtle" strokeWidth={2} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute z-30 mt-1 min-w-[180px] rounded-md border border-line-2 shadow-2xl shadow-black/40 p-1"
          style={{ background: 'rgba(28,28,32,0.96)', backdropFilter: 'blur(14px)' }}
        >
          {renderItems()}
        </div>
      )}
    </div>
  );
}

interface MenuCheckItemProps {
  checked: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function MenuCheckItem({ checked, onClick, children }: MenuCheckItemProps) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-left hover:bg-white/[0.05] transition-colors"
    >
      <input
        type="checkbox"
        className="check"
        checked={checked}
        readOnly
        tabIndex={-1}
      />
      {children}
    </button>
  );
}
