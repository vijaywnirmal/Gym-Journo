// Pounds per kilogram — the single conversion factor shared by every place a weight crosses the
// kg/lb boundary (progress charts today; anywhere else that needs to compare weights recorded in
// different units).
const LB_PER_KG = 2.2046226218;

export function toKg(weight: number, unit: string): number {
  return unit === "lb" ? weight / LB_PER_KG : weight;
}

export function fromKg(weightKg: number, unit: string): number {
  return unit === "lb" ? weightKg * LB_PER_KG : weightKg;
}
