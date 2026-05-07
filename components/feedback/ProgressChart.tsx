import { GlassCard } from '@/components/ui/GlassCard';
import { formatDate } from '@/lib/format';
import type { FitnessGoal } from '@/lib/nutrition/tdee';

/**
 * Hand-rolled SVG line chart of the user's weight log over time. No charting
 * dependency on purpose — the data is one series with at most a few dozen
 * points, and `recharts` would add ~80kb gzip just for this view.
 *
 * The chart shows:
 *   - the actual weight readings (cyan line + circle markers)
 *   - an "expected band" shaded in mint when a goal is supplied — a soft
 *     visual target so the user can see at a glance whether they're inside
 *     the healthy trajectory or drifting off it
 *
 * Bands per goal (kg/week, applied as a linear projection from the FIRST
 * reading forward):
 *   fat_loss:     −1.0 to −0.3 kg/week
 *   muscle_gain:  +0.2 to +0.5 kg/week
 *   strength:     0    to +0.2 kg/week
 *   recomp:       −0.2 to +0.2 kg/week
 *   maintenance:  −0.3 to +0.3 kg/week
 *
 * `points` must be sorted oldest-first by `logged_at`. Empty / single-point
 * series render an empty-state instead of a degenerate chart.
 */

export interface WeightPoint {
  /** YYYY-MM-DD */
  logged_at: string;
  weight_kg: number;
}

interface ProgressChartProps {
  points: WeightPoint[];
  goal?: FitnessGoal | null;
  /** Optional title override. Defaults to "Tu progreso". */
  title?: string;
}

const VIEWBOX_WIDTH = 600;
const VIEWBOX_HEIGHT = 240;
const PADDING = { top: 24, right: 16, bottom: 32, left: 44 };

const GOAL_BANDS: Record<FitnessGoal, { lower: number; upper: number }> = {
  fat_loss: { lower: -1.0, upper: -0.3 },
  muscle_gain: { lower: 0.2, upper: 0.5 },
  strength: { lower: 0, upper: 0.2 },
  recomp: { lower: -0.2, upper: 0.2 },
  maintenance: { lower: -0.3, upper: 0.3 },
};

export function ProgressChart({ points, goal, title = 'Tu progreso' }: ProgressChartProps) {
  if (points.length === 0) {
    return (
      <ChartFrame title={title}>
        <EmptyState message="Cuando registres tu primer peso semanal, esto se va a llenar de progreso." />
      </ChartFrame>
    );
  }

  if (points.length === 1) {
    const only = points[0];
    return (
      <ChartFrame title={title}>
        <EmptyState
          message={`Tenés un solo registro: ${only.weight_kg} kg el ${formatDate(only.logged_at)}. Cargá uno más la próxima semana y empieza el gráfico.`}
        />
      </ChartFrame>
    );
  }

  // Time + weight scales. Day-zero is the first reading; dayN the last.
  const t0 = isoToDayNumber(points[0].logged_at);
  const tN = isoToDayNumber(points[points.length - 1].logged_at);
  const tSpan = Math.max(tN - t0, 1);

  const weights = points.map((p) => p.weight_kg);

  // Y-axis bounds. We extend a little past the actual min/max so points
  // don't sit flush against the top/bottom edges. If the goal has a band,
  // we widen the axis to include the projected band so the band is fully
  // visible even when the user is way off course.
  const dataMin = Math.min(...weights);
  const dataMax = Math.max(...weights);
  let yMin = dataMin;
  let yMax = dataMax;
  if (goal) {
    const band = GOAL_BANDS[goal];
    const projectedLower = points[0].weight_kg + (band.lower * tSpan) / 7;
    const projectedUpper = points[0].weight_kg + (band.upper * tSpan) / 7;
    yMin = Math.min(yMin, projectedLower, projectedUpper);
    yMax = Math.max(yMax, projectedLower, projectedUpper);
  }
  // Pad ±1kg or 5% of range, whichever is larger — keeps very stable
  // weeks (1kg total range) readable.
  const range = Math.max(yMax - yMin, 0.5);
  const padY = Math.max(1, range * 0.1);
  yMin -= padY;
  yMax += padY;
  const ySpan = yMax - yMin;

  const chartWidth = VIEWBOX_WIDTH - PADDING.left - PADDING.right;
  const chartHeight = VIEWBOX_HEIGHT - PADDING.top - PADDING.bottom;

  const xFor = (day: number) =>
    PADDING.left + ((day - t0) / tSpan) * chartWidth;
  const yFor = (weight: number) =>
    PADDING.top + chartHeight - ((weight - yMin) / ySpan) * chartHeight;

  // Path string for the line. Round to 1 decimal so the SVG file isn't
  // bloated with float noise.
  const pathD = points
    .map((p, i) => {
      const cmd = i === 0 ? 'M' : 'L';
      const x = xFor(isoToDayNumber(p.logged_at)).toFixed(1);
      const y = yFor(p.weight_kg).toFixed(1);
      return `${cmd}${x},${y}`;
    })
    .join(' ');

  // Goal band — two horizontal-ish lines projected from the starting weight.
  let bandPathD: string | null = null;
  if (goal) {
    const band = GOAL_BANDS[goal];
    const startW = points[0].weight_kg;
    const upperStart = yFor(startW + (band.upper * 0) / 7);
    const upperEnd = yFor(startW + (band.upper * tSpan) / 7);
    const lowerStart = yFor(startW + (band.lower * 0) / 7);
    const lowerEnd = yFor(startW + (band.lower * tSpan) / 7);
    bandPathD = `M${PADDING.left},${upperStart} L${PADDING.left + chartWidth},${upperEnd} L${PADDING.left + chartWidth},${lowerEnd} L${PADDING.left},${lowerStart} Z`;
  }

  // Y-axis ticks — 4 evenly spaced.
  const ticks = makeTicks(yMin, yMax, 4);

  // First & last x-axis labels — keep clean, no overlapping middle ticks.
  const firstLabel = formatDate(points[0].logged_at);
  const lastLabel = formatDate(points[points.length - 1].logged_at);

  const trend = computeTrend(points);

  return (
    <ChartFrame title={title} subtitle={trend ? renderTrend(trend) : undefined}>
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-64 w-full"
        role="img"
        aria-label={`Gráfico de peso, ${points.length} puntos del ${firstLabel} al ${lastLabel}`}
      >
        {/* Gridlines */}
        {ticks.map((t) => (
          <line
            key={`grid-${t}`}
            x1={PADDING.left}
            x2={PADDING.left + chartWidth}
            y1={yFor(t)}
            y2={yFor(t)}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
        ))}

        {/* Goal band */}
        {bandPathD && (
          <path d={bandPathD} fill="rgba(0,230,118,0.1)" stroke="rgba(0,230,118,0.25)" strokeWidth="1" />
        )}

        {/* Y-axis labels */}
        {ticks.map((t) => (
          <text
            key={`label-${t}`}
            x={PADDING.left - 8}
            y={yFor(t)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-white/40 font-display text-[10px]"
          >
            {t.toFixed(1)}
          </text>
        ))}

        {/* X-axis labels — first + last */}
        <text
          x={PADDING.left}
          y={VIEWBOX_HEIGHT - 8}
          textAnchor="start"
          className="fill-white/40 font-display text-[10px]"
        >
          {firstLabel}
        </text>
        <text
          x={PADDING.left + chartWidth}
          y={VIEWBOX_HEIGHT - 8}
          textAnchor="end"
          className="fill-white/40 font-display text-[10px]"
        >
          {lastLabel}
        </text>

        {/* The line */}
        <path
          d={pathD}
          fill="none"
          stroke="#00F0FF"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Point markers */}
        {points.map((p) => {
          const cx = xFor(isoToDayNumber(p.logged_at));
          const cy = yFor(p.weight_kg);
          return (
            <g key={p.logged_at}>
              <circle cx={cx} cy={cy} r="4" fill="#0A0F1A" stroke="#00F0FF" strokeWidth="2" />
              <title>
                {formatDate(p.logged_at)} · {p.weight_kg} kg
              </title>
            </g>
          );
        })}
      </svg>

      {goal && (
        <p className="-mt-1 px-1 font-sans text-[11px] text-white/45">
          La banda{' '}
          <span className="rounded bg-accent-mint/20 px-1.5 py-0.5 text-accent-mint">verde</span> es
          el rango esperado para tu objetivo. La línea cyan, tus mediciones reales.
        </p>
      )}
    </ChartFrame>
  );
}

function ChartFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <GlassCard variant="default" className="flex flex-col gap-4 p-6">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold tracking-tight text-white">{title}</h2>
        {subtitle && <div className="text-right">{subtitle}</div>}
      </header>
      {children}
    </GlassCard>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-xl border border-hairline bg-white/[0.02] px-6 text-center">
      <p className="font-sans text-sm text-white/55">{message}</p>
    </div>
  );
}

interface Trend {
  delta_kg: number;
  /** Span between first and last point, in days. Always >0 here. */
  days: number;
}

function computeTrend(points: WeightPoint[]): Trend | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const days = Math.max(1, isoToDayNumber(last.logged_at) - isoToDayNumber(first.logged_at));
  return { delta_kg: round1(last.weight_kg - first.weight_kg), days };
}

function renderTrend(trend: Trend): React.ReactNode {
  const sign = trend.delta_kg > 0 ? '+' : '';
  const tone =
    trend.delta_kg > 0.1 ? 'text-warn-coral' : trend.delta_kg < -0.1 ? 'text-accent-mint' : 'text-white/55';
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={`tabular font-display text-base font-semibold ${tone}`}>
        {sign}
        {trend.delta_kg} kg
      </span>
      <span className="font-display text-[10px] uppercase tracking-widest text-white/40">
        en {trend.days} días
      </span>
    </div>
  );
}

/** Days since 1970-01-01 (UTC). Stable for arithmetic between dates. */
function isoToDayNumber(iso: string): number {
  return Math.round(Date.parse(`${iso}T00:00:00Z`) / (1000 * 60 * 60 * 24));
}

function makeTicks(min: number, max: number, count: number): number[] {
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => round1(min + step * i));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
