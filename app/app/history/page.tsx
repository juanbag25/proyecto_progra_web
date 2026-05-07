import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatARS, formatDate } from '@/lib/format';
import type { ShoppingListSummary } from '@/lib/optimizer/types';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface ItemCheckedRow {
  id: string;
  checked: boolean;
}
interface HistoryRow {
  id: string;
  week_start: string;
  created_at: string;
  feasible: boolean;
  summary_json: ShoppingListSummary;
  items: ItemCheckedRow[];
}

const PAGE_LIMIT = 24;

export default async function HistoryPage() {
  const user = await requireUser();
  const supabase = createClient();

  const { data, error } = await supabase
    .from('shopping_lists')
    .select(
      `id, week_start, created_at, feasible, summary_json,
       items:shopping_list_items(id, checked)`,
    )
    .eq('user_id', user.id)
    .order('week_start', { ascending: false })
    .limit(PAGE_LIMIT);

  if (error) {
    return <ErrorBox message={error.message} />;
  }

  const rows = (data as HistoryRow[] | null) ?? [];

  return (
    <div className="flex flex-col gap-8 py-2">
      <header className="flex flex-col gap-1">
        <span className="font-display text-[10px] font-semibold uppercase tracking-widest text-accent-cyan">
          Historial
        </span>
        <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Tus semanas
        </h1>
        <p className="font-sans text-sm text-white/65">
          Mirá lo que cocinó cada semana. Tocá una para ver el detalle.
        </p>
      </header>

      {rows.length === 0 ? <EmptyHistory /> : <HistoryList rows={rows} />}
    </div>
  );
}

function HistoryList({ rows }: { rows: HistoryRow[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const total = row.items?.length ?? 0;
        const checked = row.items?.filter((it) => it.checked).length ?? 0;
        const adherence = total > 0 ? Math.round((checked / total) * 100) : 0;
        const proteinPct = Math.round(row.summary_json.targets_match_pct.protein);

        return (
          <li key={row.id}>
            <Link
              href={`/app/list/${row.id}`}
              className="glass group block p-5 transition-all duration-300 ease-premium hover:border-white/15 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60"
            >
              <div className="flex items-center gap-4">
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg font-semibold tracking-tight text-white">
                      Semana del {formatDate(row.week_start)}
                    </h2>
                    {!row.feasible && (
                      <span className="rounded-full border border-warn-orange/30 bg-warn-orange/[0.08] px-2 py-0.5 font-display text-[9px] font-semibold uppercase tracking-widest text-warn-orange">
                        Parcial
                      </span>
                    )}
                  </div>
                  <p className="font-sans text-xs text-white/45">
                    Generada el {formatDate(row.created_at)}
                  </p>
                </div>
                <div className="hidden items-center gap-6 sm:flex">
                  <Stat
                    label="Costo"
                    value={formatARS(row.summary_json.total_cost)}
                  />
                  <Stat
                    label="Proteína"
                    value={`${proteinPct}%`}
                    accent="cyan"
                  />
                  <Stat
                    label="Comprado"
                    value={`${adherence}%`}
                    accent={adherence >= 80 ? 'mint' : undefined}
                  />
                </div>
                <span
                  className="font-display text-xl text-white/30 transition-transform duration-300 ease-premium group-hover:translate-x-1 group-hover:text-accent-cyan"
                  aria-hidden
                >
                  →
                </span>
              </div>
              {/* Mobile-only stat row — desktop uses the inline grid above. */}
              <div className="mt-4 grid grid-cols-3 gap-3 sm:hidden">
                <Stat
                  label="Costo"
                  value={formatARS(row.summary_json.total_cost)}
                />
                <Stat label="Proteína" value={`${proteinPct}%`} accent="cyan" />
                <Stat
                  label="Comprado"
                  value={`${adherence}%`}
                  accent={adherence >= 80 ? 'mint' : undefined}
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'cyan' | 'mint';
}) {
  const accentClass =
    accent === 'cyan'
      ? 'text-accent-cyan'
      : accent === 'mint'
        ? 'text-accent-mint'
        : 'text-white';
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-display text-[10px] font-semibold uppercase tracking-widest text-white/40">
        {label}
      </span>
      <span className={`tabular font-display text-base font-bold ${accentClass}`}>
        {value}
      </span>
    </div>
  );
}

function EmptyHistory() {
  return (
    <div className="mx-auto max-w-2xl py-12">
      <GlassCard
        variant="strong"
        className="flex flex-col items-center gap-6 p-10 text-center sm:p-12"
      >
        <h2 className="font-display text-3xl font-bold tracking-tight text-white">
          Todavía no hay nada acá.
        </h2>
        <p className="max-w-md font-sans text-base text-white/65">
          Tu historial empieza con la primera lista. Pasá por{' '}
          <span className="text-accent-cyan">Mi lista</span> y armá la de esta semana.
        </p>
        <Link href="/app/list">
          <Button variant="primary" size="lg">
            Ir a mi lista →
          </Button>
        </Link>
      </GlassCard>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-2xl py-20">
      <GlassCard
        variant="strong"
        className="flex flex-col items-center gap-4 border-warn-coral/30 p-10 text-center"
      >
        <h1 className="font-display text-2xl font-bold tracking-tight text-white">
          No pudimos leer tu historial.
        </h1>
        <p className="font-sans text-sm text-white/60">{message}</p>
      </GlassCard>
    </div>
  );
}
