import { AppConfig } from "./config";
import { FlakySnapshot, FlakyTest, SnapshotSummary } from "./types";

function toDateSK(date: string): number {
  return Number(date.replace(/-/g, ""));
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function testPassRate(t: { total: number; passed: number; notImpacted: number; notExecuted: number }): number {
  const executed = t.total - t.notExecuted;
  if (executed <= 0) return 0;
  return pct(t.passed + t.notImpacted, executed);
}

export function buildODataUrl(app: AppConfig, date: string, workflow: string): string {
  const dateSK = toDateSK(date);
  const filter =
    `Pipeline/PipelineName eq '${app.pipeline.replace(/'/g, "''")}' ` +
    `and DateSK eq ${dateSK} ` +
    `and Workflow eq '${workflow}'`;

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

  return (
    `https://analytics.dev.azure.com/${encodeURIComponent(app.org)}/${encodeURIComponent(app.project)}` +
    `/_odata/v4.0-preview/TestResultsDaily?$apply=${encodeURIComponent(apply)}`
  );
}

interface ODataRow {
  TestSK?: number;
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
    testName: row.Test?.TestName ?? "(unknown)",
    total, passed, failed, notExecuted, notImpacted, flaky,
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
    { totalResults: 0, passed: 0, failed: 0, notExecuted: 0, notImpacted: 0, flaky: 0, flakyTestCount: 0 }
  );
  const executed = acc.totalResults - acc.notExecuted;
  return {
    totalTests: tests.length,
    ...acc,
    passRate: pct(acc.passed + acc.notImpacted, executed),
    flakyRate: pct(acc.flaky, acc.totalResults),
  };
}

export async function fetchFromAzure(
  app: AppConfig,
  date: string,
  pat: string,
  workflow: string
): Promise<FlakySnapshot> {
  const url = buildODataUrl(app, date, workflow);
  const res = await fetch(url, {
    headers: {
      Authorization: "Basic " + btoa(":" + pat),
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Azure DevOps returned ${res.status} ${res.statusText}. ` +
        `Check the PAT scope (Analytics: Read), org/project, and pipeline name. ${body.slice(0, 300)}`
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
    workflow,
    date,
    fetchedAt: new Date().toISOString(),
    mock: false,
    summary: summarize(tests),
    tests,
  };
}

/* ---------------------------------------------------------------- *
 * MOCK MODE                                                         *
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

export function generateMock(app: AppConfig, date: string, workflow: string): FlakySnapshot {
  const dateSK = toDateSK(date);
  const rand = seeded(
    app.key.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + dateSK
  );
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
    const passed = Math.max(0, total - flaky - failed - notExecuted - notImpacted);
    tests.push({
      testSK: 100000 + i,
      testName: `${suite}.Should_${["Handle", "Reject", "Retry", "Render", "Persist"][Math.floor(rand() * 5)]}_Case${i + 1}`,
      total, passed, failed, notExecuted, notImpacted, flaky,
      flakyRate: pct(flaky, total),
      passRate: testPassRate({ total, passed, notImpacted, notExecuted }),
    });
  }
  tests.sort((a, b) => b.flaky - a.flaky || b.flakyRate - a.flakyRate);

  return {
    app: app.key,
    appName: app.name,
    pipeline: app.pipeline,
    workflow,
    date,
    fetchedAt: new Date().toISOString(),
    mock: true,
    summary: summarize(tests),
    tests,
  };
}
