import { cn } from "@/lib/utils";

/**
 * Frequency as reported by the dataset: a 5-100 relative score, scoped to one
 * company and one recency window. The bar exists so a column of these can be
 * scanned at a glance; the number stays visible because the bar alone is not an
 * accessible representation.
 */
export function FrequencyMeter({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      title={`Frequency ${value} of 100`}
    >
      <div
        className="relative h-1 w-full min-w-8 overflow-hidden rounded-full bg-border"
        role="presentation"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary/70 transition-[width] duration-300"
          style={{ width: `${Math.max(2, value)}%` }}
        />
      </div>
      <span className="tnum w-9 shrink-0 text-right text-xs text-muted-foreground">
        {value.toFixed(0)}
      </span>
    </div>
  );
}
