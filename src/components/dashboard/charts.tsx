import { formatMoney } from "@/lib/money";

/**
 * Dependency-free SVG charts.
 *
 * Rendered on the server from pre-aggregated data, so dashboard pages ship no
 * charting library to the browser and never expose raw table rows.
 */

export type SeriesPoint = { label: string; value: number };

export function BarChart({
  data,
  height = 180,
  formatValue = (value: number) => String(value),
  accessibleTitle,
}: {
  data: SeriesPoint[];
  height?: number;
  formatValue?: (value: number) => string;
  accessibleTitle: string;
}) {
  if (data.length === 0) {
    return <p className="muted py-8 text-center">No data for this period.</p>;
  }

  const max = Math.max(...data.map((point) => point.value), 1);
  const barWidth = 100 / data.length;

  return (
    <figure>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="h-44 w-full"
        role="img"
        aria-label={accessibleTitle}
      >
        {[0.25, 0.5, 0.75, 1].map((fraction) => (
          <line
            key={fraction}
            x1="0"
            x2="100"
            y1={height - height * fraction}
            y2={height - height * fraction}
            stroke="var(--color-line)"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {data.map((point, index) => {
          const barHeight = (point.value / max) * (height - 12);
          return (
            <rect
              key={point.label}
              x={index * barWidth + barWidth * 0.2}
              y={height - barHeight}
              width={barWidth * 0.6}
              height={Math.max(barHeight, 0.5)}
              fill="var(--color-brand-800)"
              rx="1"
            >
              <title>{`${point.label}: ${formatValue(point.value)}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex justify-between text-[0.625rem] text-brand-400">
        <span>{data[0]?.label}</span>
        <span>Peak {formatValue(max)}</span>
        <span>{data.at(-1)?.label}</span>
      </figcaption>
    </figure>
  );
}

export function SalesChart({ data }: { data: SeriesPoint[] }) {
  return <BarChart data={data} formatValue={(value) => formatMoney(value)} accessibleTitle="Daily sales" />;
}

/** Horizontal breakdown bars — used for status and payment-method splits. */
export function BreakdownList({
  data,
  formatValue = (value: number) => String(value),
}: {
  data: SeriesPoint[];
  formatValue?: (value: number) => string;
}) {
  const total = data.reduce((sum, point) => sum + point.value, 0) || 1;

  return (
    <ul className="space-y-2.5">
      {data.map((point) => {
        const percent = Math.round((point.value / total) * 100);
        return (
          <li key={point.label}>
            <div className="row-between text-xs">
              <span className="font-medium text-brand-700">{point.label}</span>
              <span className="tabular-nums text-brand-500">{formatValue(point.value)} · {percent}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
              <div className="h-full rounded-full bg-brand-800" style={{ width: `${percent}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
