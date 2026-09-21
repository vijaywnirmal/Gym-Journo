// Calendar's per-day status suffix. "Performed" (the day has recorded sets) and "completed" (the
// user explicitly marked the workout complete) are separate facts and are worded separately —
// never collapsed into a single "logged" label. A day can be performed but not completed, or
// completed with nothing recorded.
export function formatDayStatus(day: { performed: boolean; completed: boolean }): string {
  const parts: string[] = [];
  if (day.performed) parts.push("performed");
  if (day.completed) parts.push("completed ✓");
  return parts.length > 0 ? ` · ${parts.join(" · ")}` : "";
}
