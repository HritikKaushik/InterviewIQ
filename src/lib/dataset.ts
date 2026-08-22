/**
 * Typed view over the generated dataset.
 *
 * The generated JSON is index-addressed and tuple-shaped to keep the payload
 * small; this module hydrates it once per bundle into ergonomic objects.
 * Hydration is ~3.4k objects and runs in well under a millisecond.
 */
import companiesJson from "@/data/generated/companies.json";
import metaJson from "@/data/generated/meta.json";
import questionStatsJson from "@/data/generated/question-stats.json";
import questionsJson from "@/data/generated/questions.json";
import topicsJson from "@/data/generated/topics.json";

export type Difficulty = 0 | 1 | 2;

export const DIFFICULTIES = [
  { id: 0 as Difficulty, label: "Easy", token: "easy" },
  { id: 1 as Difficulty, label: "Medium", token: "medium" },
  { id: 2 as Difficulty, label: "Hard", token: "hard" },
] as const;

export const DIFFICULTY_LABEL = ["Easy", "Medium", "Hard"] as const;

export type PeriodId = "d30" | "m3" | "m6" | "gt6m" | "all";

/**
 * Windows exactly as the upstream dataset organises them. `d30`..`m6` are
 * cumulative rather than disjoint and in practice nest, but the source does not
 * guarantee it (one company has rows in its 30-day file and an empty all-time
 * file), so no window is ever derived from another. `all` is built as the union
 * of every window; `gt6m` is upstream's separate "More Than Six Months" list.
 * Labels mirror the source folder names rather than re-describing them.
 */
export const PERIODS = [
  { id: "all" as PeriodId, label: "All time", short: "All", hint: "Every problem the dataset lists for this company" },
  { id: "d30" as PeriodId, label: "30 days", short: "30d", hint: "Asked in the last 30 days" },
  { id: "m3" as PeriodId, label: "3 months", short: "3mo", hint: "Asked in the last 3 months" },
  { id: "m6" as PeriodId, label: "6 months", short: "6mo", hint: "Asked in the last 6 months" },
  { id: "gt6m" as PeriodId, label: "6+ months", short: "6mo+", hint: "Upstream's separate \"More Than Six Months\" list" },
] as const;

export const PERIOD_IDS = PERIODS.map((p) => p.id);
export const PERIOD_ORDER: PeriodId[] = ["d30", "m3", "m6", "gt6m", "all"];

export interface Question {
  /** Index into the global question table; the join key for every other file. */
  index: number;
  slug: string;
  title: string;
  difficulty: Difficulty;
  /**
   * Acceptance rate as a percentage, derived from the source's undocumented
   * pre-scaled `Acceptance Rate` column (see meta.acceptanceScale).
   */
  acceptance: number;
  topics: number[];
  url: string;
  /** Number of companies whose all-time list contains this problem. */
  companyCount: number;
  /** Highest frequency this problem reaches at any single company. */
  maxFrequency: number;
  /** Mean frequency across the companies that list it. */
  avgFrequency: number;
  /** Company indices of the three highest-frequency companies. */
  topCompanies: number[];
}

export interface CompanySummary {
  index: number;
  slug: string;
  name: string;
  counts: Record<PeriodId, number>;
  /** [easy, medium, hard] over the all-time window. */
  breakdown: [number, number, number];
  /** Convenience: all-time question count. */
  total: number;
}

export interface DatasetMeta {
  sourceRepo: string;
  sourceSha: string;
  sourceCommittedAt: string;
  generatedAt: string;
  acceptanceScale: number;
  totals: {
    companies: number;
    companiesWithData: number;
    questions: number;
    topics: number;
    rows: number;
  };
}

type QuestionTuple = [string, string, number, number, number[]];
type CompanyTuple = [string, string, number[], number[]];
type StatsTuple = [number, number, number, number, number, number];

export const meta = metaJson as DatasetMeta;
export const topics = topicsJson as string[];

export const questions: Question[] = (questionsJson.rows as QuestionTuple[]).map(
  ([slug, title, difficulty, acceptance, topicIds], index) => {
    const [companyCount, maxFrequency, avgFrequency, t0, t1, t2] = (
      questionStatsJson.rows as StatsTuple[]
    )[index];
    return {
      index,
      slug,
      title,
      difficulty: difficulty as Difficulty,
      acceptance,
      topics: topicIds,
      url: `https://leetcode.com/problems/${slug}/`,
      companyCount,
      maxFrequency,
      avgFrequency,
      topCompanies: [t0, t1, t2].filter((i) => i >= 0),
    };
  },
);

export const companies: CompanySummary[] = (companiesJson.rows as CompanyTuple[]).map(
  ([slug, name, counts, breakdown], index) => ({
    index,
    slug,
    name,
    counts: {
      d30: counts[0],
      m3: counts[1],
      m6: counts[2],
      gt6m: counts[3],
      all: counts[4],
    },
    breakdown: breakdown as [number, number, number],
    total: counts[4],
  }),
);

export const companyBySlug = new Map(companies.map((c) => [c.slug, c]));

/** Companies that actually have problems, ordered by all-time count. */
export const rankedCompanies = companies
  .filter((c) => c.total > 0)
  .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "en"));

/** Topics that appear on at least one problem, with their usage counts. */
export const topicUsage: { id: number; name: string; count: number }[] = (() => {
  const counts = new Array<number>(topics.length).fill(0);
  for (const q of questions) for (const t of q.topics) counts[t]++;
  return topics
    .map((name, id) => ({ id, name, count: counts[id] }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "en"));
})();

/** Lazily fetched: the full problem → companies index (all-time window). */
let reversePromise: Promise<number[][]> | null = null;
export function loadQuestionCompanies(): Promise<number[][]> {
  reversePromise ??= import("@/data/generated/question-companies.json").then(
    (m) => (m.default as { rows: number[][] }).rows,
  );
  return reversePromise;
}
