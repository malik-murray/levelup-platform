'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';

const DELETE_WIDTH = 72;
const OPEN_THRESHOLD = 36;

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, button, select, a, [contenteditable="true"]'));
}

type SwipeToDeleteRowProps = {
  children: ReactNode;
  onDelete: () => void;
  deleteLabel?: string;
  className?: string;
};

export function SwipeToDeleteRow({
  children,
  onDelete,
  deleteLabel = 'Delete',
  className = '',
}: SwipeToDeleteRowProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startOffsetRef = useRef(0);
  const axisRef = useRef<'x' | 'y' | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  const clampOffset = (value: number) => Math.max(-DELETE_WIDTH, Math.min(0, value));

  const snapOffset = (value: number) => (value <= -OPEN_THRESHOLD ? -DELETE_WIDTH : 0);

  const resetSwipe = useCallback(() => {
    setOffset(0);
    setDragging(false);
    axisRef.current = null;
    pointerIdRef.current = null;
  }, []);

  const handleDelete = () => {
    resetSwipe();
    onDelete();
  };

  const beginPointer = (clientX: number, clientY: number, target: EventTarget | null) => {
    if (isInteractiveTarget(target)) return false;
    startXRef.current = clientX;
    startYRef.current = clientY;
    startOffsetRef.current = offset;
    axisRef.current = null;
    setDragging(true);
    return true;
  };

  const movePointer = (clientX: number, clientY: number) => {
    const deltaX = clientX - startXRef.current;
    const deltaY = clientY - startYRef.current;

    if (axisRef.current === null) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      axisRef.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
      if (axisRef.current === 'y') {
        setDragging(false);
        return;
      }
    }

    if (axisRef.current !== 'x') return;
    setOffset(clampOffset(startOffsetRef.current + deltaX));
  };

  const endPointer = () => {
    if (axisRef.current === 'x') {
      setOffset((current) => snapOffset(current));
    }
    setDragging(false);
    axisRef.current = null;
    pointerIdRef.current = null;
  };

  return (
    <div className={`relative overflow-hidden rounded-md ${className}`}>
      <div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ width: DELETE_WIDTH }}
        aria-hidden={offset === 0}
      >
        <button
          type="button"
          onClick={handleDelete}
          className="flex h-full w-full items-center justify-center bg-red-600 px-2 text-[11px] font-semibold uppercase tracking-wide text-white transition hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          aria-label={deleteLabel}
        >
          {deleteLabel}
        </button>
      </div>

      <div
        className={`relative bg-inherit ${dragging ? '' : 'transition-transform duration-200 ease-out motion-reduce:transition-none'}`}
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={(event) => {
          if (event.touches.length !== 1) return;
          beginPointer(event.touches[0].clientX, event.touches[0].clientY, event.target);
        }}
        onTouchMove={(event) => {
          if (event.touches.length !== 1 || !dragging) return;
          movePointer(event.touches[0].clientX, event.touches[0].clientY);
        }}
        onTouchEnd={endPointer}
        onTouchCancel={endPointer}
        onPointerDown={(event) => {
          if (event.pointerType === 'touch') return;
          if (pointerIdRef.current !== null) return;
          if (!beginPointer(event.clientX, event.clientY, event.target)) return;
          pointerIdRef.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (pointerIdRef.current !== event.pointerId) return;
          movePointer(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          if (pointerIdRef.current !== event.pointerId) return;
          event.currentTarget.releasePointerCapture(event.pointerId);
          endPointer();
        }}
        onPointerCancel={(event) => {
          if (pointerIdRef.current !== event.pointerId) return;
          endPointer();
        }}
      >
        {children}
      </div>
    </div>
  );
}
