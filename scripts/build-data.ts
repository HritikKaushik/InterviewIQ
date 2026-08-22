/**
 * Normalises the upstream CSV dataset into compact JSON consumed by the app.
 *
 * Everything here is derived strictly from the source files - no field is
 * invented or enriched from any other source. Run `npm run data:build`.
 */
import { parse } from "csv-parse/sync";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, ".data-source");
const OUT_DIR = path.join(ROOT, "src/data/generated");
const OUT_COMPANIES = path.join(OUT_DIR, "companies");

/**
 * The upstream folder names, in the order the dataset numbers them. These are
 * cumulative recency windows rather than disjoint buckets, but the source does
 * NOT actually guarantee the nesting: "Ola Cabs" ships 24 rows in its 30-day
 * file and an empty "5. All.csv". So `all` is rebuilt below as the union of
 * every window instead of being read straight from that one file. `gt6m` is
 * upstream's separate "More Than Six Months" list and is not the complement of
 * `m6`, so it stays its own window.
 */
const PERIODS = [
  { id: "d30", file: "1. Thirty Days" },
  { id: "m3", file: "2. Three Months" },
  { id: "m6", file: "3. Six Months" },
  { id: "gt6m", file: "4. More Than Six Months" },
  { id: "all", file: "5. All" },
] as const;

const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;

/**
 * The upstream `Acceptance Rate` column is stored pre-divided: its observed
 * maximum across the whole dataset is exactly 0.9/95, and every value scales by
 * the same constant. Multiplying by 9500 recovers a percentage (12.5–90.0).
 * The upstream repo documents no scale for this column, so this factor is a
 * derivation, not a documented source value - it is surfaced to users as such.
 */
const ACCEPTANCE_SCALE = 9500;

type SourceRow = {
  Difficulty: string;
  Title: string;
  Frequency: string;
  "Acceptance Rate": string;
  Link: string;
  Topics?: string;
};

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** `https://leetcode.com/problems/two-sum` -> `two-sum` */
function problemSlug(link: string): string {
  const m = link.match(/\/problems\/([^/?#]+)/);
  if (!m) throw new Error(`Unparseable LeetCode link: ${link}`);
  return m[1];
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function readCsv(file: string): SourceRow[] {
  if (!fs.existsSync(file)) return [];
  return parse(fs.readFileSync(file, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  }) as SourceRow[];
}

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: SOURCE_DIR }).toString().trim();
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error("✗ .data-source/ missing - run `npm run data:fetch` first.");
    process.exit(1);
  }

  const companyDirs = fs
    .readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  // ---- Pass 1: build the global problem dictionary -----------------------
  // Title, Difficulty and Topics are invariant per problem across the whole
  // dataset (verified); Acceptance Rate carries float noise, so it is reduced
  // to the median of every observed value for that problem.
  const topicIndex = new Map<string, number>();
  const topics: string[] = [];
  const topicId = (name: string) => {
    let id = topicIndex.get(name);
    if (id === undefined) {
      id = topics.length;
      topics.push(name);
      topicIndex.set(name, id);
    }
    return id;
  };

  type QuestionAcc = {
    slug: string;
    title: string;
    difficulty: number;
    topics: number[];
    acceptanceSamples: number[];
  };
  const questionAcc = new Map<string, QuestionAcc>();
  const conflicts: string[] = [];

  // company -> period -> Map<slug, frequency>
  const perCompany = new Map<string, Map<string, Map<string, number>>>();
  let totalRows = 0;

  for (const dir of companyDirs) {
    const byPeriod = new Map<string, Map<string, number>>();
    for (const period of PERIODS) {
      const rows = readCsv(path.join(SOURCE_DIR, dir, `${period.file}.csv`));
      const entries = new Map<string, number>();
      for (const row of rows) {
        totalRows++;
        const slug = problemSlug(row.Link);
        const difficulty = DIFFICULTIES.indexOf(
          row.Difficulty.trim().toUpperCase() as (typeof DIFFICULTIES)[number],
        );
        if (difficulty < 0) throw new Error(`Unknown difficulty: ${row.Difficulty}`);

        const topicList = (row.Topics ?? "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .map(topicId);

        const existing = questionAcc.get(slug);
        if (!existing) {
          questionAcc.set(slug, {
            slug,
            title: row.Title,
            difficulty,
            topics: topicList,
            acceptanceSamples: [Number(row["Acceptance Rate"])],
          });
        } else {
          if (existing.title !== row.Title) conflicts.push(`title:${slug}`);
          if (existing.difficulty !== difficulty) conflicts.push(`difficulty:${slug}`);
          if (topicList.length > existing.topics.length) existing.topics = topicList;
          existing.acceptanceSamples.push(Number(row["Acceptance Rate"]));
        }

        // Upstream lists a problem at most once per file; last write wins if not.
        entries.set(slug, Number(row.Frequency));
      }
      byPeriod.set(period.id, entries);
    }

    // Backfill the all-time window with anything that appears only in a
    // narrower one. This is a no-op for 469 of 470 companies; without it, the
    // single company whose "5. All.csv" is empty would be treated as having no
    // data at all and would vanish from every listing.
    const all = byPeriod.get("all")!;
    for (const period of PERIODS) {
      if (period.id === "all") continue;
      for (const [slug, frequency] of byPeriod.get(period.id)!) {
        if (!all.has(slug)) all.set(slug, frequency);
      }
    }

    perCompany.set(dir, byPeriod);
  }

  if (conflicts.length) {
    console.error(`✗ ${conflicts.length} field conflicts across files:`, conflicts.slice(0, 10));
    process.exit(1);
  }

  // Stable question ordering: alphabetical by slug so indices are deterministic
  // across rebuilds (keeps generated diffs readable).
  const questions = [...questionAcc.values()].sort((a, b) => a.slug.localeCompare(b.slug, "en"));
  const questionIndex = new Map(questions.map((q, i) => [q.slug, i]));

  // ---- Pass 2: company index + per-company files -------------------------
  const usedSlugs = new Set<string>();
  const companies: {
    slug: string;
    name: string;
    dir: string;
    counts: number[];
    breakdown: number[];
  }[] = [];

  for (const dir of companyDirs) {
    let slug = slugify(dir);
    if (!slug) slug = `company-${companies.length}`;
    if (usedSlugs.has(slug)) {
      let n = 2;
      while (usedSlugs.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
    }
    usedSlugs.add(slug);

    const byPeriod = perCompany.get(dir)!;
    const counts = PERIODS.map((p) => byPeriod.get(p.id)!.size);
    const breakdown = [0, 0, 0];
    for (const s of byPeriod.get("all")!.keys()) {
      breakdown[questions[questionIndex.get(s)!].difficulty]++;
    }
    companies.push({ slug, name: dir, dir, counts, breakdown });
  }

  const companySlugIndex = new Map(companies.map((c, i) => [c.slug, i]));

  fs.rmSync(OUT_COMPANIES, { recursive: true, force: true });
  fs.mkdirSync(OUT_COMPANIES, { recursive: true });

  for (const company of companies) {
    const byPeriod = perCompany.get(company.dir)!;
    // Flat [questionIndex, frequency, …] pairs, ordered by descending
    // frequency so the default "most asked first" view needs no client sort.
    const periods: Record<string, number[]> = {};
    for (const p of PERIODS) {
      const rows = [...byPeriod.get(p.id)!.entries()]
        .map(([slug, freq]) => [questionIndex.get(slug)!, freq] as const)
        .sort((a, b) => b[1] - a[1] || a[0] - b[0]);
      periods[p.id] = rows.flatMap(([qi, freq]) => [qi, Math.round(freq * 10) / 10]);
    }
    fs.writeFileSync(
      path.join(OUT_COMPANIES, `${company.slug}.json`),
      JSON.stringify({ slug: company.slug, name: company.name, periods }),
    );
  }

  // ---- Reverse index: question -> companies (all-time window) ------------
  const reverse: number[][] = questions.map(() => []);
  for (const company of companies) {
    const ci = companySlugIndex.get(company.slug)!;
    for (const [slug, freq] of perCompany.get(company.dir)!.get("all")!) {
      reverse[questionIndex.get(slug)!].push(ci, Math.round(freq * 10) / 10);
    }
  }
  for (const list of reverse) {
    // Sort pairs by descending frequency without unflattening.
    const pairs: [number, number][] = [];
    for (let i = 0; i < list.length; i += 2) pairs.push([list[i], list[i + 1]]);
    pairs.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    list.length = 0;
    for (const [ci, f] of pairs) list.push(ci, f);
  }

  // ---- Emit ---------------------------------------------------------------
  const sourceSha = git(["rev-parse", "HEAD"]);
  const sourceCommittedAt = git(["log", "-1", "--format=%cI"]);

  const write = (name: string, value: unknown) => {
    const file = path.join(OUT_DIR, name);
    fs.writeFileSync(file, JSON.stringify(value));
    return fs.statSync(file).size;
  };

  const sizes: Record<string, number> = {};
  sizes["topics.json"] = write("topics.json", topics);
  sizes["questions.json"] = write("questions.json", {
    rows: questions.map((q) => [
      q.slug,
      q.title,
      q.difficulty,
      Math.round(median(q.acceptanceSamples) * ACCEPTANCE_SCALE * 10) / 10,
      q.topics,
    ]),
  });
  sizes["companies.json"] = write("companies.json", {
    rows: companies.map((c) => [c.slug, c.name, c.counts, c.breakdown]),
  });
  sizes["question-companies.json"] = write("question-companies.json", { rows: reverse });

  // A tiny per-question summary so the all-companies view can render without
  // pulling the full reverse index. Keeps the entry-point payload small; the
  // full index is fetched on demand when a problem's detail panel is opened.
  sizes["question-stats.json"] = write("question-stats.json", {
    rows: reverse.map((list) => {
      let max = 0;
      let sum = 0;
      const count = list.length / 2;
      for (let i = 1; i < list.length; i += 2) {
        if (list[i] > max) max = list[i];
        sum += list[i];
      }
      return [
        count,
        Math.round(max * 10) / 10,
        count ? Math.round((sum / count) * 10) / 10 : 0,
        // indices of the three highest-frequency companies, already sorted
        list[0] ?? -1,
        list[2] ?? -1,
        list[4] ?? -1,
      ];
    }),
  });
  sizes["meta.json"] = write("meta.json", {
    sourceRepo: "https://github.com/liquidslr/leetcode-company-wise-problems",
    sourceSha,
    sourceCommittedAt,
    generatedAt: new Date().toISOString(),
    acceptanceScale: ACCEPTANCE_SCALE,
    totals: {
      companies: companies.length,
      companiesWithData: companies.filter((c) => c.counts[4] > 0).length,
      questions: questions.length,
      topics: topics.length,
      rows: totalRows,
    },
  });

  const companyBytes = fs
    .readdirSync(OUT_COMPANIES)
    .reduce((n, f) => n + fs.statSync(path.join(OUT_COMPANIES, f)).size, 0);

  console.log(`✓ ${companies.length} companies · ${questions.length} questions · ${totalRows} source rows`);
  for (const [name, bytes] of Object.entries(sizes)) {
    console.log(`  ${name.padEnd(26)} ${(bytes / 1024).toFixed(1)} KB`);
  }
  console.log(`  companies/*.json           ${(companyBytes / 1024).toFixed(1)} KB (${companies.length} files)`);
}

main();
