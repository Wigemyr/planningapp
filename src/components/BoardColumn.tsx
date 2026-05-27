import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Item, Status } from '@/lib/types';
import { STATUS_CONFIG } from '@/lib/constants';
import { ItemCard } from './ItemCard';
import { useUi } from '@/store/useUi';
import { Plus } from './icons';

function SortableCard({ item }: { item: Item }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ItemCard item={item} />
    </div>
  );
}

interface Props {
  status: Status;
  items: Item[];
}

export function BoardColumn({ status, items }: Props) {
  const cfg = STATUS_CONFIG[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const openNewItem = useUi((s) => s.openNewItem);

  return (
    <section
      ref={setNodeRef}
      // Layout (horizontal vs vertical stack) and separator side both live in
      // .board-col + media query — see src/index.css. :not(:last-child) handles
      // the separator-on-last suppression, no marker class needed.
      className="board-col"
    >
      <header
        className="flex items-center gap-2.5"
        style={{
          padding: '8px 2px 12px 2px',
          margin: '0 0 10px',
          borderBottom: '1px solid var(--line-1)',
        }}
      >
        <span
          className="dot"
          style={{ background: cfg.dot }}
        />
        <span
          className="font-semibold tracking-tight"
          style={{ fontSize: 14.5, letterSpacing: '-0.018em', color: 'var(--ink-1)' }}
        >
          {cfg.label}
        </span>
        <span
          className="tabular-nums"
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--ink-3)',
            background: 'rgba(255,255,255,0.05)',
            padding: '1px 7px',
            borderRadius: 999,
          }}
        >
          {items.length}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          aria-label={`Add item to ${cfg.label}`}
          onClick={() => openNewItem({ status })}
          className="p-1 -mr-1 rounded-md transition-colors"
          style={{ color: 'var(--ink-3)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-3)')}
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </header>

      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {/* board-col-cards: own per-column scroll at lg+, sized by content below. */}
        <div className="board-col-cards">
          {items.length === 0 ? (
            <div
              className="board-empty-state text-[11px] text-center italic flex items-center justify-center min-h-[80px] lg:h-full lg:min-h-[160px]"
              style={{ color: isOver ? 'var(--accent-2)' : 'var(--ink-4)' }}
            >
              {isOver ? 'Drop here' : 'Empty — click + or drop here'}
            </div>
          ) : (
            items.map((item) => <SortableCard key={item.id} item={item} />)
          )}
        </div>
      </SortableContext>
    </section>
  );
}
