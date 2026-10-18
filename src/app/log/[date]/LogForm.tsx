"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useOffline } from "next/offline";
import {
  backupKey,
  browserLocalStorage,
  clearLogBackup,
  parseLogBackup,
  readRawLogBackup,
  writeLogBackup,
} from "@/lib/logBackup";
import type { Exercise, WorkoutLog, WorkoutPlan } from "@/lib/types";
import type { PreviousPerformance } from "@/lib/queries";
import { describePersonalRecord, type PersonalRecord } from "@/lib/analyze/personalRecords";
import { saveLog, fetchPreviousPerformance, fetchPersonalRecords } from "./actions";
import { toSetType } from "@/lib/setData";
import ExerciseLogPanel, { countLoggedSets, setsFromPrevious, type ExerciseEntry, type SetRow } from "./ExerciseLogPanel";
import LogExercisePicker from "./LogExercisePicker";
import RestTimer, { type RestTimerHandle } from "./RestTimer";
import Icon from "@/components/Icon";
import ShareWorkoutButton from "@/components/ShareWorkoutButton";

type Props = {
  date: string;
  exercises: Exercise[];
  plan: WorkoutPlan | null;
  existingLog: WorkoutLog | null;
  initialPreviousPerformance: Record<string, PreviousPerformance | null>;
  // False when editing an already-logged historical day: the plan's current targets are not
  // shown, since they may have changed or been deleted since this workout was actually
  // performed (see HistoricalLogView). Defaults to true — today's/in-progress logging is
  // unaffected.
  showTargets?: boolean;
  // Signed-in user id. When set, unsynced edits are backed up on this device (per user and date)
  // so they survive the app closing before they reach the server — see lib/logBackup.ts.
  backupScope?: string | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DEBOUNCE_MS = 900;

// A new set carries the previous weight and unit forward, but is always a working set with no
// effort recorded — carrying "warm-up" into the next set would silently mislabel it.
function emptySet(carryForward?: SetRow): SetRow {
  return {
    reps: "",
    weight: carryForward?.weight ?? "",
    weightUnit: carryForward?.weightUnit ?? "kg",
    setType: "working",
    rpe: "",
  };
}

export type PlannedExerciseRef = { exerciseId: string; name: string };

// A planned exercise is "logged" once it has actual recorded content, not merely because it's
// present in `entries` — a plan with no existing log pre-seeds `entries` with every planned
// exercise (empty sets) before the user has touched anything, so entry membership alone would
// never show anything as outstanding. Marking a set done also counts, even with blank values,
// since that's an explicit user action on the exercise.
export function isExerciseEntryLogged(entry: ExerciseEntry): boolean {
  return entry.done || entry.sets.some((s) => s.reps.trim() !== "" || s.weight.trim() !== "");
}

// Purely descriptive set difference: which planned exercises have no corresponding logged
// content yet. Order-independent, tolerant of duplicate ids on either side, and silent about
// logged exercises that were never planned (those are never surfaced — see Phase 14 scope).
export function getUnloggedPlannedExercises(
  plannedExercises: PlannedExerciseRef[],
  loggedExerciseIds: string[]
): PlannedExerciseRef[] {
  const loggedSet = new Set(loggedExerciseIds);
  const seen = new Set<string>();
  const result: PlannedExerciseRef[] = [];
  for (const pe of plannedExercises) {
    if (loggedSet.has(pe.exerciseId) || seen.has(pe.exerciseId)) continue;
    seen.add(pe.exerciseId);
    result.push(pe);
  }
  return result;
}

export default function LogForm({
  date,
  exercises,
  plan,
  existingLog,
  initialPreviousPerformance,
  showTargets = true,
  backupScope = null,
}: Props) {
  const backupStorageKey = backupScope ? backupKey(backupScope, date) : null;
  const targetByExerciseId = new Map(
    showTargets
      ? plan?.planned_exercises?.map((pe) => [pe.exercise_id, { sets: pe.target_sets, reps: pe.target_reps }]) ?? []
      : []
  );

  // The persisted log always wins over the plan seed once it exists — reopening/resuming a
  // session must never quietly revert to the original plan and discard logged progress.
  const initialEntries: ExerciseEntry[] = existingLog?.logged_exercises?.length
    ? existingLog.logged_exercises.map((le) => ({
        exerciseId: le.exercise_id,
        name: le.exercise?.name ?? "Exercise",
        notes: le.notes ?? "",
        target: targetByExerciseId.get(le.exercise_id) ?? null,
        sets: le.logged_sets?.length
          ? le.logged_sets.map((s) => ({
              reps: s.reps?.toString() ?? "",
              weight: s.weight?.toString() ?? "",
              weightUnit: s.weight_unit,
              setType: toSetType(s.set_type),
              rpe: s.rpe === null || s.rpe === undefined ? "" : String(Number(s.rpe)),
              done: s.reps !== null || s.weight !== null,
            }))
          : [emptySet()],
        done: false,
      }))
    : plan?.planned_exercises?.map((pe) => ({
        exerciseId: pe.exercise_id,
        name: pe.exercise?.name ?? "Exercise",
        notes: "",
        target: showTargets ? { sets: pe.target_sets, reps: pe.target_reps } : null,
        sets: Array.from({ length: pe.target_sets ?? 3 }, () => emptySet()),
        done: false,
      })) ?? [];

  const [entries, setEntries] = useState<ExerciseEntry[]>(initialEntries);
  const [notes, setNotes] = useState(existingLog?.notes ?? "");
  const [workoutCompleted, setWorkoutCompleted] = useState(!!existingLog?.completed_at);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previousPerformance, setPreviousPerformance] =
    useState<Record<string, PreviousPerformance | null>>(initialPreviousPerformance);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  // Unsynced edits left on this device by an earlier visit (the app closed while offline, or
  // before a save finished), offered to the person rather than applied silently. Storage is
  // browser-only, so the server and hydration render see null. The offer lasts until they restore,
  // discard, or make any edit — an edit rewrites the backup with this visit's state, so from then on
  // the stored copy is no longer the earlier visit's.
  const rawBackup = useSyncExternalStore(
    noopSubscribe,
    () => (backupStorageKey ? readRawLogBackup(browserLocalStorage(), backupStorageKey) : null),
    () => null
  );
  const storedBackup = useMemo(() => parseLogBackup(rawBackup), [rawBackup]);
  const [backupHandled, setBackupHandled] = useState(false);
  const pendingBackup = backupHandled ? null : storedBackup;
  const [personalRecords, setPersonalRecords] = useState<Record<string, PersonalRecord[]>>({});
  // Only the newest lookup may update the records — an older response arriving late must not
  // overwrite a newer one.
  const recordsRequestRef = useRef(0);
  const restTimerRef = useRef<RestTimerHandle>(null);

  // Rest only applies to live logging, not to editing a past day (showTargets is false there).
  function startRest(entry: ExerciseEntry | undefined) {
    if (showTargets && entry) restTimerRef.current?.start(entry.exerciseId, entry.name);
  }

  // Always-current snapshot for the save routine to read. Updated synchronously by the
  // update* helpers below (never via a useEffect keyed on state) — an effect only runs after
  // React commits the render, which is too late for scheduleSave(true) called in the same
  // handler right after setState: it would read the previous, stale value.
  const stateRef = useRef({ entries, notes, workoutCompleted });

  function updateEntries(updater: (prev: ExerciseEntry[]) => ExerciseEntry[]) {
    const next = updater(stateRef.current.entries);
    stateRef.current = { ...stateRef.current, entries: next };
    setEntries(next);
    return next;
  }

  function updateNotesValue(value: string) {
    stateRef.current = { ...stateRef.current, notes: value };
    setNotes(value);
  }

  function updateCompleted(value: boolean) {
    stateRef.current = { ...stateRef.current, workoutCompleted: value };
    setWorkoutCompleted(value);
  }

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);
  // True whenever a real edit hasn't been confirmed persisted yet — lets the visibility/pagehide
  // flush skip doing any work at all when there's nothing to save (e.g. just viewing the page).
  const hasUnsavedRef = useRef(false);

  function backUpUnsyncedState() {
    if (!backupStorageKey) return;
    const { entries: e, notes: n, workoutCompleted: c } = stateRef.current;
    writeLogBackup(browserLocalStorage(), backupStorageKey, { entries: e, notes: n, workoutCompleted: c });
  }

  async function doSave() {
    if (savingRef.current) {
      dirtyRef.current = true;
      return;
    }
    savingRef.current = true;
    setSaveState("saving");
    setSaveError(null);

    const snapshot = stateRef.current;
    const exercisesPayload = snapshot.entries.map((e) => ({
      exerciseId: e.exerciseId,
      notes: e.notes,
      sets: e.sets.map((s) => ({
        reps: s.reps ? parseInt(s.reps, 10) : null,
        weight: s.weight ? parseFloat(s.weight) : null,
        weightUnit: s.weightUnit,
        setType: s.setType,
        rpe: s.rpe ? parseFloat(s.rpe) : null,
      })),
    }));
    // With experimental.useOffline, a save made offline waits and retries by itself once the
    // connection returns; anything that still rejects (e.g. a server crash) must not leave
    // savingRef stuck, or no later edit would ever be saved.
    let result: Awaited<ReturnType<typeof saveLog>>;
    try {
      result = await saveLog({
        date,
        planId: plan?.id ?? null,
        notes: snapshot.notes,
        completed: snapshot.workoutCompleted,
        exercises: exercisesPayload,
      });
    } catch {
      result = { error: "Couldn't save — your changes are kept on this device." };
    }

    savingRef.current = false;

    if (result.error) {
      setSaveState("error");
      setSaveError(result.error);
      return;
    }

    if (dirtyRef.current) {
      // Newer edits arrived while this request was in flight — persist those too, and only
      // report "Saved" once nothing newer is left to send.
      dirtyRef.current = false;
      void doSave();
      return;
    }
    hasUnsavedRef.current = false;
    setSaveState("saved");
    // Only drop the backup when no newer edit is still waiting on the debounce timer.
    if (backupStorageKey && !debounceTimer.current) clearLogBackup(browserLocalStorage(), backupStorageKey);
    void refreshPersonalRecords(exercisesPayload);
  }

  // Best-effort: a failed lookup returns {} and simply shows no records.
  async function refreshPersonalRecords(payload: Parameters<typeof fetchPersonalRecords>[1]) {
    const requestId = ++recordsRequestRef.current;
    const records = await fetchPersonalRecords(date, payload).catch(() => ({}));
    if (requestId === recordsRequestRef.current) setPersonalRecords(records);
  }

  // Every real edit routes through here (called directly from the mutation handlers below —
  // never from a generic effect watching state, which would also fire on mount/re-render and
  // double-fire under React Strict Mode's dev-only double-invoke).
  function scheduleSave(immediate: boolean) {
    hasUnsavedRef.current = true;
    setBackupHandled(true);
    backUpUnsyncedState();
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (immediate) {
      void doSave();
    } else {
      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null;
        void doSave();
      }, AUTOSAVE_DEBOUNCE_MS);
    }
  }

  // Flush on visibilitychange (phone lock, app switch, tab switch) — the page is still alive at
  // that point, just hidden, so the in-flight fetch has a real chance to complete. This is the
  // primary defense against losing an unsaved edit and is what the debounce window is backstopped
  // by. No-ops if nothing is actually unsaved, so merely backgrounding the tab never triggers a
  // redundant write.
  //
  // pagehide (actual tab close / navigation away) is best-effort only, not a guarantee: the
  // browser can abort an in-flight, non-keepalive fetch mid-unload, so this attempt may not
  // finish. It's kept as an opportunistic extra chance, not something the save model depends on —
  // visibilitychange already covers the cases that matter (lock/background), since a page is
  // reliably hidden before it can be closed.
  useEffect(() => {
    function flushIfHidden() {
      if (document.hidden && hasUnsavedRef.current) scheduleSave(true);
    }
    function bestEffortFlushOnUnload() {
      if (hasUnsavedRef.current) scheduleSave(true);
    }
    document.addEventListener("visibilitychange", flushIfHidden);
    window.addEventListener("pagehide", bestEffortFlushOnUnload);
    return () => {
      document.removeEventListener("visibilitychange", flushIfHidden);
      window.removeEventListener("pagehide", bestEffortFlushOnUnload);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function restoreBackup() {
    if (!pendingBackup) return;
    updateEntries(() => pendingBackup.entries);
    updateNotesValue(pendingBackup.notes);
    updateCompleted(pendingBackup.workoutCompleted);
    setCurrentIndex(0);
    setBackupHandled(true);
    scheduleSave(true);

    for (const e of pendingBackup.entries) {
      if (e.exerciseId in previousPerformance) continue;
      void fetchPreviousPerformance(e.exerciseId, date).then((prev) =>
        setPreviousPerformance((p) => ({ ...p, [e.exerciseId]: prev }))
      );
    }
  }

  function discardBackup() {
    // Handled means no edit has happened this visit, so the stored copy is still the earlier one.
    if (backupStorageKey) clearLogBackup(browserLocalStorage(), backupStorageKey);
    setBackupHandled(true);
  }

  function updateSet(index: number, field: keyof SetRow, value: string) {
    updateEntries((prev) =>
      prev.map((e, i) =>
        i === currentIndex
          ? { ...e, sets: e.sets.map((s, si) => (si === index ? { ...s, [field]: value } : s)) }
          : e
      )
    );
    scheduleSave(false);
  }

  function addSet() {
    updateEntries((prev) =>
      prev.map((e, i) =>
        i === currentIndex ? { ...e, sets: [...e.sets, emptySet(e.sets[e.sets.length - 1])] } : e
      )
    );
    scheduleSave(true);
  }

  // Ticking a set done starts the rest timer. The tick is on-screen only (never saved), so no save.
  function toggleSetDone(index: number) {
    const entry = stateRef.current.entries[currentIndex];
    const becomingDone = !entry?.sets[index]?.done;
    updateEntries((prev) =>
      prev.map((e, i) =>
        i === currentIndex
          ? { ...e, sets: e.sets.map((s, si) => (si === index ? { ...s, done: !s.done } : s)) }
          : e
      )
    );
    if (becomingDone) startRest(entry);
  }

  function removeSet(index: number) {
    updateEntries((prev) =>
      prev.map((e, i) => (i === currentIndex ? { ...e, sets: e.sets.filter((_, si) => si !== index) } : e))
    );
    scheduleSave(true);
  }

  function toggleDone() {
    const wasDone = entries[currentIndex]?.done;
    updateEntries((prev) => prev.map((e, i) => (i === currentIndex ? { ...e, done: !e.done } : e)));
    scheduleSave(true);
    if (!wasDone && currentIndex < entries.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }

  function updateExerciseNotes(value: string) {
    updateEntries((prev) => prev.map((e, i) => (i === currentIndex ? { ...e, notes: value } : e)));
    scheduleSave(false);
  }

  function copyPrevious() {
    const entry = stateRef.current.entries[currentIndex];
    if (!entry) return;
    const sets = setsFromPrevious(previousPerformance[entry.exerciseId]);
    if (sets.length === 0) return;
    updateEntries((prev) => prev.map((e, i) => (i === currentIndex ? { ...e, sets } : e)));
    scheduleSave(true);
  }

  function removeExercise(index: number) {
    updateEntries((prev) => prev.filter((_, i) => i !== index));
    setCurrentIndex((i) => Math.max(0, Math.min(i, entries.length - 2)));
    scheduleSave(true);
  }

  async function addExercise(exerciseId: string) {
    const ex = exercises.find((e) => e.id === exerciseId);
    if (!ex || entries.some((e) => e.exerciseId === exerciseId)) return;
    updateEntries((prev) => [
      ...prev,
      {
        exerciseId: ex.id,
        name: ex.name,
        notes: "",
        target: targetByExerciseId.get(exerciseId) ?? null,
        sets: [emptySet()],
        done: false,
      },
    ]);
    setCurrentIndex(entries.length);
    setPickerOpen(false);
    scheduleSave(true);

    if (!(exerciseId in previousPerformance)) {
      const prev = await fetchPreviousPerformance(exerciseId, date);
      setPreviousPerformance((p) => ({ ...p, [exerciseId]: prev }));
    }
  }

  function goTo(index: number) {
    if (hasUnsavedRef.current) scheduleSave(true);
    setCurrentIndex(index);
  }

  function updateNotes(value: string) {
    updateNotesValue(value);
    scheduleSave(false);
  }

  function finishWorkout() {
    updateCompleted(true);
    scheduleSave(true);
  }

  function reopenWorkout() {
    updateCompleted(false);
    scheduleSave(true);
  }

  const current = entries[currentIndex];
  const recordEntries = entries.filter((e) => personalRecords[e.exerciseId]?.length);
  const completedCount = entries.filter((e) => e.done).length;

  // Live-only: showTargets is false for HistoricalLogView's edit mode, where the plan may have
  // changed or been deleted since the workout actually happened — this feature must never present
  // a planned-vs-logged comparison as historical truth (workout_plans has no version history).
  const plannedExerciseRefs: PlannedExerciseRef[] = showTargets
    ? (plan?.planned_exercises ?? []).map((pe) => ({
        exerciseId: pe.exercise_id,
        name: pe.exercise?.name ?? "Exercise",
      }))
    : [];
  const loggedExerciseIds = entries.filter(isExerciseEntryLogged).map((e) => e.exerciseId);
  const unloggedPlanned = getUnloggedPlannedExercises(plannedExerciseRefs, loggedExerciseIds);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <SaveStatus state={saveState} error={saveError} onRetry={() => scheduleSave(true)} />

      {pendingBackup && (
        <div className="rounded-xl bg-accent/10 px-4 py-3" role="status">
          <p className="text-sm text-link">
            This device has changes to this workout from {formatBackupTime(pendingBackup.savedAt)} that
            didn&apos;t sync.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={restoreBackup}
              className="h-8 rounded-lg bg-accent px-3 text-xs font-semibold text-on-accent hover:bg-accent-hover"
            >
              Restore and sync
            </button>
            <button
              type="button"
              onClick={discardBackup}
              className="h-8 rounded-lg border border-separator px-3 text-xs font-semibold hover:bg-fill"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {recordEntries.length > 0 && (
        <section className="card flex gap-3 border-orange/30 bg-orange/5 px-4 py-3" role="status">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-orange/15 text-orange">
            <Icon name="progress" className="size-4" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              New personal record
              {recordEntries.length === 1 && personalRecords[recordEntries[0].exerciseId].length === 1 ? "" : "s"}
            </p>
            <ul className="mt-1 flex flex-col gap-1.5 text-sm">
              {recordEntries.map((e) => {
                const unit = e.sets[e.sets.length - 1]?.weightUnit ?? "kg";
                return (
                  <li key={e.exerciseId}>
                    <span className="font-medium">{e.name}</span>
                    <ul className="text-xs text-label-2">
                      {personalRecords[e.exerciseId].map((r) => (
                        <li key={r.kind}>{describePersonalRecord(r, unit)}</li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {unloggedPlanned.length > 0 && entries.length === 0 && (
        <p className="text-sm text-label-2">
          Planned: {unloggedPlanned.map((pe) => pe.name).join(", ")}
        </p>
      )}

      {entries.length > 0 && (
        <>
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
              <p className="text-sm font-medium">
                {completedCount} of {entries.length} exercise{entries.length === 1 ? "" : "s"} done
              </p>
              {workoutCompleted && (
                <span className="flex items-center gap-1 text-xs font-semibold text-green">
                  <Icon name="checkmark" className="size-3.5" strokeWidth={2.75} />
                  Workout finished
                </span>
              )}
            </div>
            <div className="mx-4 mb-2 h-1.5 overflow-hidden rounded-full bg-fill" aria-hidden>
              <div
                className="h-full rounded-full bg-green transition-[width] duration-300 ease-out"
                style={{ width: `${(completedCount / entries.length) * 100}%` }}
              />
            </div>
            <ol className="border-t border-separator p-1">
              {entries.map((e, i) => (
                <li key={e.exerciseId}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={i === currentIndex ? "step" : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                      i === currentIndex ? "bg-fill font-semibold text-label" : "text-label-2 hover:bg-fill"
                    }`}
                  >
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums ${
                        e.done
                          ? "bg-green text-white"
                          : i === currentIndex
                            ? "bg-accent text-on-accent"
                            : "border border-label-3 text-label-3"
                      }`}
                    >
                      {e.done ? <Icon name="checkmark" className="size-3" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{e.name}</span>
                    {e.done && <span className="text-xs font-normal text-label-3">{countLoggedSets(e.sets)} sets</span>}
                  </button>
                </li>
              ))}
            </ol>
            {unloggedPlanned.length > 0 && (
              <p className="border-t border-separator px-4 py-2 text-xs text-label-2">
                Planned, not logged yet: {unloggedPlanned.map((pe) => pe.name).join(", ")}
              </p>
            )}
          </section>
          {showTargets && (
            <RestTimer
              ref={restTimerRef}
              current={current ? { exerciseId: current.exerciseId, name: current.name } : null}
            />
          )}

          {current && (
            <ExerciseLogPanel
              entry={current}
              positionLabel={`Exercise ${currentIndex + 1} of ${entries.length}`}
              previous={previousPerformance[current.exerciseId]}
              onUpdateSet={updateSet}
              onAddSet={addSet}
              onRemoveSet={removeSet}
              onToggleDone={toggleDone}
              onRemoveExercise={() => removeExercise(currentIndex)}
              onCopyPrevious={copyPrevious}
              onUpdateNotes={updateExerciseNotes}
              onToggleSetDone={toggleSetDone}
            />
          )}

          {entries.length > 1 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => goTo(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className="flex h-10 flex-1 items-center justify-center gap-1 rounded-[10px] border border-separator text-sm font-medium hover:bg-fill disabled:opacity-40"
              >
                <Icon name="chevronLeft" className="size-4" strokeWidth={2.25} />
                Previous
              </button>
              <button
                type="button"
                onClick={() => goTo(Math.min(entries.length - 1, currentIndex + 1))}
                disabled={currentIndex === entries.length - 1}
                className="flex h-10 flex-1 items-center justify-center gap-1 rounded-[10px] border border-separator text-sm font-medium hover:bg-fill disabled:opacity-40"
              >
                Next exercise
                <Icon name="chevronRight" className="size-4" strokeWidth={2.25} />
              </button>
            </div>
          )}
        </>
      )}

      {entries.length === 0 && !pickerOpen && (
        <section className="card px-6 py-8 text-center">
          <h2 className="text-base font-semibold">No exercises yet</h2>
          <p className="mt-1 text-sm text-label-2">Add the first exercise you&apos;re doing, or plan this day first.</p>
        </section>
      )}

      {pickerOpen ? (
        <LogExercisePicker
          exercises={exercises}
          alreadyAdded={new Set(entries.map((e) => e.exerciseId))}
          onAdd={addExercise}
          onCancel={() => setPickerOpen(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-separator text-sm font-semibold text-link hover:bg-fill"
        >
          <Icon name="plus" className="size-4" strokeWidth={2.5} />
          Add exercise
        </button>
      )}

      <section className="card p-4">
        <label htmlFor="workout-notes" className="mb-1.5 block text-sm font-medium">
          Workout notes
        </label>
        <textarea
          id="workout-notes"
          value={notes}
          onChange={(e) => updateNotes(e.target.value)}
          placeholder="How did it feel?"
          rows={2}
          className="field w-full resize-none rounded-lg px-3 py-2 text-sm field-sizing-content"
        />
      </section>

      {workoutCompleted ? (
        <button
          type="button"
          onClick={reopenWorkout}
          className="h-12 rounded-[10px] border border-separator text-[15px] font-semibold hover:bg-fill"
        >
          Reopen workout
        </button>
      ) : (
        <button
          type="button"
          onClick={finishWorkout}
          className="h-12 rounded-[10px] bg-accent text-[15px] font-semibold text-on-accent hover:bg-accent-hover"
        >
          Finish workout
        </button>
      )}

      {/* The image is built from the saved log, so it's offered once the latest edit is saved. */}
      {workoutCompleted && showTargets && saveState !== "saving" && (
        <ShareWorkoutButton date={date} />
      )}
    </div>
  );
}

const noopSubscribe = () => () => {};

function formatBackupTime(savedAt: number): string {
  return new Date(savedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SaveStatus({
  state,
  error,
  onRetry,
}: {
  state: SaveState;
  error: string | null;
  onRetry: () => void;
}) {
  const offline = useOffline();
  if (state === "idle") return null;

  if (state === "error") {
    return (
      <div className="flex items-center justify-between rounded-lg bg-red/12 px-3 py-2">
        <p className="text-sm text-red">{error ?? "Couldn't save — your changes are kept here."}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-red/12 px-3 py-1 text-xs font-medium text-red"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <p className="text-xs text-label-2">
      {state === "saving"
        ? offline
          ? "Offline — kept on this device, will sync when you're back online"
          : "Saving…"
        : "Saved"}
    </p>
  );
}
