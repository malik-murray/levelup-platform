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
import { formatDate } from '@/lib/habitHelpers';
import type { WeeklyTodoItem } from '@/lib/habit/weeklyPlanActions';

function IconGrip() {
    return (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <circle cx="9" cy="7" r="1.5" />
            <circle cx="15" cy="7" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="17" r="1.5" />
            <circle cx="15" cy="17" r="1.5" />
        </svg>
    );
}

function SortableWeeklyTodoRow({
    todo,
    weekDays,
    busy,
    onToggle,
    onAssignDay,
    onDelete,
}: {
    todo: WeeklyTodoItem;
    weekDays: Date[];
    busy?: boolean;
    onToggle: (todo: WeeklyTodoItem, completed: boolean) => void;
    onAssignDay: (todo: WeeklyTodoItem, date: string) => void;
    onDelete: (todo: WeeklyTodoItem) => void;
}) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
        useSortable({
            id: todo.id,
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
            className={`flex items-center gap-2 p-3 rounded border border-slate-700 bg-slate-900/50 min-h-[44px] ${
                isDragging ? 'relative z-10 opacity-90' : ''
            }`}
        >
            <button
                type="button"
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                disabled={busy}
                className="flex shrink-0 cursor-grab touch-none items-center justify-center rounded border border-slate-600 p-1.5 text-slate-400 transition hover:border-slate-500 hover:text-slate-200 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-35"
                aria-label={`Drag to reorder ${todo.title}`}
            >
                <IconGrip />
            </button>
            <input
                type="checkbox"
                checked={!!todo.is_done}
                onChange={(e) => onToggle(todo, e.target.checked)}
                disabled={busy}
                aria-label={`Mark ${todo.title} complete`}
                className="h-5 w-5 shrink-0 rounded border-slate-600 text-amber-500 focus:ring-amber-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="flex-1 min-w-0">
                <span
                    className={`font-medium block truncate ${todo.is_done ? 'line-through text-slate-500' : 'text-slate-200'}`}
                >
                    {todo.title}
                </span>
                {todo.assigned_date ? (
                    <span className="text-xs text-slate-400">
                        {new Date(todo.assigned_date + 'T12:00:00').toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                        })}
                    </span>
                ) : (
                    <span className="text-xs text-slate-500">Not scheduled</span>
                )}
            </div>
            <select
                value={todo.assigned_date ?? ''}
                onChange={(e) => onAssignDay(todo, e.target.value)}
                disabled={busy}
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs shrink-0 max-w-[120px]"
                aria-label={`Assign ${todo.title} to a day`}
            >
                <option value="">No day</option>
                {weekDays.map((d) => (
                    <option key={formatDate(d)} value={formatDate(d)}>
                        {d.toLocaleDateString('en-US', { weekday: 'short' })}
                    </option>
                ))}
            </select>
            <button
                type="button"
                onClick={() => onDelete(todo)}
                disabled={busy}
                className="text-red-400 hover:text-red-300 text-sm shrink-0 disabled:opacity-50"
            >
                Delete
            </button>
        </li>
    );
}

export default function SortableWeeklyTodoList({
    todos,
    weekDays,
    busy,
    onReorder,
    onToggle,
    onAssignDay,
    onDelete,
}: {
    todos: WeeklyTodoItem[];
    weekDays: Date[];
    busy?: boolean;
    onReorder: (itemIds: string[]) => Promise<void>;
    onToggle: (todo: WeeklyTodoItem, completed: boolean) => void;
    onAssignDay: (todo: WeeklyTodoItem, date: string) => void;
    onDelete: (todo: WeeklyTodoItem) => void;
}) {
    const [items, setItems] = useState(todos);

    useEffect(() => {
        setItems(todos);
    }, [todos]);

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

    if (items.length === 0) {
        return <p className="text-sm text-slate-500 text-center py-2">No weekly to-dos yet.</p>;
    }

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-2">
                    {items.map((todo) => (
                        <SortableWeeklyTodoRow
                            key={todo.id}
                            todo={todo}
                            weekDays={weekDays}
                            busy={busy}
                            onToggle={onToggle}
                            onAssignDay={onAssignDay}
                            onDelete={onDelete}
                        />
                    ))}
                </ul>
            </SortableContext>
        </DndContext>
    );
}
