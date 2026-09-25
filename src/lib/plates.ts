// Plate calculator — which plates to load on each side of a barbell to reach a target weight.
// Pure. Greedy from heaviest plate down, which is exact for standard gym plate sets. When the
// target can't be made exactly, the closest load at or below it is returned with the leftover.

export const DEFAULT_BAR = { kg: 20, lb: 45 } as const;

export const STANDARD_PLATES = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
} as const;

export type PlateUnit = keyof typeof STANDARD_PLATES;

export type PlateLoad = {
  perSide: number[];
  // Total weight actually loaded (bar + both sides).
  loaded: number;
  // target - loaded; 0 when exact.
  remainder: number;
};

// Work in hundredths so 1.25 / 2.5 plates don't accumulate float error.
const SCALE = 100;
const toUnits = (n: number) => Math.round(n * SCALE);

export function isPlateUnit(unit: string): unit is PlateUnit {
  return unit === "kg" || unit === "lb";
}

// Null when there's nothing to compute: not a positive finite number, or no heavier than the bar.
export function calculatePlates(
  target: number,
  unit: PlateUnit,
  bar: number = DEFAULT_BAR[unit],
  plates: readonly number[] = STANDARD_PLATES[unit]
): PlateLoad | null {
  if (!Number.isFinite(target) || !Number.isFinite(bar) || target <= bar || bar < 0) return null;

  let perSideLeft = Math.floor((toUnits(target) - toUnits(bar)) / 2);
  const perSide: number[] = [];
  for (const plate of [...plates].sort((a, b) => b - a)) {
    const p = toUnits(plate);
    if (p <= 0) continue;
    while (perSideLeft >= p) {
      perSide.push(plate);
      perSideLeft -= p;
    }
  }
  const loadedUnits = toUnits(bar) + 2 * perSide.reduce((sum, p) => sum + toUnits(p), 0);
  return {
    perSide,
    loaded: loadedUnits / SCALE,
    remainder: (toUnits(target) - loadedUnits) / SCALE,
  };
}

// "20 + 10 + 2.5" per side, grouping repeats: "25 ×2 + 5".
export function formatPlates(perSide: number[]): string {
  const groups: { plate: number; count: number }[] = [];
  for (const plate of perSide) {
    const last = groups[groups.length - 1];
    if (last && last.plate === plate) last.count++;
    else groups.push({ plate, count: 1 });
  }
  return groups.map((g) => (g.count > 1 ? `${g.plate} ×${g.count}` : `${g.plate}`)).join(" + ");
}
