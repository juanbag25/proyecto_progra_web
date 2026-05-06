'use client';

import { useId, type ReactNode } from 'react';
import { useDialog } from '@/lib/hooks/useDialog';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

// Drag-to-dismiss is intentionally deferred to v2 — ESC + click-outside
// (handled by useDialog) cover the basics for mobile forms and filters.
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const { dialogRef, mounted, handleClick } = useDialog({ open, onClose, exitMs: 250 });
  const titleId = useId();

  return (
    <dialog
      ref={dialogRef}
      onClick={handleClick}
      aria-labelledby={title ? titleId : undefined}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90vh] w-full max-w-none border-0 bg-transparent p-0 text-white backdrop:bg-canvas-base/80 backdrop:backdrop-blur-glass"
    >
      <div
        className={`glass-strong w-full !rounded-b-none p-8 transition-transform duration-[250ms] ease-premium motion-reduce:transition-none sm:mx-auto sm:max-w-2xl ${
          mounted ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
        {title && (
          <h2
            id={titleId}
            className="mb-4 font-display text-xl font-bold tracking-tight text-white"
          >
            {title}
          </h2>
        )}
        {children}
      </div>
    </dialog>
  );
}
