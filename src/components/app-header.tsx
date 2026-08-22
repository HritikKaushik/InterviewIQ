"use client";

import { Menu, Search, SquareCode } from "lucide-react";
import Link from "next/link";
import { useCommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { SOURCE_REPO } from "@/lib/links";

/** The dataset's own repository, credited in the header and the footer. */
function GitHubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden {...props}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function AppHeader({ onOpenSidebar }: { onOpenSidebar?: () => void }) {
  const palette = useCommandPalette();

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="flex h-full items-center gap-2 px-3 sm:px-4">
        {onOpenSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 lg:hidden"
            onClick={onOpenSidebar}
            aria-label="Browse companies"
          >
            <Menu className="size-4" />
          </Button>
        )}

        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md py-1 pr-2 transition-opacity hover:opacity-80"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <SquareCode className="size-4" strokeWidth={2.25} />
          </span>
          <span className="flex min-w-0 flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight">CodePrep</span>
            <span className="mt-0.5 hidden truncate text-[11px] text-muted-foreground sm:block">
              Company-wise LeetCode Interview Questions
            </span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={palette.open}
            className="h-8 gap-2 pl-2.5 pr-1.5 text-muted-foreground font-normal"
          >
            <Search className="size-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="ml-1 hidden items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground sm:inline-flex">
              <span className="text-xs">&#8984;</span>K
            </kbd>
          </Button>

          <Button variant="ghost" size="icon" className="size-8" asChild>
            <a
              href={SOURCE_REPO}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Source dataset on GitHub (opens in a new tab)"
            >
              <GitHubIcon className="size-4" />
            </a>
          </Button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
