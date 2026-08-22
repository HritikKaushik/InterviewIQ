"use client";

import { Check, Circle, RotateCcw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { StudyStatus } from "@/lib/study";
import { cn } from "@/lib/utils";

const NEXT_LABEL: Record<StudyStatus, string> = {
  none: "Mark as solved",
  solved: "Mark as revisiting",
  revisiting: "Clear progress",
};

const CURRENT_LABEL: Record<StudyStatus, string> = {
  none: "Not started",
  solved: "Solved",
  revisiting: "Revisiting",
};

/**
 * A single click target that cycles not started -> solved -> revisiting.
 * Cycling keeps the table dense; the same states are also reachable from the
 * problem detail panel for anyone who prefers explicit choices.
 */
export function StudyStatusControl({
  status,
  title,
  onCycle,
  className,
}: {
  status: StudyStatus;
  title: string;
  onCycle: () => void;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCycle();
          }}
          aria-label={`${title}: ${CURRENT_LABEL[status]}. ${NEXT_LABEL[status]}.`}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
            "hover:bg-accent focus-visible:bg-accent",
            className,
          )}
        >
          {status === "solved" ? (
            <Check className="size-3.5 text-solved" strokeWidth={3} />
          ) : status === "revisiting" ? (
            <RotateCcw className="size-3.5 text-revisiting" strokeWidth={2.5} />
          ) : (
            <Circle className="size-3 text-muted-foreground/60" strokeWidth={2} />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <span className="font-medium">{CURRENT_LABEL[status]}</span>
        <span className="text-muted-foreground"> · {NEXT_LABEL[status]}</span>
      </TooltipContent>
    </Tooltip>
  );
}
