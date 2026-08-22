"use client";

import { ArrowDownWideNarrow, Check, ChevronDown, ListFilter, Search, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DIFFICULTIES,
  type Difficulty,
  PERIODS,
  type PeriodId,
  topicUsage,
  topics as ALL_TOPICS,
} from "@/lib/dataset";
import type { SortId } from "@/lib/explorer";
import { STUDY_STATUSES, type StudyStatus } from "@/lib/study";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";

export interface FilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;

  difficulties: Difficulty[];
  onToggleDifficulty: (value: Difficulty) => void;

  selectedTopics: number[];
  onToggleTopic: (value: number) => void;
  onSetTopics: (value: number[]) => void;

  statuses: StudyStatus[];
  onToggleStatus: (value: StudyStatus) => void;

  /** Omitted in the all-companies view, where recency windows do not apply. */
  period?: PeriodId;
  onPeriodChange?: (value: PeriodId) => void;
  periodCounts?: Record<PeriodId, number>;

  sort: SortId;
  sorts: { id: SortId; label: string }[];
  desc: boolean;
  onSortChange: (value: SortId) => void;
  onToggleDirection: () => void;

  activeFilterCount: number;
  onClearFilters: () => void;
}

export function FilterBar(props: FilterBarProps) {
  const {
    query,
    onQueryChange,
    searchRef,
    period,
    onPeriodChange,
    periodCounts,
    activeFilterCount,
    onClearFilters,
  } = props;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search questions..."
            aria-label="Search questions by title or topic"
            className="h-8 pl-8 pr-14 text-sm"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent"
            >
              <X className="size-3" />
            </button>
          ) : (
            <kbd
              aria-hidden
              className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground sm:block"
            >
              /
            </kbd>
          )}
        </div>

        <DifficultyFilter {...props} />
        <TopicFilter {...props} />
        <StatusFilter {...props} />
        <SortControl {...props} />

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 gap-1 px-2 text-muted-foreground"
          >
            <X className="size-3.5" />
            Clear
          </Button>
        )}
      </div>

      {period && onPeriodChange && periodCounts && (
        <PeriodTabs value={period} onChange={onPeriodChange} counts={periodCounts} />
      )}
    </div>
  );
}

function TriggerButton({
  active,
  count,
  icon: Icon,
  label,
  ...rest
}: React.ComponentProps<typeof Button> & {
  active?: boolean;
  count?: number;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("h-8 gap-1.5 px-2.5 font-normal", active && "border-primary/40 bg-primary/5")}
      {...rest}
    >
      <Icon className="size-3.5 text-muted-foreground" />
      <span>{label}</span>
      {count ? (
        <Badge
          variant="secondary"
          className="tnum h-4 min-w-4 justify-center rounded px-1 text-[10px]"
        >
          {count}
        </Badge>
      ) : (
        <ChevronDown className="size-3 text-muted-foreground" />
      )}
    </Button>
  );
}

function DifficultyFilter({ difficulties, onToggleDifficulty }: FilterBarProps) {
  return (
    <div
      role="group"
      aria-label="Filter by difficulty"
      className="flex h-8 items-center gap-0.5 rounded-md border border-border p-0.5"
    >
      {DIFFICULTIES.map((d) => {
        const active = difficulties.includes(d.id);
        return (
          <button
            key={d.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggleDifficulty(d.id)}
            className={cn(
              "h-7 rounded px-2 text-xs font-medium transition-colors",
              active
                ? d.token === "easy"
                  ? "bg-easy-bg text-easy"
                  : d.token === "medium"
                    ? "bg-medium-bg text-medium"
                    : "bg-hard-bg text-hard"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

function TopicFilter({ selectedTopics, onToggleTopic, onSetTopics }: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);

  const results = useMemo(() => {
    const needle = deferred.trim().toLowerCase();
    const list = needle
      ? topicUsage.filter((t) => t.name.toLowerCase().includes(needle))
      : topicUsage;
    return list.slice(0, 60);
  }, [deferred]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <TriggerButton
          icon={ListFilter}
          label="Topics"
          active={selectedTopics.length > 0}
          count={selectedTopics.length}
          aria-expanded={open}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Filter topics..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-64">
            <CommandEmpty>No topics found.</CommandEmpty>
            <CommandGroup>
              {results.map((topic) => {
                const active = selectedTopics.includes(topic.id);
                return (
                  <CommandItem
                    key={topic.id}
                    value={String(topic.id)}
                    onSelect={() => onToggleTopic(topic.id)}
                    className="gap-2"
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border",
                        active ? "border-primary bg-primary text-primary-foreground" : "border-border",
                      )}
                    >
                      {active && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 truncate">{topic.name}</span>
                    <span className="tnum text-[11px] text-muted-foreground">{topic.count}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {selectedTopics.length > 0 && (
            <div className="border-t border-border p-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-full justify-start text-xs text-muted-foreground"
                onClick={() => onSetTopics([])}
              >
                Clear {selectedTopics.length} selected
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function StatusFilter({ statuses, onToggleStatus }: FilterBarProps) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <TriggerButton
          icon={Check}
          label="Progress"
          active={statuses.length > 0}
          count={statuses.length}
          aria-expanded={open}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {STUDY_STATUSES.map((status) => {
          const active = statuses.includes(status.id);
          return (
            <DropdownMenuItem
              key={status.id}
              onSelect={(e) => {
                e.preventDefault();
                onToggleStatus(status.id);
              }}
              className="gap-2"
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded border",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                {active && <Check className="size-3" strokeWidth={3} />}
              </span>
              {status.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SortControl({ sort, sorts, desc, onSortChange, onToggleDirection }: FilterBarProps) {
  const current = sorts.find((s) => s.id === sort) ?? sorts[0];
  return (
    <div className="flex h-8 items-center rounded-md border border-border">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-full gap-1.5 rounded-r-none px-2.5 font-normal"
          >
            <ArrowDownWideNarrow className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline text-muted-foreground">Sort</span>
            <span>{current.label}</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {sorts.map((option) => (
            <DropdownMenuItem
              key={option.id}
              onSelect={() => onSortChange(option.id)}
              className="gap-2"
            >
              <span className="flex-1">{option.label}</span>
              {option.id === sort && <Check className="size-3.5" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleDirection}
            aria-label={desc ? "Sort ascending" : "Sort descending"}
            className="size-7 rounded-l-none border-l border-border"
          >
            <ArrowDownWideNarrow
              className={cn("size-3.5 transition-transform", !desc && "-scale-y-100")}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{desc ? "Descending" : "Ascending"}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function PeriodTabs({
  value,
  onChange,
  counts,
}: {
  value: PeriodId;
  onChange: (value: PeriodId) => void;
  counts: Record<PeriodId, number>;
}) {
  return (
    <div
      role="tablist"
      aria-label="Recency window"
      className="scrollbar-thin -mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5"
    >
      {PERIODS.map((p) => {
        const active = p.id === value;
        const count = counts[p.id];
        return (
          <Tooltip key={p.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                disabled={count === 0}
                onClick={() => onChange(p.id)}
                className={cn(
                  "flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors",
                  active
                    ? "bg-secondary font-medium text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  count === 0 && "cursor-not-allowed opacity-40 hover:bg-transparent",
                )}
              >
                {p.label}
                <span className="tnum text-[11px] text-muted-foreground">
                  {formatCount(count)}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent>{p.hint}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/** Chips summarising the active topic filters, shown under the toolbar. */
export function ActiveTopicChips({
  selectedTopics,
  onToggleTopic,
}: {
  selectedTopics: number[];
  onToggleTopic: (id: number) => void;
}) {
  if (selectedTopics.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selectedTopics.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onToggleTopic(id)}
          className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-muted/60 px-2 text-[11px] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-foreground"
        >
          {ALL_TOPICS[id]}
          <X className="size-3" />
        </button>
      ))}
    </div>
  );
}
