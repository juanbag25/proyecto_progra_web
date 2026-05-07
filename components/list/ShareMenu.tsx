'use client';

import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import {
  serializeListAsPlainText,
  type SerializeItem,
  type SerializeOptions,
  type SerializeSummary,
} from '@/lib/list/serialize';

interface ShareMenuProps {
  open: boolean;
  onClose: () => void;
  /** Same flat shape used by the plain-text serializer. */
  items: SerializeItem[];
  summary: SerializeSummary;
  options: SerializeOptions;
}

/**
 * Bottom sheet with three export actions:
 *   - Compartir: Web Share API on mobile (system share sheet), clipboard
 *     fallback on desktop where navigator.share() is undefined.
 *   - Copiar: clipboard regardless of platform.
 *   - Imprimir: window.print() — the print stylesheet in globals.css strips
 *     the dark canvas and chrome so the output is a clean B/W checklist.
 *
 * Each action closes the sheet on success so the user gets back to the
 * list. Errors keep the sheet open and surface a toast — usually means
 * the user denied a permission (clipboard) or cancelled the share dialog.
 */
export function ShareMenu({ open, onClose, items, summary, options }: ShareMenuProps) {
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  function buildPlainText(): string {
    return serializeListAsPlainText(items, summary, options);
  }

  async function handleShare() {
    setBusy(true);
    const text = buildPlainText();
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: 'FitList — Mi lista de la semana', text });
        onClose();
      } else {
        // Desktop / unsupported browsers: clipboard is the closest fit.
        await navigator.clipboard.writeText(text);
        show({ message: 'Lista copiada al portapapeles.', variant: 'success' });
        onClose();
      }
    } catch (err) {
      // AbortError fires when the user cancels the native share — silent.
      const name = err instanceof Error ? err.name : '';
      if (name !== 'AbortError') {
        show({ message: 'No pudimos compartir la lista.', variant: 'error' });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    setBusy(true);
    const text = buildPlainText();
    try {
      await navigator.clipboard.writeText(text);
      show({ message: 'Lista copiada al portapapeles.', variant: 'success' });
      onClose();
    } catch {
      show({
        message: 'No pudimos copiar al portapapeles. Probá compartir.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  function handlePrint() {
    onClose();
    // Defer to the next tick so the sheet's exit animation can finish
    // before the print dialog steals focus and freezes the page.
    window.setTimeout(() => window.print(), 280);
  }

  return (
    <Sheet open={open} onClose={onClose} title="Compartir tu lista">
      <p className="mb-6 font-sans text-sm text-white/60">
        Mandala por WhatsApp, copiala como texto o imprimila para llevarla al super.
      </p>
      <div className="flex flex-col gap-3">
        <ShareOption
          label="Compartir"
          hint="Abrí el menú nativo de tu sistema."
          onClick={handleShare}
          disabled={busy}
          variant="primary"
        />
        <ShareOption
          label="Copiar como texto"
          hint="Lista plana, lista para pegar."
          onClick={handleCopy}
          disabled={busy}
        />
        <ShareOption
          label="Imprimir"
          hint="Versión limpia en blanco y negro."
          onClick={handlePrint}
          disabled={busy}
        />
      </div>
    </Sheet>
  );
}

interface ShareOptionProps {
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'default';
}

function ShareOption({
  label,
  hint,
  onClick,
  disabled = false,
  variant = 'default',
}: ShareOptionProps) {
  const surface =
    variant === 'primary'
      ? 'border-accent-cyan/40 bg-accent-cyan/[0.06] hover:border-accent-cyan/70 hover:bg-accent-cyan/[0.10] hover:shadow-glow-cyan'
      : 'border-hairline bg-glass hover:border-white/15 hover:bg-white/[0.06]';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group flex flex-col items-start gap-1 rounded-2xl border px-5 py-4 text-left transition-all duration-300 ease-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60 disabled:pointer-events-none disabled:opacity-40 ${surface}`}
    >
      <span className="font-display text-base font-semibold tracking-tight text-white">
        {label}
      </span>
      <span className="font-sans text-xs text-white/55">{hint}</span>
    </button>
  );
}
