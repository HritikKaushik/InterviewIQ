"use client";

import { ArrowRight, Building2 } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActiveTopicChips, FilterBar } from "@/components/filter-bar";
import { QuestionDetail } from "@/components/question-detail";
import { QuestionTable, type TableVariant } from "@/components/question-table";
import { StatsRow } from "@/components/stats-row";
import { useExplorerState } from "@/hooks/use-explorer-state";
import {
  type CompanySummary,
  type PeriodId,
  type Question,
  meta,
  rankedCompanies,
} from "@/lib/dataset";
import {
  ALL_ROWS,
  COMPANY_SORTS,
  GLOBAL_SORTS,
  applyFilters,
  parseTerms,
  rowsFromPairs,
  tally,
} from "@/lib/explorer";
import { useStudy } from "@/lib/study";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";

/**
 * Formatted once, in UTC. A viewer-local format would render differently on the
 * server than in the browser and trip a hydration mismatch.
 */
const DATASET_UPDATED = new Date(meta.sourceCommittedAt).toLocaleDateString("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export interface ExplorerProps {
  variant: TableVariant;
  company?: CompanySummary;
  /** Flat [questionIndex, frequency, ...] pairs per window, company view only. */
  periods?: Record<PeriodId, number[]>;
}

export function Explorer({ variant, company, periods }: ExplorerProps) {
  const isCompany = variant === "company";
  const sorts = isCompany ? COMPANY_SORTS : GLOBAL_SORTS;
  const { state, actions, activeFilterCount } = useExplorerState({
    sort: isCompany ? "frequency" : "companies",
    period: "all",
  });

  const study = useStudy();
  const searchRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [stackTop, setStackTop] = useState<number | null>(null);
  const [selected, setSelected] = useState<Question | null>(null);

  // The table's column header sticks directly below the toolbar, whose height
  // changes as the filter row wraps. Both the header and the toolbar offset are
  // measured rather than assumed: they are sized in rem, so hard-coding 56px
  // would desync the stack for anyone whose browser font size is not the 16px
  // default.
  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const measure = () => {
      const headerHeight = document.querySelector("header")?.offsetHeight ?? 0;
      setStackTop(headerHeight + toolbar.getBoundingClientRect().height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(toolbar);
    const header = document.querySelector("header");
    if (header) observer.observe(header);
    return () => observer.disconnect();
  }, []);

  // "/" focuses search, the way every developer tool with a list does it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const baseRows = useMemo(() => {
    if (!isCompany || !periods) return ALL_ROWS;
    return rowsFromPairs(periods[state.period] ?? []);
  }, [isCompany, periods, state.period]);

  // Typing stays responsive on the 3.4k-row global list: the input updates
  // immediately and the expensive filter pass runs against a deferred value.
  const deferredQuery = useDeferredValue(state.query);
  const isStale = deferredQuery !== state.query;

  const rows = useMemo(
    () =>
      applyFilters({
        rows: baseRows,
        query: deferredQuery,
        difficulties: state.difficulties,
        topics: state.topics,
        statuses: state.statuses,
        sort: state.sort,
        desc: state.desc,
        studyOf: study.statusOf,
      }),
    [
      baseRows,
      deferredQuery,
      state.difficulties,
      state.topics,
      state.statuses,
      state.sort,
      state.desc,
      study.statusOf,
    ],
  );

  const counts = useMemo(() => tally(rows), [rows]);
  const solvedVisible = useMemo(
    () => rows.reduce((n, r) => n + (study.statusOf(r.question.slug) === "solved" ? 1 : 0), 0),
    [rows, study],
  );

  // In the all-companies view a query that names a company is almost always an
  // attempt to navigate, so offer that jump rather than silently finding nothing.
  const companyMatches = useMemo(() => {
    if (isCompany) return [];
    const terms = parseTerms(deferredQuery);
    if (!terms.length) return [];
    return rankedCompanies
      .filter((c) => terms.every((t) => c.name.toLowerCase().includes(t)))
      .slice(0, 5);
  }, [isCompany, deferredQuery]);

  const periodCounts = useMemo(() => {
    if (!periods) return undefined;
    return Object.fromEntries(
      Object.entries(periods).map(([id, pairs]) => [id, pairs.length / 2]),
    ) as Record<PeriodId, number>;
  }, [periods]);

  const onSelectTopic = useCallback(
    (topicId: number) => actions.toggleTopic(topicId),
    [actions],
  );

  const total = isCompany ? (company?.total ?? 0) : meta.totals.questions;
  const filtered = rows.length !== baseRows.length;

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col">
      <div className="px-3 pb-4 pt-5 sm:px-5">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {isCompany ? company?.name : "All companies"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isCompany ? (
                <>
                  <span className="tnum">{formatCount(total)}</span>{" "}
                  {total === 1 ? "problem" : "problems"} in the dataset
                </>
              ) : (
                <>
                  <span className="tnum">{formatCount(total)}</span> unique problems across{" "}
                  <span className="tnum">{formatCount(meta.totals.companiesWithData)}</span>{" "}
                  companies
                </>
              )}
              <span aria-hidden className="mx-1.5 text-muted-foreground/40">
                ·
              </span>
              <span title={meta.sourceCommittedAt}>
                Dataset updated {DATASET_UPDATED}
              </span>
            </p>
          </div>

          {solvedVisible > 0 && (
            <p className="tnum shrink-0 text-sm text-muted-foreground">
              <span className="font-medium text-solved">{formatCount(solvedVisible)}</span>{" "}
              solved
            </p>
          )}
        </div>

        <StatsRow
          className="mt-4"
          stats={[
            {
              label: filtered ? "Showing" : "Problems",
              value: formatCount(rows.length),
              hint: filtered
                ? `${formatCount(rows.length)} of ${formatCount(baseRows.length)} match the current filters`
                : undefined,
            },
            { label: "Easy", value: formatCount(counts[0]), tone: "easy" },
            { label: "Medium", value: formatCount(counts[1]), tone: "medium" },
            { label: "Hard", value: formatCount(counts[2]), tone: "hard" },
          ]}
        />
      </div>

      <div
        ref={toolbarRef}
        className="sticky top-14 z-20 border-b border-border bg-background/95 px-3 py-2 backdrop-blur-md sm:px-5"
      >
        <FilterBar
          query={state.query}
          onQueryChange={actions.setQuery}
          searchRef={searchRef}
          difficulties={state.difficulties}
          onToggleDifficulty={actions.toggleDifficulty}
          selectedTopics={state.topics}
          onToggleTopic={actions.toggleTopic}
          onSetTopics={actions.setTopics}
          statuses={state.statuses}
          onToggleStatus={actions.toggleStatus}
          period={isCompany ? state.period : undefined}
          onPeriodChange={isCompany ? actions.setPeriod : undefined}
          periodCounts={isCompany ? periodCounts : undefined}
          sort={state.sort}
          sorts={sorts}
          desc={state.desc}
          onSortChange={actions.setSort}
          onToggleDirection={() => actions.toggleSort(state.sort)}
          activeFilterCount={activeFilterCount}
          onClearFilters={actions.clearFilters}
        />
      </div>

      {(state.topics.length > 0 || companyMatches.length > 0) && (
        <div className="space-y-2 px-3 pt-3 sm:px-5">
          <ActiveTopicChips
            selectedTopics={state.topics}
            onToggleTopic={actions.toggleTopic}
          />
          {companyMatches.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Jump to company
              </span>
              {companyMatches.map((match) => (
                <Link
                  key={match.slug}
                  href={`/company/${match.slug}`}
                  className="group inline-flex h-6 items-center gap-1.5 rounded-md border border-border px-2 text-[11px] transition-colors hover:border-primary/40 hover:bg-accent"
                >
                  <Building2 className="size-3 text-muted-foreground" />
                  {match.name}
                  <span className="tnum text-muted-foreground">{match.total}</span>
                  <ArrowRight className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        className={cn(
          "mt-1 flex-1 transition-opacity duration-150",
          isStale && "opacity-60",
        )}
        style={{ ["--stack-top" as string]: stackTop === null ? "3.5rem" : `${stackTop}px` }}
      >
        <QuestionTable
          rows={rows}
          variant={variant}
          sort={state.sort}
          desc={state.desc}
          onToggleSort={actions.toggleSort}
          statusOf={study.statusOf}
          onCycleStatus={study.cycle}
          onSelect={setSelected}
          onClearFilters={actions.clearFilters}
          hasFilters={activeFilterCount > 0}
        />
      </div>

      <QuestionDetail
        question={selected}
        onOpenChange={(open) => !open && setSelected(null)}
        status={selected ? study.statusOf(selected.slug) : "none"}
        onSetStatus={(status) => selected && study.setStatus(selected.slug, status)}
        onSelectTopic={onSelectTopic}
      />
    </div>
  );
}
