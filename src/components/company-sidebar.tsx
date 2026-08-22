"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Layers, Search, X } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { companies, meta } from "@/lib/dataset";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";

const ITEM_HEIGHT = 34;

type SortMode = "count" | "name";

/**
 * The persistent company rail. 470 entries is far too many for a plain list to
 * stay smooth while filtering, so rows are virtualised here just like the main
 * table.
 */
function CompanyList({
  activeSlug,
  onNavigate,
}: {
  activeSlug?: string;
  onNavigate?: () => void;
}) {
  // TanStack Virtual exposes imperative getters that React Compiler cannot
  // safely memoise, so this component opts out of compilation explicitly
  // rather than being skipped with a warning.
  "use no memo";

  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("count");
  const deferredQuery = useDeferredValue(query);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    const list = companies.filter(
      (c) => c.total > 0 && (!needle || c.name.toLowerCase().includes(needle)),
    );
    return sortMode === "count"
      ? list.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "en"))
      : list.sort((a, b) => a.name.localeCompare(b.name, "en"));
  }, [deferredQuery, sortMode]);

  // eslint-disable-next-line react-hooks/incompatible-library -- opted out above via "use no memo"
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 10,
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 px-3 pb-2 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies..."
            aria-label="Search companies"
            className="h-8 pl-8 pr-8 text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear company search"
              className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="tnum">
            {formatCount(filtered.length)}{" "}
            {filtered.length === 1 ? "company" : "companies"}
          </span>
          <button
            type="button"
            onClick={() => setSortMode((m) => (m === "count" ? "name" : "count"))}
            className="rounded px-1 py-0.5 transition-colors hover:bg-accent hover:text-foreground"
          >
            {sortMode === "count" ? "By questions" : "A to Z"}
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No companies match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const company = filtered[item.index];
              const active = company.slug === activeSlug;
              return (
                <Link
                  key={company.slug}
                  href={`/company/${company.slug}`}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "absolute inset-x-0 flex items-center gap-2 rounded-md px-2 text-sm transition-colors",
                    active
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                  style={{ top: item.start, height: ITEM_HEIGHT - 2 }}
                >
                  <span className="truncate">{company.name}</span>
                  <span className="tnum ml-auto shrink-0 text-[11px] text-muted-foreground">
                    {formatCount(company.total)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function CompanySidebar({ activeSlug }: { activeSlug?: string }) {
  return (
    <aside
      aria-label="Companies"
      className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-64 shrink-0 border-r border-border lg:flex lg:flex-col"
    >
      <div className="flex flex-col">
        <Link
          href="/"
          aria-current={activeSlug ? undefined : "page"}
          className={cn(
            "mx-2 mt-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
            activeSlug
              ? "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              : "bg-accent font-medium text-accent-foreground",
          )}
        >
          <Layers className="size-3.5 shrink-0" />
          <span className="truncate">All companies</span>
          <span className="tnum ml-auto shrink-0 text-[11px] text-muted-foreground">
            {formatCount(meta.totals.questions)}
          </span>
        </Link>
      </div>
      <CompanyList activeSlug={activeSlug} />
    </aside>
  );
}

export function CompanySidebarSheet({
  open,
  onOpenChange,
  activeSlug,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeSlug?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[19rem] gap-0 p-0">
        <SheetHeader className="border-b border-border px-3 py-3">
          <SheetTitle className="text-sm">Companies</SheetTitle>
        </SheetHeader>
        <Link
          href="/"
          onClick={() => onOpenChange(false)}
          className={cn(
            "mx-2 mt-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
            activeSlug
              ? "text-muted-foreground hover:bg-accent/60"
              : "bg-accent font-medium text-accent-foreground",
          )}
        >
          <Layers className="size-3.5 shrink-0" />
          All companies
          <span className="tnum ml-auto text-[11px] text-muted-foreground">
            {formatCount(meta.totals.questions)}
          </span>
        </Link>
        <div className="min-h-0 flex-1">
          <CompanyList activeSlug={activeSlug} onNavigate={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
