import { AppConfig, PAT, WORKFLOW } from "./config.js";
import {
  FlakySnapshot,
  FlakyTest,
  SnapshotSummary,
} from "./types.js";

/** YYYY-MM-DD -> integer 20260131 (DateSK) */
function toDateSK(date: string): number {
  return Number(date.replace(/-/g, ""));
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function testPassRate(t: {
  total: number;
  passed: number;
  notImpacted: number;
  notExecuted: number;
}): number {
  const executed = t.total - t.notExecuted;
  if (executed <= 0) return 0;
  return pct(t.passed + t.notImpacted, executed);
}

/**
 * Build the Analytics OData URL for a single day's TestResultsDaily,
 * grouped per test, for the given pipeline + workflow.
 * Field names follow Microsoft's flaky-test sample report.
 */
export function buildODataUrl(app: AppConfig, date: string): string {
  const dateSK = toDateSK(date);
  const filter =
    `Pipeline/PipelineName eq '${app.pipeline.replace(/'/g, "''")}' ` +
    `and DateSK eq ${dateSK} ` +
    `and Workflow eq '${WORKFLOW}'`;

  const apply =
    `filter(${filter})` +
    `/groupby((TestSK, Test/TestName),` +
    `aggregate(` +
    `ResultCount with sum as TotalCount,` +
    `ResultPassCount with sum as PassedCount,` +
    `ResultFailCount with sum as FailedCount,` +
    `ResultNotExecutedCount with sum as NotExecutedCount,` +
    `ResultNotImpactedCount with sum as NotImpactedCount,` +
    `ResultFlakyCount with sum as FlakyCount))`;

  const base = `https://analytics.dev.azure.com/${encodeURIComponent(
    app.org
  )}/${encodeURIComponent(app.project)}/_odata/v4.0-preview/TestResultsDaily`;

  return `${base}?$apply=${encodeURIComponent(apply)}`;
}

interface ODataRow {
  TestSK?: number;
  TestName?: string;
  Test?: { TestName?: string };
  TotalCount?: number;
  PassedCount?: number;
  FailedCount?: number;
  NotExecutedCount?: number;
  NotImpactedCount?: number;
  FlakyCount?: number;
}

function rowToTest(row: ODataRow): FlakyTest {
  const total = row.TotalCount ?? 0;
  const passed = row.PassedCount ?? 0;
  const failed = row.FailedCount ?? 0;
  const notExecuted = row.NotExecutedCount ?? 0;
  const notImpacted = row.NotImpactedCount ?? 0;
  const flaky = row.FlakyCount ?? 0;
  return {
    testSK: row.TestSK ?? 0,
    testName: row.Test?.TestName ?? row.TestName ?? "(unknown)",
    total,
    passed,
    failed,
    notExecuted,
    notImpacted,
    flaky,
    flakyRate: pct(flaky, total),
    passRate: testPassRate({ total, passed, notImpacted, notExecuted }),
  };
}

function summarize(tests: FlakyTest[]): SnapshotSummary {
  const acc = tests.reduce(
    (s, t) => {
      s.totalResults += t.total;
      s.passed += t.passed;
      s.failed += t.failed;
      s.notExecuted += t.notExecuted;
      s.notImpacted += t.notImpacted;
      s.flaky += t.flaky;
      if (t.flaky > 0) s.flakyTestCount += 1;
      return s;
    },
    {
      totalResults: 0,
      passed: 0,
      failed: 0,
      notExecuted: 0,
      notImpacted: 0,
      flaky: 0,
      flakyTestCount: 0,
    }
  );
  const executed = acc.totalResults - acc.notExecuted;
  return {
    totalTests: tests.length,
    totalResults: acc.totalResults,
    passed: acc.passed,
    failed: acc.failed,
    notExecuted: acc.notExecuted,
    notImpacted: acc.notImpacted,
    flaky: acc.flaky,
    flakyTestCount: acc.flakyTestCount,
    passRate: pct(acc.passed + acc.notImpacted, executed),
    flakyRate: pct(acc.flaky, acc.totalResults),
  };
}

function authHeader(): string {
  // Azure DevOps PATs use Basic auth with an empty username.
  return "Basic " + Buffer.from(":" + PAT).toString("base64");
}

export async function fetchFromAzure(
  app: AppConfig,
  date: string
): Promise<FlakySnapshot> {
  const url = buildODataUrl(app, date);
  const res = await fetch(url, {
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Azure DevOps returned ${res.status} ${res.statusText}. ` +
        `Check the PAT scope (Analytics: Read), org/project, and pipeline name. ${body.slice(
          0,
          300
        )}`
    );
  }

  const json = (await res.json()) as { value?: ODataRow[] };
  const tests = (json.value ?? [])
    .map(rowToTest)
    .sort((a, b) => b.flaky - a.flaky || b.flakyRate - a.flakyRate);

  return {
    app: app.key,
    appName: app.name,
    pipeline: app.pipeline,
    workflow: WORKFLOW,
    date,
    fetchedAt: new Date().toISOString(),
    mock: false,
    summary: summarize(tests),
    tests,
  };
}

/* ---------------------------------------------------------------- *
 * MOCK MODE                                                         *
 * Generates believable, deterministic-ish data so the whole UI     *
 * works without a PAT. Flakiness gently improves on later dates.   *
 * ---------------------------------------------------------------- */

function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const SUITES = [
  "Checkout.PaymentFlowTests",
  "Cart.DiscountTests",
  "Auth.SessionTests",
  "Search.RankingTests",
  "Profile.AvatarTests",
  "Orders.FulfillmentTests",
  "Inventory.SyncTests",
  "Notifications.EmailTests",
];

export function generateMock(app: AppConfig, date: string): FlakySnapshot {
  const dateSK = toDateSK(date);
  const rand = seeded(
    app.key.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + dateSK
  );
  // Later dates -> lower flakiness, to make comparisons meaningful.
  const dayIndex = (dateSK % 100) % 10;
  const improvement = Math.max(0, 1 - dayIndex * 0.08);

  const count = 45 + Math.floor(rand() * 25);
  const tests: FlakyTest[] = [];
  for (let i = 0; i < count; i++) {
    const suite = SUITES[Math.floor(rand() * SUITES.length)];
    const total = 8 + Math.floor(rand() * 40);
    const baseFlaky = Math.floor(rand() * rand() * 12 * improvement);
    const flaky = Math.min(baseFlaky, total - 1);
    const failed = Math.floor(rand() * 4 * improvement);
    const notExecuted = Math.floor(rand() * 2);
    const notImpacted = Math.floor(rand() * 2);
    const passed = Math.max(
      0,
      total - flaky - failed - notExecuted - notImpacted
    );
    tests.push({
      testSK: 100000 + i,
      testName: `${suite}.Should_${["Handle", "Reject", "Retry", "Render", "Persist"][
        Math.floor(rand() * 5)
      ]}_Case${i + 1}`,
      total,
      passed,
      failed,
      notExecuted,
      notImpacted,
      flaky,
      flakyRate: pct(flaky, total),
      passRate: testPassRate({ total, passed, notImpacted, notExecuted }),
    });
  }
  tests.sort((a, b) => b.flaky - a.flaky || b.flakyRate - a.flakyRate);

  return {
    app: app.key,
    appName: app.name,
    pipeline: app.pipeline,
    workflow: WORKFLOW,
    date,
    fetchedAt: new Date().toISOString(),
    mock: true,
    summary: summarize(tests),
    tests,
  };
}
