/**
 * Codec between explorer state and query-string parameters.
 *
 * Parameter values are human-readable (`difficulty=medium,hard`) rather than
 * index-based so that shared links stay valid across dataset rebuilds, where
 * numeric topic and question indices can shift.
 */
import { type Difficulty, type PeriodId, topics } from "./dataset";
import type { SortId } from "./explorer";
import type { StudyStatus } from "./study";

export const PARAM = {
  query: "q",
  difficulty: "difficulty",
  period: "period",
  topic: "topic",
  status: "status",
  sort: "sort",
  dir: "dir",
} as const;

const DIFFICULTY_SLUGS = ["easy", "medium", "hard"] as const;

const PERIOD_SLUGS: Record<PeriodId, string> = {
  d30: "30d",
  m3: "3m",
  m6: "6m",
  gt6m: "over6m",
  all: "all",
};
const PERIOD_BY_SLUG = new Map(
  Object.entries(PERIOD_SLUGS).map(([id, slug]) => [slug, id as PeriodId]),
);

const STATUS_SLUGS: Record<StudyStatus, string> = {
  none: "not-started",
  solved: "solved",
  revisiting: "revisiting",
};
const STATUS_BY_SLUG = new Map(
  Object.entries(STATUS_SLUGS).map(([id, slug]) => [slug, id as StudyStatus]),
);

const SORT_IDS: SortId[] = ["frequency", "companies", "difficulty", "title", "acceptance"];

function topicSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const TOPIC_SLUGS = topics.map(topicSlug);
const TOPIC_BY_SLUG = new Map(TOPIC_SLUGS.map((slug, id) => [slug, id]));

const list = (value: string | null) =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function readDifficulties(params: URLSearchParams): Difficulty[] {
  return list(params.get(PARAM.difficulty))
    .map((s) => DIFFICULTY_SLUGS.indexOf(s as (typeof DIFFICULTY_SLUGS)[number]))
    .filter((i): i is Difficulty => i >= 0);
}

export function writeDifficulties(values: Difficulty[]): string | null {
  return values.length ? values.map((d) => DIFFICULTY_SLUGS[d]).join(",") : null;
}

export function readTopics(params: URLSearchParams): number[] {
  return list(params.get(PARAM.topic))
    .map((s) => TOPIC_BY_SLUG.get(s))
    .filter((i): i is number => i !== undefined);
}

export function writeTopics(values: number[]): string | null {
  return values.length ? values.map((t) => TOPIC_SLUGS[t]).join(",") : null;
}

export function readStatuses(params: URLSearchParams): StudyStatus[] {
  return list(params.get(PARAM.status))
    .map((s) => STATUS_BY_SLUG.get(s))
    .filter((s): s is StudyStatus => s !== undefined);
}

export function writeStatuses(values: StudyStatus[]): string | null {
  return values.length ? values.map((s) => STATUS_SLUGS[s]).join(",") : null;
}

export function readPeriod(params: URLSearchParams, fallback: PeriodId = "all"): PeriodId {
  return PERIOD_BY_SLUG.get(params.get(PARAM.period) ?? "") ?? fallback;
}

export function writePeriod(value: PeriodId, fallback: PeriodId = "all"): string | null {
  return value === fallback ? null : PERIOD_SLUGS[value];
}

export function readSort(params: URLSearchParams, fallback: SortId): SortId {
  const raw = params.get(PARAM.sort) as SortId | null;
  return raw && SORT_IDS.includes(raw) ? raw : fallback;
}

/** Sort direction. Every sort defaults to descending except title. */
export function defaultDesc(sort: SortId) {
  return sort !== "title";
}

export function readDesc(params: URLSearchParams, sort: SortId): boolean {
  const raw = params.get(PARAM.dir);
  if (raw === "asc") return false;
  if (raw === "desc") return true;
  return defaultDesc(sort);
}
