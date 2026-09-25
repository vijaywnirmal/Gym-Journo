"use client";

import { useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore, type Ref } from "react";
import {
  adjustEndAt,
  ADJUST_STEP_SEC,
  browserStorage,
  DEFAULT_REST_SEC,
  formatClock,
  readRestSeconds,
  remainingSeconds,
  REST_PRESETS_SEC,
  writeRestSeconds,
} from "@/lib/restTimer";

export type RestTimerHandle = {
  // Starts (or restarts) a rest using that exercise's remembered duration.
  start: (exerciseId: string, exerciseName: string) => void;
};

type Running = { endAt: number; exerciseId: string; exerciseName: string };

type Props = {
  ref?: Ref<RestTimerHandle>;
  // The exercise on screen: the manual Start button and the presets apply to it.
  current: { exerciseId: string; name: string } | null;
};

const TICK_MS = 250;

const noopSubscribe = () => () => {};

// iOS only lets audio play once it's been unlocked by a user gesture, so the context is created
// (or resumed) inside the tap that starts the timer, and reused for the beep at zero.
function primeAudio(ctxRef: { current: AudioContext | null }) {
  try {
    const AudioCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    ctxRef.current ??= new AudioCtor();
    void ctxRef.current.resume();
  } catch {
    // No audio — vibration and the on-screen state still signal the end.
  }
}

function beep(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    for (const offset of [0, 0.3]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.2;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.15);
    }
  } catch {
    // Ignore — see primeAudio.
  }
}

export default function RestTimer({ ref, current }: Props) {
  const [running, setRunning] = useState<Running | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [presets, setPresets] = useState<Record<string, number>>({});
  const audioRef = useRef<AudioContext | null>(null);
  const alertedForRef = useRef<number | null>(null);
  // False during server render and hydration, so the stored preference (browser-only) never makes
  // the first client render differ from the server's.
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);

  function presetFor(exerciseId: string): number {
    if (!isClient) return DEFAULT_REST_SEC;
    return presets[exerciseId] ?? readRestSeconds(browserStorage(), exerciseId);
  }

  function start(exerciseId: string, exerciseName: string) {
    primeAudio(audioRef);
    const startedAt = Date.now();
    setNow(startedAt);
    setRunning({ endAt: startedAt + presetFor(exerciseId) * 1000, exerciseId, exerciseName });
  }

  useImperativeHandle(ref, () => ({ start }));

  const endAt = running?.endAt ?? null;
  useEffect(() => {
    if (endAt === null) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [endAt]);

  const remaining = running ? remainingSeconds(running.endAt, now) : null;
  const finished = remaining === 0;

  // Alert exactly once per rest (keyed by its end time, so +15s after finishing re-arms it).
  useEffect(() => {
    if (!finished || endAt === null || alertedForRef.current === endAt) return;
    alertedForRef.current = endAt;
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      // Unsupported — ignore.
    }
    beep(audioRef.current);
  }, [finished, endAt]);

  function adjust(deltaSec: number) {
    const t = Date.now();
    setNow(t);
    setRunning((r) => (r ? { ...r, endAt: adjustEndAt(Math.max(r.endAt, t), t, deltaSec) } : r));
  }

  function choosePreset(seconds: number) {
    if (!current) return;
    setPresets((p) => ({ ...p, [current.exerciseId]: seconds }));
    writeRestSeconds(browserStorage(), current.exerciseId, seconds);
  }

  const currentPreset = current ? presetFor(current.exerciseId) : null;

  if (!running) {
    if (!current) return null;
    return (
      <div className="flex items-center gap-2 rounded-xl border border-neutral-800 px-3 py-2">
        <span className="text-xs text-neutral-500">Rest</span>
        <div className="flex gap-1" role="group" aria-label={`Rest time for ${current.name}`}>
          {REST_PRESETS_SEC.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => choosePreset(s)}
              aria-pressed={currentPreset === s}
              className={`rounded-md px-2 py-1 text-xs ${
                currentPreset === s ? "bg-neutral-700 text-neutral-100" : "text-neutral-400"
              }`}
            >
              {formatClock(s)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => start(current.exerciseId, current.name)}
          className="ml-auto rounded-lg border border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-100"
        >
          Start rest
        </button>
      </div>
    );
  }

  return (
    <div
      className={`sticky top-2 z-20 flex items-center gap-2 rounded-xl border px-3 py-2 backdrop-blur ${
        finished ? "border-green-800 bg-green-950/80" : "border-sky-900 bg-neutral-950/90"
      }`}
      role="timer"
      aria-live={finished ? "assertive" : "off"}
    >
      <div className="min-w-0">
        <p className={`font-mono text-2xl font-semibold ${finished ? "text-green-400" : "text-sky-300"}`}>
          {finished ? "Go!" : formatClock(remaining ?? 0)}
        </p>
        <p className="truncate text-xs text-neutral-500">
          {finished ? "Rest over" : "Resting"} · {running.exerciseName}
        </p>
      </div>
      <div className="ml-auto flex gap-1">
        <button
          type="button"
          onClick={() => adjust(-ADJUST_STEP_SEC)}
          disabled={finished}
          className="rounded-lg border border-neutral-700 px-2 py-1.5 text-xs text-neutral-200 disabled:opacity-40"
        >
          −{ADJUST_STEP_SEC}s
        </button>
        <button
          type="button"
          onClick={() => adjust(ADJUST_STEP_SEC)}
          className="rounded-lg border border-neutral-700 px-2 py-1.5 text-xs text-neutral-200"
        >
          +{ADJUST_STEP_SEC}s
        </button>
        <button
          type="button"
          onClick={() => setRunning(null)}
          className="rounded-lg border border-neutral-700 px-2 py-1.5 text-xs text-neutral-200"
        >
          {finished ? "Dismiss" : "Skip"}
        </button>
      </div>
    </div>
  );
}
