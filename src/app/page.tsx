import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { Explorer } from "@/components/explorer";
import { ExplorerSkeleton } from "@/components/explorer-skeleton";

export default function HomePage() {
  return (
    <AppShell>
      <Suspense fallback={<ExplorerSkeleton />}>
        <Explorer variant="global" />
      </Suspense>
    </AppShell>
  );
}
