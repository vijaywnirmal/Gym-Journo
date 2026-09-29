"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  exerciseGroupsUrl,
  exerciseListUrl,
  exerciseTutorialUrl,
  type ExerciseFilters,
  type ExerciseListItem,
  type ExercisePage,
  type ExerciseTutorial,
  type MuscleGroupCount,
} from "@/lib/exerciseLibrary";

// Data hooks for the exercise library API (app/api/exercises). Each request is cancelled when its
// component unmounts or its inputs change, so a slow response can never overwrite a newer one.
// Components are keyed by their inputs (see ExerciseLibraryBrowser), so each hook instance fetches
// for one fixed set of parameters.

export type LoadStatus = "loading" | "ready" | "error";

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  return (await response.json()) as T;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// Muscle groups with how many exercises in each match the filters. Changing `version` reloads them
// while the previous counts stay on screen.
export function useExerciseGroups(filters: ExerciseFilters, version = 0) {
  const url = exerciseGroupsUrl(filters);
  const [state, setState] = useState<{ url: string; groups: MuscleGroupCount[] | null; status: LoadStatus }>({
    url,
    groups: null,
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();
    fetchJson<MuscleGroupCount[]>(url, controller.signal)
      .then((groups) => setState({ url, groups, status: "ready" }))
      .catch((error) => {
        if (!isAbort(error)) setState({ url, groups: null, status: "error" });
      });
    return () => controller.abort();
  }, [url, version]);

  // Until the response for the current filters arrives, show the previous groups as still loading.
  return state.url === url ? state : { ...state, status: "loading" as const };
}

// Pages of exercises for one set of list parameters: the first page loads on mount, loadMore()
// appends the next one.
export function useExercisePages(params: ExerciseFilters & { muscleGroupId?: string | null }) {
  const [items, setItems] = useState<ExerciseListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const controllerRef = useRef<AbortController | null>(null);
  const firstPageUrl = exerciseListUrl(params);
  const nextPageUrl = nextCursor ? exerciseListUrl({ ...params, cursor: nextCursor }) : null;

  // Fetches one page; the caller has already put the list in its loading state.
  const fetchPage = useCallback((url: string, append: boolean) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    fetchJson<ExercisePage>(url, controller.signal)
      .then((page) => {
        setItems((previous) => (append ? [...previous, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
        setStatus("ready");
      })
      .catch((error) => {
        if (!isAbort(error)) setStatus("error");
      });
  }, []);

  useEffect(() => {
    fetchPage(firstPageUrl, false);
    return () => controllerRef.current?.abort();
  }, [firstPageUrl, fetchPage]);

  const loadMore = useCallback(() => {
    if (!nextPageUrl || status === "loading") return;
    setStatus("loading");
    fetchPage(nextPageUrl, true);
  }, [fetchPage, nextPageUrl, status]);

  // After a failed "load more", retry that page; after a failed first page, retry the first page.
  const retry = useCallback(() => {
    setStatus("loading");
    if (items.length > 0 && nextPageUrl) fetchPage(nextPageUrl, true);
    else fetchPage(firstPageUrl, false);
  }, [fetchPage, firstPageUrl, items.length, nextPageUrl]);

  return { items, hasMore: nextCursor !== null, status, loadMore, retry };
}

// One exercise's tutorial, fetched when the component showing it mounts (reopening it reuses the
// browser's cached response; the API allows private caching).
export function useExerciseTutorial(exerciseId: string) {
  const [state, setState] = useState<{ tutorial: ExerciseTutorial | null; status: LoadStatus }>({
    tutorial: null,
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchJson<ExerciseTutorial>(exerciseTutorialUrl(exerciseId), controller.signal)
      .then((tutorial) => setState({ tutorial, status: "ready" }))
      .catch((error) => {
        if (!isAbort(error)) setState({ tutorial: null, status: "error" });
      });
    return () => controller.abort();
  }, [exerciseId, attempt]);

  const retry = useCallback(() => {
    setState({ tutorial: null, status: "loading" });
    setAttempt((n) => n + 1);
  }, []);
  return { ...state, retry };
}
