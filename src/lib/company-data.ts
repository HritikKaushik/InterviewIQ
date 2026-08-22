/**
 * Server-side access to per-company problem lists.
 *
 * These files are read from disk at build time rather than imported so that 470
 * company JSON files never enter the client bundle - each page ships only its
 * own company's rows.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { PeriodId } from "./dataset";

const DIR = path.join(process.cwd(), "src/data/generated/companies");

export interface CompanyData {
  slug: string;
  name: string;
  /** Flat [questionIndex, frequency, …] pairs per window, frequency-descending. */
  periods: Record<PeriodId, number[]>;
}

export function getCompanyData(slug: string): CompanyData | null {
  const file = path.join(DIR, `${slug}.json`);
  // Guard against path traversal via the dynamic route segment.
  if (!file.startsWith(DIR + path.sep) || !fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as CompanyData;
}
