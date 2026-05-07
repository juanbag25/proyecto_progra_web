'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';

interface SwipeableCardProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Pixels of horizontal travel required to trigger a swipe. Default 80. */
  threshold?: number;
  children: ReactNode;
  className?: string;
}

const DISMISS_TRAVEL = 600;
const DISMISS_OFFSET: Record<'left' | 'right', number> = {
  left: -DISMISS_TRAVEL,
  right: DISMISS_TRAVEL,
};
const DISMISS_MS = 250;
// Pixels of horizontal movement required before we capture the pointer.
// Below this we let the browser route events normally so taps on buttons,
// inputs, and links inside the card behave like ordinary clicks.
const CAPTURE_THRESHOLD = 6;
// Targets where a pointerdown should NEVER initiate a swipe. Without this,
// `setPointerCapture` on the card eats the click before it reaches the button.
const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, label, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [contenteditable="true"]';

export const SwipeableCard = forwardRef<HTMLDivElement, SwipeableCardProps>(function SwipeableCard(
  { onSwipeLeft, onSwipeRight, threshold = 80, children, className = '' },
  forwardedRef,
) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef(0);
  const dismissTimer = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dismissing, setDismissing] = useState<'left' | 'right' | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      cardRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [forwardedRef],
  );

  useEffect(
    () => () => {
      if (dismissTimer.current !== null) window.clearTimeout(dismissTimer.current);
    },
    [],
  );

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || dismissing) return;
    // Don't hijack interactions on form controls, links, or buttons inside
    // the card — those are first-class actions that need their own clicks.
    const target = e.target as Element | null;
    if (target?.closest?.(INTERACTIVE_SELECTOR)) return;
    startX.current = e.clientX;
    setDragging(true);
    // Pointer capture is deferred to handlePointerMove: capturing here would
    // route a stationary tap's pointerup elsewhere and swallow the click.
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const next = e.clientX - startX.current;
    if (
      !cardRef.current?.hasPointerCapture(e.pointerId) &&
      Math.abs(next) > CAPTURE_THRESHOLD
    ) {
      cardRef.current?.setPointerCapture(e.pointerId);
    }
    setDragX((prev) => (prev === next ? prev : next));
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    if (cardRef.current?.hasPointerCapture(e.pointerId)) {
      cardRef.current.releasePointerCapture(e.pointerId);
    }

    // Read the final delta straight off the event so the threshold check
    // doesn't see a stale `dragX` from before the last setState commit.
    const finalDx = e.clientX - startX.current;
    if (Math.abs(finalDx) > threshold) {
      const direction = finalDx > 0 ? 'right' : 'left';
      setDismissing(direction);
      dismissTimer.current = window.setTimeout(() => {
        if (direction === 'right') onSwipeRight?.();
        else onSwipeLeft?.();
        setDragX(0);
        setDismissing(null);
        dismissTimer.current = null;
      }, DISMISS_MS);
    } else {
      setDragX(0);
    }
  };

  const offset = dismissing ? DISMISS_OFFSET[dismissing] : dragX;
  const rotate = offset * 0.04;

  return (
    <div
      ref={setRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        transform: reducedMotion ? undefined : `translateX(${offset}px) rotate(${rotate}deg)`,
        transition: dragging ? 'none' : undefined,
        touchAction: 'pan-y',
      }}
      className={`select-none transition-transform duration-[250ms] ease-premium ${
        reducedMotion ? '' : 'cursor-grab active:cursor-grabbing'
      } ${className}`}
    >
      {children}
    </div>
  );
});
