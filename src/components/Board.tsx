import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useStore, selectItemsByStatus } from '@/store/useStore';
import type { Item, Status } from '@/lib/types';
import { STATUSES } from '@/lib/types';
import { BoardColumn } from './BoardColumn';
import { ItemCard } from './ItemCard';
import { useFilteredItems } from '@/store/useFilters';
import { useUi } from '@/store/useUi';

/** Prefer column droppables when the pointer is in an empty area below the cards. */
const columnFriendlyDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    const cardHit = pointerCollisions.find(
      (c) => !(STATUSES as readonly string[]).includes(String(c.id)),
    );
    if (cardHit) return [cardHit];
    return pointerCollisions;
  }
  return rectIntersection(args);
};

export function Board() {
  const items = useStore((s) => s.items);
  const currentProjectId = useStore((s) => s.currentProjectId);
  const moveItem = useStore((s) => s.moveItem);
  const filtered = useFilteredItems(items);
  const boardLayout = useUi((s) => s.boardLayout);

  const byStatus = useMemo(
    () => selectItemsByStatus(filtered, currentProjectId),
    [filtered, currentProjectId],
  );

  const [activeItem, setActiveItem] = useState<Item | null>(null);

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
      const fullCol = byStatus[targetStatus];
      const activeIdxInFull = fullCol.findIndex((i) => i.id === activeId);
      const overIdxInFull = fullCol.findIndex((i) => i.id === overId);
      const col = fullCol.filter((i) => i.id !== activeId);
      let idx = col.findIndex((i) => i.id === overId);
      // When dragging downward inside the same column, the dropped card should
      // land BELOW the target, not in its slot. Without this nudge the card
      // ends up above where the user dropped it (visible bug: "drag down does
      // nothing"). Cross-column drops keep the natural insert slot.
      if (
        activeIdxInFull >= 0 &&
        overIdxInFull >= 0 &&
        activeIdxInFull < overIdxInFull
      ) {
        idx += 1;
      }
      targetIndex = idx >= 0 ? idx : col.length;
    }

    void moveItem(activeId, targetStatus, targetIndex);
  }

  return (
    <div className={`board-outer board-mode-${boardLayout}`}>
      <DndContext
        sensors={sensors}
        collisionDetection={columnFriendlyDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveItem(null)}
      >
        <div className="board-cols">
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
