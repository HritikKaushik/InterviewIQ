/**
 * Independently re-reads every source CSV and asserts the generated JSON
 * reproduces it exactly. This deliberately does NOT share code with
 * build-data.ts - it is a second opinion, not a replay.
 *
 * Run `npm run data:verify`.
 */
import { parse } from "csv-parse/sync";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, ".data-source");
const GEN = path.join(ROOT, "src/data/generated");

const PERIOD_FILES: Record<string, string> = {
  d30: "1. Thirty Days",
  m3: "2. Three Months",
  m6: "3. Six Months",
  gt6m: "4. More Than Six Months",
  all: "5. All",
};
const DIFF = ["EASY", "MEDIUM", "HARD"];

const load = <T,>(name: string): T => JSON.parse(fs.readFileSync(path.join(GEN, name), "utf8"));

const failures: string[] = [];
const check = (ok: boolean, msg: string) => {
  if (!ok) failures.push(msg);
};

function main() {
  const meta = load<{ acceptanceScale: number; totals: Record<string, number> }>("meta.json");
  const questions = load<{ rows: [string, string, number, number, number[]][] }>("questions.json").rows;
  const companies = load<{ rows: [string, string, number[], number[]][] }>("companies.json").rows;
  const reverse = load<{ rows: number[][] }>("question-companies.json").rows;
  const topics = load<string[]>("topics.json");

  const qBySlug = new Map(questions.map((q, i) => [q[0], { q, i }]));
  const cByName = new Map(companies.map((c, i) => [c[1], { c, i }]));

  const dirs = fs
    .readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name);

  check(dirs.length === companies.length, `company count ${companies.length} != ${dirs.length}`);
  check(
    meta.totals.questions === questions.length,
    `meta questions ${meta.totals.questions} != ${questions.length}`,
  );

  let sourceRows = 0;
  const seenSlugs = new Set<string>();
  const reverseExpected = new Map<string, number>(); // `${qi}:${ci}` -> freq

  for (const dir of dirs) {
    const entry = cByName.get(dir);
    if (!entry) {
      failures.push(`missing company in index: ${dir}`);
      continue;
    }
    const { c, i: ci } = entry;
    const generated = JSON.parse(
      fs.readFileSync(path.join(GEN, "companies", `${c[0]}.json`), "utf8"),
    ) as { slug: string; name: string; periods: Record<string, number[]> };

    check(generated.name === dir, `company file name mismatch for ${dir}`);

    const periodIds = Object.keys(PERIOD_FILES);

    // `all` is built as the union of every window, so its expected membership
    // is computed here rather than read from "5. All.csv" alone.
    const expectedAll = new Map<string, number>();
    for (const pid of periodIds) {
      if (pid === "all") continue;
      const p = path.join(SOURCE_DIR, dir, `${PERIOD_FILES[pid]}.csv`);
      if (!fs.existsSync(p)) continue;
      for (const row of parse(fs.readFileSync(p, "utf8"), {
        columns: true,
        skip_empty_lines: true,
        bom: true,
      }) as Record<string, string>[]) {
        const slug = row.Link.match(/\/problems\/([^/?#]+)/)?.[1] ?? "";
        if (!expectedAll.has(slug)) {
          expectedAll.set(slug, Math.round(Number(row.Frequency) * 10) / 10);
        }
      }
    }

    periodIds.forEach((pid, pIdx) => {
      const csvPath = path.join(SOURCE_DIR, dir, `${PERIOD_FILES[pid]}.csv`);
      const rows = fs.existsSync(csvPath)
        ? (parse(fs.readFileSync(csvPath, "utf8"), { columns: true, skip_empty_lines: true, bom: true }) as Record<string, string>[])
        : [];
      sourceRows += rows.length;

      if (pid === "all") {
        // Rows from the file take precedence; anything only in a narrower
        // window is backfilled.
        for (const row of rows) {
          const slug = row.Link.match(/\/problems\/([^/?#]+)/)?.[1] ?? "";
          expectedAll.set(slug, Math.round(Number(row.Frequency) * 10) / 10);
        }
      }

      const expectedCount = pid === "all" ? expectedAll.size : rows.length;
      const flat = generated.periods[pid] ?? [];
      check(
        flat.length / 2 === expectedCount,
        `${dir}/${pid}: generated ${flat.length / 2} rows, expected ${expectedCount}`,
      );
      check(
        c[2][pIdx] === expectedCount,
        `${dir}/${pid}: index count ${c[2][pIdx]} != expected ${expectedCount}`,
      );

      if (pid === "all") {
        const gen = new Map<string, number>();
        for (let k = 0; k < flat.length; k += 2) gen.set(questions[flat[k]][0], flat[k + 1]);
        for (const [slug, freq] of expectedAll) {
          check(gen.get(slug) === freq, `${dir}/all/${slug}: frequency ${gen.get(slug)} != ${freq}`);
          const qe = qBySlug.get(slug);
          if (qe) reverseExpected.set(`${qe.i}:${ci}`, freq);
        }
      }

      // Rebuild the generated period as slug -> frequency and compare to CSV.
      const gen = new Map<string, number>();
      for (let k = 0; k < flat.length; k += 2) gen.set(questions[flat[k]][0], flat[k + 1]);

      // Generated rows must be sorted by descending frequency.
      for (let k = 3; k < flat.length; k += 2) {
        check(flat[k] <= flat[k - 2], `${dir}/${pid}: rows not sorted by frequency`);
      }

      for (const row of rows) {
        const slug = row.Link.match(/\/problems\/([^/?#]+)/)?.[1] ?? "";
        seenSlugs.add(slug);
        const qe = qBySlug.get(slug);
        if (!qe) {
          failures.push(`${dir}/${pid}: question missing from dictionary: ${slug}`);
          continue;
        }
        const [, title, difficulty, acceptance, topicIds] = qe.q;

        check(title === row.Title, `${slug}: title "${title}" != "${row.Title}"`);
        check(
          DIFF[difficulty] === row.Difficulty.trim().toUpperCase(),
          `${slug}: difficulty ${DIFF[difficulty]} != ${row.Difficulty}`,
        );

        const expectedFreq = Math.round(Number(row.Frequency) * 10) / 10;
        if (pid !== "all") {
          check(
            gen.get(slug) === expectedFreq,
            `${dir}/${pid}/${slug}: frequency ${gen.get(slug)} != ${expectedFreq}`,
          );
        }

        // Acceptance is a median over float-noisy samples; assert it lands
        // within one rounding step of this row's own value.
        const rowPct = Number(row["Acceptance Rate"]) * meta.acceptanceScale;
        check(
          Math.abs(acceptance - rowPct) < 0.15,
          `${slug}: acceptance ${acceptance} vs row ${rowPct.toFixed(3)}`,
        );

        const csvTopics = (row.Topics ?? "").split(",").map((t) => t.trim()).filter(Boolean);
        if (csvTopics.length) {
          const genTopics = topicIds.map((t) => topics[t]);
          check(
            csvTopics.length === genTopics.length && csvTopics.every((t) => genTopics.includes(t)),
            `${slug}: topics [${genTopics}] != [${csvTopics}]`,
          );
        }

      }
    });

    // Difficulty breakdown must match the all-time window.
    const breakdown = [0, 0, 0];
    const allFlat = generated.periods.all ?? [];
    for (let k = 0; k < allFlat.length; k += 2) breakdown[questions[allFlat[k]][2]]++;
    check(
      breakdown.join(",") === c[3].join(","),
      `${dir}: breakdown ${c[3]} != ${breakdown}`,
    );
  }

  check(
    sourceRows === meta.totals.rows,
    `meta rows ${meta.totals.rows} != counted ${sourceRows}`,
  );
  check(
    seenSlugs.size === questions.length,
    `dictionary has ${questions.length} questions, CSVs reference ${seenSlugs.size}`,
  );

  // Reverse index must be exactly the all-time edges.
  let reverseCount = 0;
  reverse.forEach((list, qi) => {
    for (let k = 0; k < list.length; k += 2) {
      reverseCount++;
      const key = `${qi}:${list[k]}`;
      check(
        reverseExpected.get(key) === list[k + 1],
        `reverse[${qi}] company ${list[k]}: ${list[k + 1]} != ${reverseExpected.get(key)}`,
      );
    }
  });
  check(
    reverseCount === reverseExpected.size,
    `reverse index has ${reverseCount} edges, expected ${reverseExpected.size}`,
  );

  if (failures.length) {
    console.error(`✗ ${failures.length} verification failures:`);
    for (const f of failures.slice(0, 25)) console.error(`  · ${f}`);
    process.exit(1);
  }
  console.log(
    `✓ verified ${dirs.length} companies · ${questions.length} questions · ${sourceRows} rows · ${reverseCount} company↔question edges`,
  );
}

main();
