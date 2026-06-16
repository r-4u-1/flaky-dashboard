import { ComparedTest, Comparison, FlakySnapshot } from "./types.js";

export function compareSnapshots(
  before: FlakySnapshot,
  after: FlakySnapshot
): Comparison {
  const beforeMap = new Map(before.tests.map((t) => [t.testSK, t]));
  const afterMap = new Map(after.tests.map((t) => [t.testSK, t]));
  const allKeys = new Set<number>([...beforeMap.keys(), ...afterMap.keys()]);

  const tests: ComparedTest[] = [];
  let fixedCount = 0;
  let improvedCount = 0;
  let regressedCount = 0;
  let newFlakyCount = 0;

  for (const key of allKeys) {
    const b = beforeMap.get(key);
    const a = afterMap.get(key);
    const beforeFlaky = b?.flaky ?? 0;
    const afterFlaky = a?.flaky ?? 0;
    const flakyDelta = afterFlaky - beforeFlaky;

    let status: ComparedTest["status"] = "unchanged";
    if (!b && a) {
      status = afterFlaky > 0 ? "new" : "unchanged";
      if (afterFlaky > 0) newFlakyCount++;
    } else if (b && !a) {
      status = "removed";
    } else if (beforeFlaky > 0 && afterFlaky === 0) {
      status = "fixed";
      fixedCount++;
    } else if (flakyDelta < 0) {
      status = "improved";
      improvedCount++;
    } else if (flakyDelta > 0) {
      status = "regressed";
      regressedCount++;
    }

    // Only surface tests that are interesting (flaky on either side).
    if (beforeFlaky === 0 && afterFlaky === 0) continue;

    tests.push({
      testSK: key,
      testName: a?.testName ?? b?.testName ?? "(unknown)",
      beforeFlaky,
      afterFlaky,
      flakyDelta,
      beforeFlakyRate: b?.flakyRate ?? 0,
      afterFlakyRate: a?.flakyRate ?? 0,
      beforePassRate: b?.passRate ?? 0,
      afterPassRate: a?.passRate ?? 0,
      status,
    });
  }

  tests.sort(
    (x, y) => Math.abs(y.flakyDelta) - Math.abs(x.flakyDelta) || y.afterFlaky - x.afterFlaky
  );

  const round = (n: number) => Math.round(n * 10) / 10;

  return {
    app: after.app,
    appName: after.appName,
    before: { date: before.date, summary: before.summary },
    after: { date: after.date, summary: after.summary },
    delta: {
      passRate: round(after.summary.passRate - before.summary.passRate),
      flakyRate: round(after.summary.flakyRate - before.summary.flakyRate),
      flakyTestCount:
        after.summary.flakyTestCount - before.summary.flakyTestCount,
      fixedCount,
      improvedCount,
      regressedCount,
      newFlakyCount,
    },
    tests,
  };
}
