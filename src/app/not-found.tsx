import { Compass } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <AppShell>
      <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted/50">
          <Compass className="size-5 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Company not found</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            That company is not in the dataset. Try the company list, or search with{" "}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[11px]">
              &#8984;K
            </kbd>
            .
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/">Browse all companies</Link>
        </Button>
      </div>
    </AppShell>
  );
}
