import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useStore, selectItemsByStatus } from '@/store/useStore';
import type { Item, Status } from '@/lib/types';
import { STATUSES } from '@/lib/types';
import { BoardColumn } from './BoardColumn';
import { ItemCard } from './ItemCard';

export function Board() {
  const items = useStore((s) => s.items);
  const currentProjectId = useStore((s) => s.currentProjectId);
  const moveItem = useStore((s) => s.moveItem);

  const byStatus = useMemo(
    () => selectItemsByStatus(items, currentProjectId),
    [items, currentProjectId],
  );

  const [activeItem, setActiveItem] = useState<Item | null>(null);

  // Require a small drag distance before starting the drag — prevents accidental
  // drags when the user just wants to click into the card. 4px is the sweet spot:
  // big enough to filter pointer jitter, small enough to feel responsive.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(e: DragStartEvent) {
    const id = e.active.id as string;
    const it = items.find((i) => i.id === id);
    if (it) setActiveItem(it);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = e;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const moving = items.find((i) => i.id === activeId);
    if (!moving) return;

    let targetStatus: Status;
    let targetIndex = 0;

    if ((STATUSES as readonly string[]).includes(overId)) {
      // Dropped on a column directly (possibly empty) — append to end.
      targetStatus = overId as Status;
      targetIndex = byStatus[targetStatus].filter((i) => i.id !== activeId).length;
    } else {
      const overItem = items.find((i) => i.id === overId);
      if (!overItem) return;
      targetStatus = overItem.status;
      const col = byStatus[targetStatus].filter((i) => i.id !== activeId);
      const idx = col.findIndex((i) => i.id === overId);
      targetIndex = idx >= 0 ? idx : col.length;
    }

    moveItem(activeId, targetStatus, targetIndex);
  }

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveItem(null)}
      >
        <div className="flex gap-3 p-3 h-full" style={{ minWidth: 'max-content' }}>
          {STATUSES.map((s) => (
            <BoardColumn key={s} status={s} items={byStatus[s]} />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeItem ? (
            <div className="w-[284px]">
              <ItemCard item={activeItem} dragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
