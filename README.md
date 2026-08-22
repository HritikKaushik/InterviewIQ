# InterviewIQ

[![CI](https://github.com/HritikKaushik/InterviewIQ/actions/workflows/ci.yml/badge.svg)](https://github.com/HritikKaushik/InterviewIQ/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Live: https://interview-iq-steel.vercel.app**

Company-wise LeetCode interview questions, with fast search, combinable filters
and local progress tracking.

All data comes from
[liquidslr/leetcode-company-wise-problems](https://github.com/liquidslr/leetcode-company-wise-problems).
Nothing is scraped from LeetCode, and no field is invented: the app renders only
what the source CSVs contain.

**470 companies (429 with data) · 3,392 unique problems · 37,714 company-question rows.**

## Setup

```bash
npm install
```

The generated dataset under `src/data/generated/` is committed, so the app runs
immediately after install. Refreshing it requires `git` on your PATH.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run build` | Production build (prerenders all 470 company pages) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate Next's route types, then `tsc --noEmit` |
| `npm run data:update` | Refresh the dataset from upstream and regenerate |
| `npm run data:verify` | Re-read every source CSV and assert the generated JSON matches |

## Updating the dataset

```bash
npm run data:update
```

That runs two steps, which can also be run separately:

1. **`npm run data:fetch`** clones or pulls the upstream repository into
   `.data-source/` (git-ignored).
2. **`npm run data:build`** parses all 2,350 CSVs and writes normalised JSON to
   `src/data/generated/`.

Then confirm nothing drifted and rebuild:

```bash
npm run data:verify
npm run build
```

Use `npm run typecheck` rather than a bare `tsc --noEmit`: the `PageProps` and
`LayoutProps` globals are generated into `.next/types` by `next typegen`, so a
bare `tsc` fails on a clean checkout until a build or dev server has run once.

`data:verify` re-parses every source CSV independently of the build script and
asserts, per company and per window, that row counts, titles, difficulties,
frequencies, topics, acceptance values, sort order and the reverse index all
reproduce the source exactly. It exits non-zero on any mismatch, so it is safe
to run in CI.

## The source data

Each company folder holds five CSVs with the columns
`Difficulty, Title, Frequency, Acceptance Rate, Link, Topics`.

Findings that shaped the data model, all confirmed against the full dataset:

- **Windows are cumulative, not disjoint** - but the nesting is not guaranteed.
  `Thirty Days ⊆ Three Months ⊆ Six Months ⊆ All` holds for 428 of the 429
  companies with data. It fails for exactly one: Ola Cabs ships 24 rows in its
  30-day file and an empty `5. All.csv`. The build therefore treats the all-time
  window as the **union of every window** rather than a read of that one file,
  which is what keeps that company visible instead of silently counting as
  empty. `More Than Six Months` is the source's own separate list and is *not*
  reliably the complement of the six-month window, so it stays its own window.
- **Frequency is scoped to a company *and* a window.** The same problem scores
  differently in different windows, so frequency is stored per company-window
  edge, never globally.
- **`Title` and `Link` are perfectly 1:1** across all 37,714 rows, so the
  LeetCode slug is used as the stable problem key.
- **`Difficulty` and `Topics` never conflict** for a given problem, so they are
  stored once in a global problem dictionary.
- **`Topics` is present on every non-empty row.** It is absent only from the
  1,177 header-only CSV files.
- **There is no question number anywhere in the dataset.** The table shows a
  rank within the current sort instead, and never invents a LeetCode ID.
- **1,177 of 2,350 CSVs are empty**, leaving 41 companies with no problems at
  all. Their pages render a real empty state rather than 404ing.

### About the acceptance rate

The source `Acceptance Rate` column is stored pre-scaled: values run from
0.00132 to 0.00947, and the dataset maximum is exactly `0.9 / 95`. Multiplying
by **9,500** recovers a percentage in the 12.5-90.0 range, and the well-known
problems land where you would expect (Two Sum 55.1%).

That constant is a derivation from the data, not something the source documents.
It is applied in one place (`ACCEPTANCE_SCALE` in `scripts/build-data.ts`),
recorded in `meta.json`, and disclosed in the problem detail panel so it is
never mistaken for a documented source value. The same problem carries slightly
different float values across files, so the median of every observed value is
used.

## Architecture

```
GitHub CSVs  ->  scripts/build-data.ts  ->  src/data/generated/*.json  ->  Next.js
                 scripts/verify-data.ts (independent check)
```

```
scripts/
  fetch-source.mjs        clone/pull the upstream dataset
  build-data.ts           CSV -> normalised JSON
  verify-data.ts          independent correctness check
src/data/generated/
  meta.json               source SHA, commit date, totals, acceptance scale
  topics.json             173 topic names
  questions.json          3,392 problems (slug, title, difficulty, acceptance, topics)
  companies.json          470 companies (slug, name, per-window counts, difficulty split)
  question-stats.json     per problem: company count, peak/average frequency
  question-companies.json reverse index, loaded on demand
  companies/<slug>.json   per-window [problemIndex, frequency] pairs
```

The generated files are index-addressed and tuple-shaped to keep the payload
small; `src/lib/dataset.ts` hydrates them once into typed objects.

Deliberate choices:

- **Per-company files are read from disk at build time**, not imported, so 470
  company JSON files never enter the client bundle. Each page ships only its own
  company's rows.
- **`question-companies.json` (145 KB) is loaded on demand**, only when a problem
  detail panel is opened. The much smaller `question-stats.json` covers what the
  all-companies table needs up front.
- **Rows are virtualised** (`@tanstack/react-virtual`) rather than paginated, so
  browsing feels like one continuous list at 3,392 rows. The company rail is
  virtualised too.
- **Search runs against a lowercased corpus built once at module scope**, and
  filtering runs behind `useDeferredValue` so typing never blocks.
- **No backend, no database, no authentication.** Everything is static.

## URL state

Views are shareable. Filters live in the query string using readable, stable
values rather than indices, so links survive a dataset rebuild:

```
/company/amazon?difficulty=medium&period=3m&topic=dynamic-programming&sort=acceptance
```

| Parameter | Values |
| --- | --- |
| `q` | free text, matched against title, slug and topics |
| `difficulty` | `easy`, `medium`, `hard` (comma-separated) |
| `period` | `30d`, `3m`, `6m`, `over6m`, `all` (company pages only) |
| `topic` | slugified topic names (comma-separated, intersected) |
| `status` | `not-started`, `solved`, `revisiting` |
| `sort` | `frequency`, `companies`, `difficulty`, `acceptance`, `title` |
| `dir` | `asc`, `desc` |

## Keyboard

| Key | Action |
| --- | --- |
| `/` | Focus the question search |
| `Cmd/Ctrl + K` | Command palette (companies and problems) |
| `Enter` / `Space` | Open the focused row's detail panel |
| `Esc` | Close the palette or panel |

## Study progress

Marking a problem cycles Not started -> Solved -> Revisiting. Progress is stored
in `localStorage` under `interviewiq:study:v1`, survives reloads, syncs across tabs,
and can be filtered on. There is no account and nothing leaves the browser.

## Continuous integration and deployment

**CI** (`.github/workflows/ci.yml`) runs on every push and pull request to
`main`:

- `build` - `npm run typecheck`, `npm run lint`, `npm run build`.
- `data` - clones the upstream dataset and runs `npm run data:verify` against
  the committed JSON, so hand-edited or stale generated data fails the build.
  It also warns when upstream has moved on since the last regeneration.

**Dataset refresh** (`.github/workflows/update-dataset.yml`) runs weekly and on
demand. It regenerates from upstream, verifies the result, and opens a pull
request only when something changed, so refreshed data still goes through CI.

**Deployment** is handled by Vercel, which builds and promotes every push to
`main` at https://interview-iq-steel.vercel.app. No configuration or environment variables are needed: the
build prerenders every company page and the dataset is committed, so builds
never depend on GitHub being reachable. Any static-capable Next.js host works
the same way.

```bash
npx vercel        # preview
npx vercel --prod # production
```

## License

Source code is MIT licensed - see [LICENSE](LICENSE).

The bundled dataset is not covered by that license: it is derived from an
upstream repository that publishes none, is redistributed here with
attribution, and no ownership of it is claimed.

## Attribution

Data sourced from
[liquidslr/leetcode-company-wise-problems](https://github.com/liquidslr/leetcode-company-wise-problems).
Problem links point to the original problems on leetcode.com. No problem
statements are reproduced.
