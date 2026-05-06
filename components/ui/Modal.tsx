'use client';

import { useId, type ReactNode } from 'react';
import { useDialog } from '@/lib/hooks/useDialog';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

// Built on native `<dialog>` so we inherit free focus-trap, ARIA, and
// top-layer stacking — Radix would be overkill for this surface.
export function Modal({ open, onClose, title, children }: ModalProps) {
  const { dialogRef, mounted, handleClick } = useDialog({ open, onClose, exitMs: 200 });
  const titleId = useId();

  return (
    <dialog
      ref={dialogRef}
      onClick={handleClick}
      aria-labelledby={title ? titleId : undefined}
      className="m-auto max-h-[90vh] w-[min(90vw,32rem)] border-0 bg-transparent p-0 text-white backdrop:bg-canvas-base/80 backdrop:backdrop-blur-glass"
    >
      <div
        className={`glass-strong p-8 transition-all duration-200 ease-premium motion-reduce:transition-none ${
          mounted ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        {title && (
          <h2
            id={titleId}
            className="mb-4 font-display text-2xl font-bold tracking-tight text-white"
          >
            {title}
          </h2>
        )}
        {children}
      </div>
    </dialog>
  );
}
