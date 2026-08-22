"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Difficulty, PeriodId } from "@/lib/dataset";
import type { SortId } from "@/lib/explorer";
import type { StudyStatus } from "@/lib/study";
import {
  PARAM,
  defaultDesc,
  readDesc,
  readDifficulties,
  readPeriod,
  readSort,
  readStatuses,
  readTopics,
  writeDifficulties,
  writePeriod,
  writeStatuses,
  writeTopics,
} from "@/lib/url-state";

/**
 * Explorer state backed by the query string, so any view can be bookmarked or
 * shared. The search box is the one exception: it renders from local state for
 * zero-latency typing and writes to the URL on a short debounce, otherwise
 * every keystroke would push a router update.
 */
export function useExplorerState(defaults: { sort: SortId; period?: PeriodId }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.toString();
  const params = useMemo(() => new URLSearchParams(search), [search]);

  // Parsed filters are memoised on the raw parameter STRING, not on `params`.
  // These arrays feed the dependency list of the expensive row filter, so a
  // fresh array identity every render would defeat that memo entirely.
  const rawDifficulty = params.get(PARAM.difficulty);
  const rawTopic = params.get(PARAM.topic);
  const rawStatus = params.get(PARAM.status);

  const difficulties = useMemo(() => readDifficulties(params), [rawDifficulty]); // eslint-disable-line react-hooks/exhaustive-deps
  const topics = useMemo(() => readTopics(params), [rawTopic]); // eslint-disable-line react-hooks/exhaustive-deps
  const statuses = useMemo(() => readStatuses(params), [rawStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const urlQuery = params.get(PARAM.query) ?? "";
  const [query, setQueryLocal] = useState(urlQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string | null>(null);

  // Adopt external URL changes (back/forward, a link, "clear filters") unless a
  // debounced write from this input is still in flight.
  useEffect(() => {
    if (pendingRef.current === null || pendingRef.current === urlQuery) {
      pendingRef.current = null;
      setQueryLocal(urlQuery);
    }
  }, [urlQuery]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  /**
   * The query string every update merges onto.
   *
   * It cannot be a value captured at render time: the debounced search write
   * fires up to 250ms late and would replay a stale URL, undoing any filter
   * toggled while the timer was pending. It also cannot be
   * `window.location.search`, because `router.replace` applies asynchronously,
   * so a toggle and a debounce landing back to back would read the URL from
   * before the toggle. Tracking the intended value and updating it
   * synchronously in `commit` is correct for both orderings.
   */
  const paramsRef = useRef(search);
  useEffect(() => {
    // Resync when the URL changes from outside this hook (back/forward, links).
    paramsRef.current = search;
  }, [search]);

  const commit = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      paramsRef.current = qs;
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const currentParams = useCallback(() => new URLSearchParams(paramsRef.current), []);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = currentParams();
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
      commit(next);
    },
    [commit, currentParams],
  );

  const setQuery = useCallback(
    (value: string) => {
      setQueryLocal(value);
      pendingRef.current = value;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setParam(PARAM.query, value || null), 250);
    },
    [setParam],
  );

  const flushQuery = useCallback(() => {
    if (!debounceRef.current) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = null;
  }, []);

  const sort = readSort(params, defaults.sort);
  const state = {
    query,
    difficulties,
    topics,
    statuses,
    period: readPeriod(params, defaults.period ?? "all"),
    sort,
    desc: readDesc(params, sort),
  };

  const toggleIn = <T,>(current: T[], value: T): T[] =>
    current.includes(value) ? current.filter((v) => v !== value) : [...current, value];

  const actions = {
    setQuery,
    setDifficulties: (v: Difficulty[]) => setParam(PARAM.difficulty, writeDifficulties(v)),
    toggleDifficulty: (v: Difficulty) =>
      setParam(PARAM.difficulty, writeDifficulties(toggleIn(state.difficulties, v))),
    setTopics: (v: number[]) => setParam(PARAM.topic, writeTopics(v)),
    toggleTopic: (v: number) => setParam(PARAM.topic, writeTopics(toggleIn(state.topics, v))),
    setStatuses: (v: StudyStatus[]) => setParam(PARAM.status, writeStatuses(v)),
    toggleStatus: (v: StudyStatus) =>
      setParam(PARAM.status, writeStatuses(toggleIn(state.statuses, v))),
    setPeriod: (v: PeriodId) =>
      setParam(PARAM.period, writePeriod(v, defaults.period ?? "all")),
    setSort: (v: SortId) => {
      const next = currentParams();
      if (v === defaults.sort) next.delete(PARAM.sort);
      else next.set(PARAM.sort, v);
      // Choosing a new column resets to that column's natural direction.
      next.delete(PARAM.dir);
      commit(next);
    },
    toggleSort: (v: SortId) => {
      const next = currentParams();
      if (v === defaults.sort) next.delete(PARAM.sort);
      else next.set(PARAM.sort, v);
      const nextDesc = state.sort === v ? !state.desc : defaultDesc(v);
      if (nextDesc === defaultDesc(v)) next.delete(PARAM.dir);
      else next.set(PARAM.dir, nextDesc ? "desc" : "asc");
      commit(next);
    },
    clearFilters: () => {
      // Cancel any in-flight search write first, or it would land 250ms later
      // and put the cleared query straight back into the URL.
      flushQuery();
      pendingRef.current = null;
      setQueryLocal("");
      const next = currentParams();
      for (const key of [PARAM.query, PARAM.difficulty, PARAM.topic, PARAM.status]) {
        next.delete(key);
      }
      commit(next);
    },
  };

  const activeFilterCount =
    (state.query ? 1 : 0) +
    state.difficulties.length +
    state.topics.length +
    state.statuses.length;

  return { state, actions, activeFilterCount };
}
