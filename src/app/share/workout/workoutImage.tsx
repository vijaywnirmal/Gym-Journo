import { ImageResponse } from "next/og";
import { formatDate } from "@/lib/date";
import type { WorkoutSummary } from "@/lib/analyze/workoutSummary";

const WIDTH = 1080;
const HEIGHT = 1350;
const MAX_ROWS = 7;

// The share image layout (Satori: flexbox only, every multi-child element needs display: flex).
// No emoji: Satori would fetch emoji images from a CDN at render time, an avoidable dependency.
export function workoutImageResponse({
  date,
  title,
  summary,
  recordCount,
}: {
  date: string;
  title: string;
  summary: WorkoutSummary;
  recordCount: number;
}): ImageResponse {
  const rows = summary.exercises.slice(0, MAX_ROWS);
  const more = summary.exercises.length - rows.length;
  const volume = Math.round(summary.totalVolumeKg).toLocaleString("en-US");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0a0a0a",
          color: "#fafafa",
          padding: "80px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{ display: "flex", width: 72, height: 72, borderRadius: 18, background: "#f59e0b", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 700, color: "#0a0a0a" }}
          >
            GJ
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 30, color: "#a3a3a3" }}>{formatDate(date)}</div>
            <div style={{ fontSize: 52, fontWeight: 700 }}>{title}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 24, marginTop: 56 }}>
          {[
            [String(summary.exerciseCount), summary.exerciseCount === 1 ? "exercise" : "exercises"],
            [String(summary.workingSets), summary.workingSets === 1 ? "working set" : "working sets"],
            [`${volume} kg`, "volume"],
          ].map(([value, label]) => (
            <div
              key={label}
              style={{ display: "flex", flexDirection: "column", flex: 1, background: "#171717", borderRadius: 24, padding: "28px 28px" }}
            >
              <div style={{ fontSize: 48, fontWeight: 700 }}>{value}</div>
              <div style={{ fontSize: 26, color: "#a3a3a3" }}>{label}</div>
            </div>
          ))}
        </div>

        {recordCount > 0 && (
          <div
            style={{ display: "flex", marginTop: 32, padding: "22px 28px", borderRadius: 24, background: "#451a03", color: "#fcd34d", fontSize: 34, fontWeight: 700 }}
          >
            {`${recordCount} new personal record${recordCount === 1 ? "" : "s"}`}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", marginTop: 40, gap: 18 }}>
          {rows.map((ex) => (
            <div key={ex.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 34 }}>
              <div style={{ display: "flex", color: "#e5e5e5", maxWidth: 620 }}>{ex.name}</div>
              <div style={{ display: "flex", color: "#a3a3a3" }}>
                {ex.best
                  ? `${ex.best.weight} ${ex.best.unit} × ${ex.best.reps}`
                  : `${ex.workingSets} set${ex.workingSets === 1 ? "" : "s"}`}
              </div>
            </div>
          ))}
          {more > 0 && <div style={{ display: "flex", fontSize: 28, color: "#737373" }}>+{more} more</div>}
        </div>

        <div style={{ display: "flex", marginTop: "auto", fontSize: 28, color: "#737373" }}>Logged with Gym Journo</div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT, headers: { "Cache-Control": "private, no-store" } }
  );
}
