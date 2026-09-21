import type { TrainingEvidence } from "@/lib/analyze/evidence";
import type { CoachReply } from "./contract";
import { evidenceSections } from "./validate";

// Human labels for the evidence section ids a reply cites — what the person sees as "Based on".
export function citationLabels(evidence: TrainingEvidence): Map<string, string> {
  const labels = new Map<string, string>();
  for (const id of evidenceSections(evidence).keys()) {
    if (id === "goal") labels.set(id, "Goal settings");
    else if (id === "training.recent") labels.set(id, "Recent training");
    else if (id === "training.weekly") labels.set(id, "Weekly training");
    else if (id === "body.weight") labels.set(id, "Body weight");
  }
  for (const exercise of evidence.exercises) labels.set(exercise.id, exercise.name);
  return labels;
}

export type CoachSource = { id: string; label: string };

// The distinct sections a reply's statements cite, in order of first use, with their labels.
export function replySources(reply: CoachReply, evidence: TrainingEvidence): CoachSource[] {
  const labels = citationLabels(evidence);
  const ids = [...new Set(reply.statements.flatMap((s) => s.cites))];
  return ids.flatMap((id) => (labels.has(id) ? [{ id, label: labels.get(id)! }] : []));
}

// True when there is nothing to explain: no recent workout days, no exercises, no weight records.
// Lets Coach answer plainly without spending a model call.
export function evidenceIsEmpty(evidence: TrainingEvidence): boolean {
  const anyRecentDays = evidence.training.recent.rolling.some((w) => w.daysPerformed > 0);
  const anyWeeklyDays = evidence.training.weekly.sourceDates.length > 0;
  return (
    !anyRecentDays &&
    !anyWeeklyDays &&
    evidence.training.recent.lastPerformedWorkoutDate === null &&
    evidence.exercises.length === 0 &&
    evidence.bodyWeight === null
  );
}
