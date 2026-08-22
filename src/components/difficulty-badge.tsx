import { DIFFICULTY_LABEL, type Difficulty } from "@/lib/dataset";
import { cn } from "@/lib/utils";

const STYLES: Record<Difficulty, string> = {
  0: "text-easy bg-easy-bg border-easy-border",
  1: "text-medium bg-medium-bg border-medium-border",
  2: "text-hard bg-hard-bg border-hard-border",
};

export function DifficultyBadge({
  difficulty,
  className,
}: {
  difficulty: Difficulty;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-md border px-1.5 text-[11px] font-medium leading-none",
        STYLES[difficulty],
        className,
      )}
    >
      {DIFFICULTY_LABEL[difficulty]}
    </span>
  );
}
