/**
 * Pure filtering / sorting / search helpers shared by the all-companies view
 * and the per-company view. Kept free of React so it can be memoised cheaply.
 */
import { type Difficulty, type Question, questions, topics } from "./dataset";
import type { StudyStatus } from "./study";

/** One rendered row. `frequency` is only defined in a company view. */
export interface Row {
  question: Question;
  frequency?: number;
}

export type SortId = "frequency" | "companies" | "difficulty" | "title" | "acceptance";

export const COMPANY_SORTS: { id: SortId; label: string }[] = [
  { id: "frequency", label: "Frequency" },
  { id: "difficulty", label: "Difficulty" },
  { id: "acceptance", label: "Acceptance" },
  { id: "title", label: "Title" },
];

export const GLOBAL_SORTS: { id: SortId; label: string }[] = [
  { id: "companies", label: "Companies" },
  { id: "frequency", label: "Peak frequency" },
  { id: "difficulty", label: "Difficulty" },
  { id: "acceptance", label: "Acceptance" },
  { id: "title", label: "Title" },
];

/**
 * Lowercased search corpus, built once. Rebuilding this per keystroke is the
 * single most expensive thing a naive implementation does, so it lives at
 * module scope alongside the dataset it describes.
 */
const HAYSTACK: string[] = questions.map((q) =>
  `${q.title} ${q.slug} ${q.topics.map((t) => topics[t]).join(" ")}`.toLowerCase(),
);

export function parseTerms(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function matchesQuery(index: number, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const hay = HAYSTACK[index];
  for (const term of terms) if (!hay.includes(term)) return false;
  return true;
}

export interface FilterState {
  query: string;
  difficulties: Difficulty[];
  topics: number[];
  statuses: StudyStatus[];
  sort: SortId;
  desc: boolean;
}

export interface FilterInput extends FilterState {
  rows: Row[];
  studyOf: (slug: string) => StudyStatus;
}

export function applyFilters({
  rows,
  query,
  difficulties,
  topics: topicFilter,
  statuses,
  sort,
  desc,
  studyOf,
}: FilterInput): Row[] {
  const terms = parseTerms(query);
  const diffSet = difficulties.length ? new Set(difficulties) : null;
  const statusSet = statuses.length ? new Set(statuses) : null;

  const out: Row[] = [];
  for (const row of rows) {
    const q = row.question;
    if (diffSet && !diffSet.has(q.difficulty)) continue;
    if (topicFilter.length) {
      // A problem must carry every selected topic (intersection, not union) -
      // this is what makes stacking topics actually narrow the list.
      let ok = true;
      for (const t of topicFilter) {
        if (!q.topics.includes(t)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
    }
    if (statusSet && !statusSet.has(studyOf(q.slug))) continue;
    if (!matchesQuery(q.index, terms)) continue;
    out.push(row);
  }

  return sortRows(out, sort, desc);
}

export function sortRows(rows: Row[], sort: SortId, desc: boolean): Row[] {
  const dir = desc ? -1 : 1;
  const freq = (r: Row) => r.frequency ?? r.question.maxFrequency;
  const byTitle = (a: Row, b: Row) =>
    a.question.title.localeCompare(b.question.title, "en");

  const cmp: (a: Row, b: Row) => number = (() => {
    switch (sort) {
      case "frequency":
        return (a, b) => (freq(a) - freq(b)) * dir || byTitle(a, b);
      case "companies":
        return (a, b) =>
          (a.question.companyCount - b.question.companyCount) * dir ||
          b.question.maxFrequency - a.question.maxFrequency ||
          byTitle(a, b);
      case "difficulty":
        return (a, b) =>
          (a.question.difficulty - b.question.difficulty) * dir ||
          freq(b) - freq(a) ||
          byTitle(a, b);
      case "acceptance":
        return (a, b) =>
          (a.question.acceptance - b.question.acceptance) * dir || byTitle(a, b);
      case "title":
        return (a, b) => byTitle(a, b) * dir;
    }
  })();

  return rows.sort(cmp);
}

/** Difficulty tallies for the currently visible rows. */
export function tally(rows: Row[]): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0];
  for (const r of rows) out[r.question.difficulty]++;
  return out;
}

/** Expands a flat [questionIndex, frequency, ...] array into rows. */
export function rowsFromPairs(pairs: number[]): Row[] {
  const out: Row[] = new Array(pairs.length / 2);
  for (let i = 0, r = 0; i < pairs.length; i += 2, r++) {
    out[r] = { question: questions[pairs[i]], frequency: pairs[i + 1] };
  }
  return out;
}

/** Every problem in the dataset, for the all-companies view. */
export const ALL_ROWS: Row[] = questions.map((question) => ({ question }));
