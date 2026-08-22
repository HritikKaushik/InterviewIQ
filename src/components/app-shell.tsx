"use client";

import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { CompanySidebar, CompanySidebarSheet } from "@/components/company-sidebar";
import { meta } from "@/lib/dataset";
import { SOURCE_ATTRIBUTION, SOURCE_REPO } from "@/lib/links";
import { formatCount } from "@/lib/format";

export function AppShell({
  activeSlug,
  children,
}: {
  activeSlug?: string;
  children: React.ReactNode;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <AppHeader onOpenSidebar={() => setSheetOpen(true)} />
      <div className="flex flex-1">
        <CompanySidebar activeSlug={activeSlug} />
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
      <CompanySidebarSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        activeSlug={activeSlug}
      />
      <SiteFooter />
    </>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border px-4 py-5 text-xs text-muted-foreground sm:px-5">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Data sourced from{" "}
          <a
            href={SOURCE_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            {SOURCE_ATTRIBUTION}
          </a>
          . Problem links point to leetcode.com.
        </p>
        <p className="tnum text-muted-foreground">
          {formatCount(meta.totals.questions)} problems ·{" "}
          {formatCount(meta.totals.companiesWithData)} companies · snapshot{" "}
          {meta.sourceSha.slice(0, 7)}
        </p>
      </div>
    </footer>
  );
}
