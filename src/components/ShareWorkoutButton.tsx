"use client";

import { useState } from "react";

// Shares a workout summary image through the device's share sheet, or downloads it where the Web
// Share API can't take files (most desktop browsers). The image is generated privately per request;
// there is no public link.
export default function ShareWorkoutButton({ date }: { date: string }) {
  const [state, setState] = useState<"idle" | "working" | "error">("idle");

  async function share() {
    setState("working");
    try {
      const response = await fetch(`/share/workout/${date}`, { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      const file = new File([blob], `workout-${date}.png`, { type: "image/png" });

      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "My workout" });
        } catch (e) {
          // Closing the share sheet isn't an error.
          if (!(e instanceof DOMException && e.name === "AbortError")) throw e;
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-1">
      <button
        type="button"
        onClick={share}
        disabled={state === "working"}
        className="rounded-xl border border-neutral-700 px-4 py-3 text-sm font-medium text-neutral-100 disabled:opacity-40"
      >
        {state === "working" ? "Preparing image…" : "📤 Share workout"}
      </button>
      {state === "error" && (
        <p className="text-center text-xs text-red-400">Couldn&apos;t create the image. Check your connection and try again.</p>
      )}
    </div>
  );
}
