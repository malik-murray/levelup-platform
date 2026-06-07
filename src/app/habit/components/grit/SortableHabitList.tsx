'use client';

import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { GritHabitTemplate } from '../../lib/gritTypes';
import { neon } from '@/app/dashboard/neonTheme';

function IconGrip() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="9" cy="7" r="1.5" />
      <circle cx="15" cy="7" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="17" r="1.5" />
      <circle cx="15" cy="17" r="1.5" />
    </svg>
  );
}

function SortableHabitRow({
  habit,
  onDelete,
  onEdit,
  busy,
  isCurrent,
}: {
  habit: GritHabitTemplate;
  onDelete: () => void;
  onEdit?: () => void;
  busy?: boolean;
  isCurrent?: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({
      id: habit.id,
      disabled: busy,
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? 'relative z-10 opacity-90' : ''}`}
    >
      <div
        className={`${neon.section} flex items-center gap-3 p-4 transition-all ${
          isCurrent ? 'border-[#ff9d00]/70 bg-[#ff9d00]/10' : ''
        }`}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          disabled={busy}
          className="flex min-h-[44px] min-w-[36px] shrink-0 cursor-grab touch-none items-center justify-center rounded-xl border border-[#ff9d00]/25 text-[#ff9d00]/70 transition hover:border-[#ff9d00]/50 hover:text-[#ffe066] active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={`Drag to reorder ${habit.name}`}
        >
          <IconGrip />
        </button>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[#ff9d00]/35 bg-black/40 text-2xl">
          {habit.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words font-semibold text-white [overflow-wrap:anywhere]">{habit.name}</p>
          {isCurrent ? <p className="text-xs text-[#ff9d00]/75">Editing now</p> : null}
        </div>
        {onEdit && !isCurrent ? (
          <button
            type="button"
            disabled={busy}
            onClick={onEdit}
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[#ff9d00]/30 text-[#ff9d00]/80 transition hover:border-[#ff9d00]/60 hover:text-[#ffe066] disabled:cursor-not-allowed disabled:opacity-35"
            aria-label={`Edit ${habit.name}`}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-red-400/40 text-red-300 transition hover:border-red-400/70 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={`Delete ${habit.name}`}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </li>
  );
}

export function SortableHabitList({
  habits,
  busy,
  currentHabitId,
  onReorder,
  onDelete,
  onEditHabit,
}: {
  habits: GritHabitTemplate[];
  busy?: boolean;
  currentHabitId?: string;
  onReorder: (habitIds: string[]) => Promise<void>;
  onDelete: (habit: GritHabitTemplate) => void;
  onEditHabit?: (habit: GritHabitTemplate) => void;
}) {
  const [items, setItems] = useState(habits);

  useEffect(() => {
    setItems(habits);
  }, [habits]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const nextItems = arrayMove(items, oldIndex, newIndex);
    const previousItems = items;
    setItems(nextItems);

    try {
      await onReorder(nextItems.map((item) => item.id));
    } catch {
      setItems(previousItems);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-3">
          {items.map((habit) => (
            <SortableHabitRow
              key={habit.id}
              habit={habit}
              busy={busy}
              isCurrent={habit.id === currentHabitId}
              onEdit={onEditHabit ? () => onEditHabit(habit) : undefined}
              onDelete={() => onDelete(habit)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
