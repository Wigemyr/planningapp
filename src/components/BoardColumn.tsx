import { useDndContext, useDroppable } from '@dnd-kit/core';
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

export function BoardColumn({ status, items }: { status: Status; items: Item[] }) {
  const cfg = STATUS_CONFIG[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const openNewItem = useUi((s) => s.openNewItem);
  const dnd = useDndContext();
  const isDragging = !!dnd.active;

  // Visual feedback hierarchy:
  //   no drag         → resting column border
  //   drag in progress → faint accent dashed border on all columns
  //   drag is over me → strong accent border + accent tint background
  const borderColor = isOver
    ? '#7170ff'
    : isDragging
      ? 'rgba(113,112,255,0.28)'
      : cfg.border || '#1c1f25';
  const borderStyle = isDragging && !isOver ? 'dashed' : 'solid';

  return (
    <section
      ref={setNodeRef}
      className="w-[304px] shrink-0 flex flex-col rounded-[10px] p-[10px] pt-3"
      style={{
        background: isOver ? 'rgba(113,112,255,0.07)' : cfg.tintBg,
        border: `1px ${borderStyle} ${borderColor}`,
        transition: 'border-color 120ms ease, background 120ms ease',
      }}
    >
      <header className="flex items-center gap-2 px-1.5 pb-3">
        <span
          className="dot"
          style={{
            background: cfg.dot,
            boxShadow: status === 'active' ? '0 0 0 3px rgba(113,112,255,0.18)' : undefined,
          }}
        />
        <span
          className="text-[12.5px] font-semibold"
          style={cfg.dim ? { color: '#8a8f99' } : undefined}
        >
          {cfg.label}
        </span>
        <span className="meta-text">{items.length}</span>
        <div className="flex-1" />
        <button
          type="button"
          aria-label={`Add item to ${cfg.label}`}
          onClick={() => openNewItem({ status })}
          className="text-ink-subtle hover:text-ink-2 p-1 -mr-1 rounded transition-colors"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </header>

      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 overflow-y-auto pr-0.5 flex-1 min-h-[120px]">
          {items.length === 0 ? (
            <div
              className="text-[11px] text-center italic flex items-center justify-center h-full min-h-[120px]"
              style={{ color: isOver ? '#7170ff' : '#5d626c' }}
            >
              {isDragging ? 'Drop here' : 'Empty — click + or drop here'}
            </div>
          ) : (
            items.map((item) => <SortableCard key={item.id} item={item} />)
          )}
        </div>
      </SortableContext>
    </section>
  );
}
