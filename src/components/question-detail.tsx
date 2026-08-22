"use client";

import { Building2, ExternalLink, Info } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DifficultyBadge } from "@/components/difficulty-badge";
import { FrequencyMeter } from "@/components/frequency-meter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  companies,
  loadQuestionCompanies,
  meta,
  type Question,
  topics as ALL_TOPICS,
} from "@/lib/dataset";
import { STUDY_STATUSES, type StudyStatus } from "@/lib/study";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";

/**
 * Detail panel for a single problem. The company breakdown comes from the full
 * reverse index, which is fetched the first time this panel opens so the
 * initial page payload stays small.
 */
export function QuestionDetail({
  question,
  onOpenChange,
  status,
  onSetStatus,
  onSelectTopic,
}: {
  question: Question | null;
  onOpenChange: (open: boolean) => void;
  status: StudyStatus;
  onSetStatus: (status: StudyStatus) => void;
  onSelectTopic: (topicId: number) => void;
}) {
  const [index, setIndex] = useState<number[][] | null>(null);

  useEffect(() => {
    if (!question) return;
    let cancelled = false;
    loadQuestionCompanies().then((rows) => {
      if (!cancelled) setIndex(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [question]);

  const pairs = question && index ? index[question.index] : null;

  return (
    <Sheet open={question !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        {question && (
          <>
            <SheetHeader className="space-y-2 border-b border-border px-5 py-4">
              <SheetTitle className="pr-6 text-base leading-snug">{question.title}</SheetTitle>
              <SheetDescription className="sr-only">
                Details and company breakdown for {question.title}
              </SheetDescription>
              <div className="flex flex-wrap items-center gap-2">
                <DifficultyBadge difficulty={question.difficulty} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="tnum inline-flex items-center gap-1 text-xs text-muted-foreground">
                      {question.acceptance.toFixed(1)}% acceptance
                      <Info className="size-3 opacity-60" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64">
                    Derived from the dataset&apos;s pre-scaled acceptance column (multiplied by{" "}
                    {formatCount(meta.acceptanceScale)}). The source documents no unit for
                    this field.
                  </TooltipContent>
                </Tooltip>
              </div>
            </SheetHeader>

            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-5 px-5 py-4">
                <Button asChild className="w-full gap-2">
                  <a href={question.url} target="_blank" rel="noopener noreferrer">
                    Solve on LeetCode
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>

                <section className="space-y-2">
                  <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Progress
                  </h3>
                  <div className="grid grid-cols-3 gap-1 rounded-lg border border-border p-1">
                    {STUDY_STATUSES.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={status === option.id}
                        onClick={() => onSetStatus(option.id)}
                        className={cn(
                          "h-8 rounded-md text-xs font-medium transition-colors",
                          status === option.id
                            ? option.id === "solved"
                              ? "bg-solved/15 text-solved"
                              : option.id === "revisiting"
                                ? "bg-revisiting/15 text-revisiting"
                                : "bg-secondary text-secondary-foreground"
                            : "text-muted-foreground hover:bg-accent",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </section>

                {question.topics.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Topics
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {question.topics.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            onSelectTopic(id);
                            onOpenChange(false);
                          }}
                          className="rounded-md border border-border bg-muted/50 px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                        >
                          {ALL_TOPICS[id]}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <Separator />

                <section className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Asked at
                    </h3>
                    <span className="tnum text-xs text-muted-foreground">
                      {formatCount(question.companyCount)}{" "}
                      {question.companyCount === 1 ? "company" : "companies"}
                    </span>
                  </div>

                  {pairs === null ? (
                    <div className="space-y-1.5">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                      ))}
                    </div>
                  ) : pairs.length === 0 ? (
                    <p className="py-4 text-sm text-muted-foreground">
                      No company in the dataset lists this problem.
                    </p>
                  ) : (
                    <ul className="space-y-0.5">
                      {Array.from({ length: pairs.length / 2 }, (_, i) => {
                        const company = companies[pairs[i * 2]];
                        const frequency = pairs[i * 2 + 1];
                        return (
                          <li key={company.slug}>
                            <Link
                              href={`/company/${company.slug}`}
                              onClick={() => onOpenChange(false)}
                              className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                            >
                              <Building2 className="size-3.5 shrink-0 text-muted-foreground/60" />
                              <span className="min-w-0 flex-1 truncate text-sm">
                                {company.name}
                              </span>
                              <FrequencyMeter value={frequency} className="w-24 shrink-0" />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <p className="pt-1 text-[11px] text-muted-foreground">
                    Frequencies shown for the all-time window.
                  </p>
                </section>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
