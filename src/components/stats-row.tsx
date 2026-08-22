"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Stat {
  label: string;
  value: string;
  tone?: "easy" | "medium" | "hard" | "solved";
  hint?: string;
}

/**
 * A compact tally of what is currently on screen. Every figure is counted from
 * the visible rows, so it always agrees with the table beneath it.
 */
export function StatsRow({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4",
        className,
      )}
    >
      {stats.map((stat) => {
        const body = (
          <div className="flex flex-col gap-0.5 bg-background px-3 py-2.5">
            <dt className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </dt>
            <dd
              className={cn(
                "tnum truncate text-lg font-semibold leading-tight",
                stat.tone === "easy" && "text-easy",
                stat.tone === "medium" && "text-medium",
                stat.tone === "hard" && "text-hard",
                stat.tone === "solved" && "text-solved",
              )}
            >
              {stat.value}
            </dd>
          </div>
        );

        return stat.hint ? (
          <Tooltip key={stat.label}>
            <TooltipTrigger asChild>
              <div className="cursor-default">{body}</div>
            </TooltipTrigger>
            <TooltipContent>{stat.hint}</TooltipContent>
          </Tooltip>
        ) : (
          <div key={stat.label}>{body}</div>
        );
      })}
    </dl>
  );
}
