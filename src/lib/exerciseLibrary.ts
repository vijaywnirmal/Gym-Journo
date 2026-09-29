import { z } from "zod";
import { EQUIPMENT_OPTIONS } from "./exerciseSearch";

// The exercise library API's contract (app/api/exercises), shared by the route handlers and the
// browser. Pure — no I/O — so both sides agree on shapes, limits and URLs.

export const EXERCISE_PAGE_SIZE = 10;
export const MAX_SEARCH_LENGTH = 100;

export type ExerciseListItem = {
  id: string;
  name: string;
  equipment: string | null;
  // One of the viewer's own custom exercises (they can delete it).
  isOwn: boolean;
  // Has instructions or demo images to show.
  hasTutorial: boolean;
};

export type ExercisePage = {
  items: ExerciseListItem[];
  // Opaque; pass back as `cursor` for the next page. Null on the last page.
  nextCursor: string | null;
};

export type MuscleGroupCount = { id: string; name: string; exerciseCount: number };

export type ExerciseTutorial = {
  id: string;
  name: string;
  equipment: string | null;
  muscleGroups: string[];
  steps: string[];
  demoImages: string[];
};

export type ExerciseFilters = { term?: string; equipment?: string | null };
export type ExerciseListParams = ExerciseFilters & { muscleGroupId?: string | null; cursor?: string | null };

const filterFields = {
  q: z.string().trim().max(MAX_SEARCH_LENGTH).optional(),
  equipment: z.enum(EQUIPMENT_OPTIONS).optional(),
};

export const exerciseGroupsQuerySchema = z.object(filterFields);

export const exerciseListQuerySchema = z.object({
  ...filterFields,
  muscleGroup: z.uuid().optional(),
  cursor: z.string().max(1000).optional(),
});

export const exerciseIdSchema = z.uuid();

// Keyset position: the last row's name and id (browse_exercises orders by both).
export type ExerciseCursor = { name: string; id: string };

const cursorSchema = z.object({ name: z.string().min(1).max(200), id: z.uuid() });

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function encodeCursor(cursor: ExerciseCursor): string {
  return toBase64Url(JSON.stringify([cursor.name, cursor.id]));
}

// Null for anything that isn't a cursor this API issued.
export function decodeCursor(value: string): ExerciseCursor | null {
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(value));
    if (!Array.isArray(parsed)) return null;
    const result = cursorSchema.safeParse({ name: parsed[0], id: parsed[1] });
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// Instructions are stored one step per line.
export function instructionSteps(instructions: string | null): string[] {
  return (instructions ?? "")
    .split("\n")
    .map((step) => step.trim())
    .filter(Boolean);
}

function withQuery(path: string, params: Record<string, string | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

export function exerciseGroupsUrl({ term, equipment }: ExerciseFilters): string {
  return withQuery("/api/exercises/groups", { q: term?.trim(), equipment });
}

export function exerciseListUrl({ term, equipment, muscleGroupId, cursor }: ExerciseListParams): string {
  return withQuery("/api/exercises", { q: term?.trim(), equipment, muscleGroup: muscleGroupId, cursor });
}

export function exerciseTutorialUrl(id: string): string {
  return `/api/exercises/${encodeURIComponent(id)}`;
}
