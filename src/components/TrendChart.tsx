import { useId } from "react";
import { formatDate } from "@/lib/date";

// Dependency-free SVG line chart — the app has no charting library, and one point per session is
// simple enough not to need one. Drawn in the accent color so it follows the theme.

export type TrendPoint = { date: string; value: number };

const WIDTH = 320;
const HEIGHT = 120;
const PAD_X = 6;
const PAD_Y = 12;

// One format for every number on the chart: thousands separators, at most one decimal.
function fmt(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export default function TrendChart({ points, unit }: { points: TrendPoint[]; unit: string }) {
  const gradientId = useId();

  if (points.length === 0) {
    return <p className="text-sm text-label-2">Not enough data yet.</p>;
  }
  if (points.length === 1) {
    return (
      <p className="text-sm text-label-2">
        <span className="font-medium text-label">
          {fmt(points[0].value)} {unit}
        </span>{" "}
        on {formatDate(points[0].date)}. A trend appears after your second session.
      </p>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const first = values[0];
  const last = values[values.length - 1];
  const change = last - first;

  const coords = points.map((p, i) => ({
    x: PAD_X + (i / (points.length - 1)) * (WIDTH - PAD_X * 2),
    y: HEIGHT - PAD_Y - ((p.value - min) / range) * (HEIGHT - PAD_Y * 2),
  }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1].x.toFixed(1)},${HEIGHT} L${coords[0].x.toFixed(1)},${HEIGHT} Z`;
  const end = coords[coords.length - 1];

  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">
          {fmt(last)} <span className="text-sm font-medium text-label-2">{unit}</span>
        </span>
        <span className={`text-sm font-medium tabular-nums ${change > 0 ? "text-green" : change < 0 ? "text-red" : "text-label-3"}`}>
          {change > 0 ? "+" : ""}
          {fmt(change)} since {formatDate(points[0].date)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full overflow-visible text-accent"
        role="img"
        aria-label={`Trend over ${points.length} sessions: ${fmt(first)} to ${fmt(last)} ${unit} (${
          change > 0 ? "up" : change < 0 ? "down" : "no change"
        }), ranging ${fmt(min)}–${fmt(max)} ${unit}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        <line x1={0} x2={WIDTH} y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} stroke="var(--separator)" />
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.length <= 24 &&
          coords.map((c, i) => (
            <circle key={points[i].date} cx={c.x} cy={c.y} r={2.25} fill="var(--surface)" stroke="currentColor" strokeWidth={1.5} />
          ))}
        <circle cx={end.x} cy={end.y} r={4} fill="currentColor" />
      </svg>
      <div className="mt-1.5 flex justify-between text-xs text-label-3">
        <span>{formatDate(points[0].date)}</span>
        <span>
          Low {fmt(min)} · Peak {fmt(max)} {unit}
        </span>
        <span>{formatDate(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}
