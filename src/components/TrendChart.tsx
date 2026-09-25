import { formatDate } from "@/lib/date";

// Dependency-free SVG line chart — the app has no charting library, and one point per session is
// simple enough not to need one.

export type TrendPoint = { date: string; value: number };

const WIDTH = 320;
const HEIGHT = 120;
const PADDING = 10;

export default function TrendChart({ points, unit }: { points: TrendPoint[]; unit: string }) {
  if (points.length === 0) {
    return <p className="text-sm text-neutral-500">Not enough data yet.</p>;
  }
  if (points.length === 1) {
    return (
      <p className="text-sm text-neutral-300">
        {points[0].value.toFixed(1)} {unit} on {formatDate(points[0].date)} — need at least two
        sessions for a trend.
      </p>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = points.map((p, i) => ({
    x: PADDING + (i / (points.length - 1)) * (WIDTH - PADDING * 2),
    y: HEIGHT - PADDING - ((p.value - min) / range) * (HEIGHT - PADDING * 2),
  }));

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Trend over ${points.length} sessions, from ${min.toFixed(1)} to ${max.toFixed(1)} ${unit}`}
      >
        <path d={path} fill="none" stroke="white" strokeWidth={2} />
        {coords.map((c, i) => (
          <circle key={points[i].date} cx={c.x} cy={c.y} r={2.5} fill="white" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-neutral-500">
        <span>{formatDate(points[0].date)}</span>
        <span>
          {max.toFixed(1)} {unit} peak
        </span>
        <span>{formatDate(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}
