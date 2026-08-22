"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, Building2, ExternalLink, SearchX } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DifficultyBadge } from "@/components/difficulty-badge";
import { FrequencyMeter } from "@/components/frequency-meter";
import { StudyStatusControl } from "@/components/study-status-control";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsDesktop } from "@/hooks/use-media-query";
import { topics as ALL_TOPICS, type Question } from "@/lib/dataset";
import type { Row, SortId } from "@/lib/explorer";
import type { StudyStatus } from "@/lib/study";
import { cn } from "@/lib/utils";

export type TableVariant = "company" | "global";

/**
 * Column widths are declared once and shared by the header and the rows, so the
 * two can never drift. Cell count changes with the breakpoint because hidden
 * cells are `display: none` and drop out of the grid entirely:
 *   base -> status, rank, title, difficulty, frequency, open   (6)
 *   lg   -> + acceptance                                       (7)
 *   xl   -> + topics                                           (8)
 */
const GRID = [
  "grid-cols-[1.75rem_2.25rem_minmax(0,1fr)_5.5rem_8rem_2.25rem]",
  "lg:grid-cols-[1.75rem_2.25rem_minmax(0,1fr)_5.5rem_6.5rem_8rem_2.25rem]",
  "xl:grid-cols-[1.75rem_2.25rem_minmax(0,1fr)_10rem_5.5rem_6.5rem_8rem_2.25rem]",
].join(" ");

const ROW_HEIGHT = 44;
const CARD_HEIGHT = 108;

interface Column {
  id: SortId | null;
  label: string;
  align?: "right";
  /** Tailwind classes controlling at which breakpoint the column appears. */
  visibility?: string;
  srOnly?: boolean;
}

function columnsFor(variant: TableVariant): Column[] {
  return [
    { id: null, label: "Progress", srOnly: true },
    { id: null, label: "Rank", srOnly: true },
    { id: "title", label: "Problem" },
    { id: null, label: "Topics", visibility: "hidden xl:flex" },
    { id: "difficulty", label: "Difficulty" },
    { id: "acceptance", label: "Acceptance", align: "right", visibility: "hidden lg:flex" },
    variant === "company"
      ? { id: "frequency", label: "Frequency" }
      : { id: "companies", label: "Companies" },
    { id: null, label: "Open on LeetCode", srOnly: true },
  ];
}

function topicNames(question: Question) {
  return question.topics.map((t) => ALL_TOPICS[t]);
}

export interface QuestionTableProps {
  rows: Row[];
  variant: TableVariant;
  sort: SortId;
  desc: boolean;
  onToggleSort: (id: SortId) => void;
  statusOf: (slug: string) => StudyStatus;
  onCycleStatus: (slug: string) => void;
  onSelect: (question: Question) => void;
  onClearFilters: () => void;
  hasFilters: boolean;
}

export function QuestionTable(props: QuestionTableProps) {
  const { rows, hasFilters, onClearFilters } = props;
  const isDesktop = useIsDesktop();
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  // The virtualizer drives the window scrollbar, so it needs to know how far
  // the list starts from the top of the document.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => setScrollMargin(el.offsetTop);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const rowHeight = isDesktop ? ROW_HEIGHT : CARD_HEIGHT;
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => rowHeight,
    overscan: 12,
    scrollMargin,
  });

  // Rows are a fixed height per breakpoint, so nothing is measured per item;
  // the virtualizer only needs a nudge when that height changes.
  useEffect(() => {
    virtualizer.measure();
  }, [rowHeight, virtualizer]);

  if (rows.length === 0) return <EmptyState hasFilters={hasFilters} onClear={onClearFilters} />;

  const items = virtualizer.getVirtualItems();

  return (
    <div
      role="table"
      aria-label="Interview questions"
      aria-rowcount={rows.length}
      className="w-full"
    >
      {isDesktop && <ColumnHeader {...props} />}
      <div
        ref={listRef}
        role="rowgroup"
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        <div
          className="absolute inset-x-0 top-0"
          style={{ transform: `translateY(${(items[0]?.start ?? 0) - scrollMargin}px)` }}
        >
          {items.map((item) => {
            const row = rows[item.index];
            return (
              <div key={row.question.slug}>
                {isDesktop ? (
                  <DesktopRow {...props} row={row} rank={item.index + 1} />
                ) : (
                  <MobileCard {...props} row={row} rank={item.index + 1} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ColumnHeader({ variant, sort, desc, onToggleSort }: QuestionTableProps) {
  const columns = columnsFor(variant);
  return (
    <div role="rowgroup" className="sticky top-[var(--stack-top)] z-10 bg-background">
      <div
        role="row"
        className={cn(
          "grid h-9 items-center gap-3 border-b border-border px-3",
          "text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
          GRID,
        )}
      >
        {columns.map((col, i) => {
          const active = col.id !== null && sort === col.id;
          const content = col.srOnly ? (
            <span className="sr-only">{col.label}</span>
          ) : col.id === null ? (
            <span className="truncate">{col.label}</span>
          ) : (
            <button
              type="button"
              onClick={() => onToggleSort(col.id!)}
              className={cn(
                "-mx-1 inline-flex max-w-full items-center gap-1 rounded px-1 py-0.5",
                // Preflight resets text-transform on <button>, so the row's
                // `uppercase` has to be restated here to match the plain cells.
                "uppercase transition-colors hover:text-foreground",
                active && "text-foreground",
                col.align === "right" && "flex-row-reverse",
              )}
            >
              <span className="truncate">{col.label}</span>
              {active ? (
                desc ? (
                  <ArrowDown className="size-3 shrink-0" />
                ) : (
                  <ArrowUp className="size-3 shrink-0" />
                )
              ) : (
                <ArrowDown className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-40" />
              )}
            </button>
          );

          return (
            <div
              key={`${col.label}-${i}`}
              role="columnheader"
              aria-sort={
                col.id === null ? undefined : active ? (desc ? "descending" : "ascending") : "none"
              }
              className={cn(
                "group flex min-w-0 items-center",
                col.align === "right" && "justify-end",
                col.visibility,
              )}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface RowProps extends QuestionTableProps {
  row: Row;
  rank: number;
}

function DesktopRow({
  row,
  rank,
  variant,
  statusOf,
  onCycleStatus,
  onSelect,
}: RowProps) {
  const { question, frequency } = row;
  const status = statusOf(question.slug);
  const names = topicNames(question);

  return (
    <div
      role="row"
      aria-rowindex={rank}
      onClick={() => onSelect(question)}
      onKeyDown={(e) => {
        // React's synthetic keydown bubbles from the progress button and the
        // LeetCode link, whose own Enter/Space activation must win.
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(question);
        }
      }}
      tabIndex={0}
      className={cn(
        "group grid h-11 cursor-pointer items-center gap-3 border-b border-border/60 px-3",
        "transition-colors hover:bg-accent/60 focus-visible:bg-accent/60",
        status === "solved" && "bg-solved/[0.045]",
        GRID,
      )}
    >
      <div role="cell" className="flex items-center">
        <StudyStatusControl
          status={status}
          title={question.title}
          onCycle={() => onCycleStatus(question.slug)}
        />
      </div>

      <div role="cell" className="tnum text-right text-xs text-muted-foreground">
        {rank}
      </div>

      <div role="cell" className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "truncate text-sm",
            status === "solved" ? "text-muted-foreground" : "text-foreground",
          )}
          title={question.title}
        >
          {question.title}
        </span>
      </div>

      <div role="cell" className="hidden min-w-0 items-center xl:flex">
        <span className="truncate text-xs text-muted-foreground" title={names.join(", ")}>
          {names.join(", ") || "-"}
        </span>
      </div>

      <div role="cell" className="flex items-center">
        <DifficultyBadge difficulty={question.difficulty} />
      </div>

      <div
        role="cell"
        className="tnum hidden items-center justify-end text-xs text-muted-foreground lg:flex"
      >
        {question.acceptance.toFixed(1)}%
      </div>

      <div role="cell" className="flex items-center">
        {variant === "company" && frequency !== undefined ? (
          <FrequencyMeter value={frequency} className="w-full" />
        ) : (
          <CompaniesCell question={question} />
        )}
      </div>

      <div role="cell" className="flex items-center justify-end">
        <SolveLink question={question} />
      </div>
    </div>
  );
}

function CompaniesCell({ question }: { question: Question }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="size-3.5 shrink-0 opacity-60" />
          <span className="tnum">{question.companyCount}</span>
          <span className="text-muted-foreground">
            · peak {question.maxFrequency.toFixed(0)}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Asked at {question.companyCount} companies · peak frequency{" "}
        {question.maxFrequency.toFixed(0)}, average {question.avgFrequency.toFixed(0)}
      </TooltipContent>
    </Tooltip>
  );
}

function SolveLink({ question }: { question: Question }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={question.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Solve ${question.title} on LeetCode (opens in a new tab)`}
          className={cn(
            "flex size-7 items-center justify-center rounded-md text-muted-foreground",
            "transition-colors hover:bg-accent hover:text-foreground",
            "focus-visible:bg-accent focus-visible:text-foreground",
            "md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
          )}
        >
          <ExternalLink className="size-3.5" />
        </a>
      </TooltipTrigger>
      <TooltipContent>Solve on LeetCode</TooltipContent>
    </Tooltip>
  );
}

function MobileCard({ row, rank, variant, statusOf, onCycleStatus, onSelect }: RowProps) {
  const { question, frequency } = row;
  const status = statusOf(question.slug);
  const names = topicNames(question);

  return (
    <div
      role="row"
      aria-rowindex={rank}
      onClick={() => onSelect(question)}
      tabIndex={0}
      onKeyDown={(e) => {
        // React's synthetic keydown bubbles from the progress button and the
        // LeetCode link, whose own Enter/Space activation must win.
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(question);
        }
      }}
      className={cn(
        "flex h-27 w-full flex-col justify-center gap-1.5 border-b border-border/60 px-3 py-2 text-left",
        status === "solved" && "bg-solved/[0.045]",
      )}
    >
      <div role="cell" className="flex items-start gap-2">
        <StudyStatusControl
          status={status}
          title={question.title}
          onCycle={() => onCycleStatus(question.slug)}
          className="-ml-1 mt-px"
        />
        <span
          className={cn(
            "line-clamp-2 flex-1 text-sm leading-snug",
            status === "solved" ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {question.title}
        </span>
        <a
          href={question.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Solve ${question.title} on LeetCode (opens in a new tab)`}
          className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground"
        >
          <ExternalLink className="size-4" />
        </a>
      </div>

      <div role="cell" className="flex items-center gap-2 pl-8 text-xs text-muted-foreground">
        <DifficultyBadge difficulty={question.difficulty} />
        <span className="tnum">{question.acceptance.toFixed(0)}%</span>
        {variant === "company" && frequency !== undefined ? (
          <>
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
            <span className="tnum">freq {frequency.toFixed(0)}</span>
          </>
        ) : (
          <>
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
            <span className="tnum">{question.companyCount} companies</span>
          </>
        )}
      </div>

      {names.length > 0 && (
        <div role="cell" className="truncate pl-8 text-[11px] text-muted-foreground">
          {names.join(", ")}
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted/50">
        <SearchX className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">No questions found.</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          {hasFilters
            ? "Try changing your filters or search query."
            : "This company has no problems in the selected time window."}
        </p>
      </div>
      {hasFilters && (
        <Button variant="outline" size="sm" onClick={onClear} className="mt-1">
          Clear filters
        </Button>
      )}
    </div>
  );
}
