import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/format';

/**
 * Sticky-feeling notice on /app prompting the user to file weekly feedback.
 *
 * Pure presentation — the parent decides whether to render based on:
 *   1. There IS a most-recent shopping list, AND
 *   2. its `created_at` is ≥ 7 days ago, AND
 *   3. no `weekly_feedback` row exists for that list's `week_start` yet.
 *
 * Visual treatment is energetic-coral (the "action" tone in the brand)
 * because the value of closing the loop is high — leaving feedback unfiled
 * means next week's plan gets generated against stale weight + adherence.
 */

interface FeedbackBannerProps {
  /** ISO date of the list whose week the user is being asked to close. */
  weekStart: string;
  /** Days since the list was generated — surfaced in copy ("hace 9 días"). */
  daysSinceGenerated: number;
}

export function FeedbackBanner({ weekStart, daysSinceGenerated }: FeedbackBannerProps) {
  return (
    <div
      role="status"
      className="flex flex-col items-start gap-3 rounded-3xl border border-warn-coral/30 bg-warn-coral/[0.06] p-5 shadow-inset-hairline sm:flex-row sm:items-center sm:gap-5"
    >
      <span
        aria-hidden
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-warn-coral/15 text-base"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-warn-coral"
        >
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <h2 className="font-display text-base font-semibold tracking-tight text-white">
          Tu semana terminó — cerrala.
        </h2>
        <p className="font-sans text-sm text-white/70">
          La lista de la semana del {formatDate(weekStart)} ya tiene {daysSinceGenerated} días.
          Contanos cómo te fue y te armamos la próxima con tus números actualizados.
        </p>
      </div>
      <Link href="/app/feedback" className="self-stretch sm:self-center">
        <Button variant="primary" size="md" className="w-full sm:w-auto">
          Cerrá la semana →
        </Button>
      </Link>
    </div>
  );
}
