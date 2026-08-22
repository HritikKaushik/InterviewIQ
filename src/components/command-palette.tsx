"use client";

import { Building2, ExternalLink, Hash, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DifficultyBadge } from "@/components/difficulty-badge";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { type Question, questions, rankedCompanies } from "@/lib/dataset";
import { parseTerms } from "@/lib/explorer";
import { formatCount } from "@/lib/format";

const CommandPaletteContext = createContext<{ open: () => void }>({ open: () => {} });

export const useCommandPalette = () => useContext(CommandPaletteContext);

/** How many results each group shows before the list gets unusable to scan. */
const LIMIT = 7;

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open: () => setOpen(true) }), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} />
    </CommandPaletteContext.Provider>
  );
}

function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  // cmdk's own fuzzy scorer is quadratic over 3.9k items on every keystroke, so
  // the list is narrowed here first and cmdk is told not to filter again.
  const terms = useMemo(() => parseTerms(query), [query]);

  const companyResults = useMemo(() => {
    if (!terms.length) return rankedCompanies.slice(0, LIMIT);
    return rankedCompanies
      .filter((c) => {
        const name = c.name.toLowerCase();
        return terms.every((t) => name.includes(t));
      })
      .slice(0, LIMIT);
  }, [terms]);

  const questionResults = useMemo(() => {
    if (!terms.length) return [];
    const joined = terms.join(" ");
    const matches: { question: Question; score: number }[] = [];
    for (const question of questions) {
      const hay = question.title.toLowerCase();
      if (!terms.every((t) => hay.includes(t))) continue;
      // Rank by how directly the title answers the query, then by how many
      // companies ask it - alphabetical order would bury "Binary Tree Inorder
      // Traversal" under "All Elements in Two Binary Search Trees".
      const score =
        (hay === joined ? 3000 : 0) +
        (hay.startsWith(joined) ? 1500 : 0) +
        (hay.includes(joined) ? 750 : 0) +
        question.companyCount;
      matches.push({ question, score });
    }
    matches.sort(
      (a, b) => b.score - a.score || a.question.title.localeCompare(b.question.title, "en"),
    );
    return matches.slice(0, LIMIT).map((m) => m.question);
  }, [terms]);

  const go = useCallback(
    (href: string) => {
      onOpenChange(false);
      setQuery("");
      router.push(href);
    },
    [onOpenChange, router],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
      title="Search"
      description="Search companies and problems"
      commandProps={{ shouldFilter: false }}
      className="top-[12vh] translate-y-0 sm:max-w-2xl"
    >
      <CommandInput
        placeholder="Search companies and problems..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>No results found.</CommandEmpty>

        {companyResults.length > 0 && (
          <CommandGroup heading={terms.length ? "Companies" : "Most questions"}>
            {companyResults.map((company) => (
              <CommandItem
                key={company.slug}
                value={`company-${company.slug}`}
                onSelect={() => go(`/company/${company.slug}`)}
                className="gap-2"
              >
                <Building2 className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{company.name}</span>
                <span className="tnum text-xs text-muted-foreground">
                  {formatCount(company.total)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {questionResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Problems">
              {questionResults.map((question) => (
                <CommandItem
                  key={question.slug}
                  value={`question-${question.slug}`}
                  onSelect={() => {
                    onOpenChange(false);
                    setQuery("");
                    window.open(question.url, "_blank", "noopener,noreferrer");
                  }}
                  className="gap-2"
                >
                  <Hash className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{question.title}</span>
                  <DifficultyBadge difficulty={question.difficulty} />
                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Go to">
          <CommandItem value="nav-home" onSelect={() => go("/")} className="gap-2">
            <Home className="size-4 shrink-0 text-muted-foreground" />
            All companies
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
