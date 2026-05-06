'use client';

import { useEffect, useRef, useState, type MouseEvent, type RefObject } from 'react';

interface UseDialogOptions {
  open: boolean;
  onClose: () => void;
  /** Time the parent's exit animation runs before the dialog is closed. */
  exitMs: number;
}

interface UseDialogReturn {
  dialogRef: RefObject<HTMLDialogElement>;
  mounted: boolean;
  handleClick: (e: MouseEvent<HTMLDialogElement>) => void;
}

export function useDialog({ open, onClose, exitMs }: UseDialogOptions): UseDialogReturn {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      const raf = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(raf);
    }
    setMounted(false);
    const timer = window.setTimeout(() => {
      if (dialog.open) dialog.close();
    }, exitMs);
    return () => window.clearTimeout(timer);
  }, [open, exitMs]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  const handleClick = (e: MouseEvent<HTMLDialogElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const inside =
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom &&
      e.clientX >= rect.left &&
      e.clientX <= rect.right;
    if (!inside) onClose();
  };

  return { dialogRef, mounted, handleClick };
}
