/**
 * Study progress, persisted to localStorage. No account, no backend - the whole
 * feature is a slug to status map plus a subscription so every mounted view
 * (table, filters, stats) updates together, including across browser tabs.
 */
"use client";

import { useCallback, useSyncExternalStore } from "react";

export type StudyStatus = "none" | "solved" | "revisiting";

export const STUDY_STATUSES: { id: StudyStatus; label: string }[] = [
  { id: "none", label: "Not started" },
  { id: "solved", label: "Solved" },
  { id: "revisiting", label: "Revisiting" },
];

const KEY = "codeprep:study:v1";

type StudyMap = Record<string, "solved" | "revisiting">;

let cache: StudyMap | null = null;
const listeners = new Set<() => void>();

function read(): StudyMap {
  if (cache) return cache;
  if (typeof window === "undefined") return (cache = {});
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    cache =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as StudyMap)
        : {};
  } catch {
    // Corrupted or unavailable storage must never break the explorer.
    cache = {};
  }
  return cache;
}

function emit() {
  for (const listener of listeners) listener();
}

function commit(next: StudyMap) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota or private mode - progress stays in memory for this session */
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      cache = null;
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Stable empty map so server render and first client render agree. */
const SERVER_SNAPSHOT: StudyMap = {};

export function useStudy() {
  const map = useSyncExternalStore(subscribe, read, () => SERVER_SNAPSHOT);

  const statusOf = useCallback((slug: string): StudyStatus => map[slug] ?? "none", [map]);

  const setStatus = useCallback((slug: string, status: StudyStatus) => {
    const next = { ...read() };
    if (status === "none") delete next[slug];
    else next[slug] = status;
    commit(next);
  }, []);

  const cycle = useCallback(
    (slug: string) => {
      const current = read()[slug];
      const next: StudyStatus =
        current === undefined ? "solved" : current === "solved" ? "revisiting" : "none";
      setStatus(slug, next);
    },
    [setStatus],
  );

  const reset = useCallback(() => commit({}), []);

  return { map, statusOf, setStatus, cycle, reset };
}
