import { AppConfig, loadApps, loadPat, loadWorkflow, appsToAppInfo } from "./config";
import { saveSnapshot, readSnapshot, listSnapshots, allSnapshotDates } from "./storage";
import { fetchFromAzure, generateMock } from "./azure";
import { AppInfo, Comparison, FlakySnapshot } from "./types";

export function getApps(): { mock: boolean; apps: AppInfo[] } {
  const apps = loadApps();
  const pat = loadPat();
  const snapshots = allSnapshotDates();
  return { mock: pat.length === 0, apps: appsToAppInfo(apps, snapshots) };
}

export async function fetchDay(appKey: string, date: string): Promise<FlakySnapshot> {
  const app = loadApps().find((a) => a.key === appKey);
  if (!app) throw new Error("Unknown app");
  const pat = loadPat();
  const workflow = loadWorkflow();
  const snap = pat.length === 0 ? generateMock(app, date, workflow) : await fetchFromAzure(app, date, pat, workflow);
  saveSnapshot(snap);
  return snap;
}

export function getSnapshot(app: string, date: string): FlakySnapshot | null {
  return readSnapshot(app, date);
}

export function getSnapshotDates(app: string): string[] {
  return listSnapshots(app);
}

export function compareSnapshots(before: FlakySnapshot, after: FlakySnapshot): Comparison {
  const beforeMap = new Map(before.tests.map((t) => [t.testSK, t]));
  const afterMap = new Map(after.tests.map((t) => [t.testSK, t]));
  const allKeys = new Set<number>([...beforeMap.keys(), ...afterMap.keys()]);

  const tests = [];
  let fixedCount = 0, improvedCount = 0, regressedCount = 0, newFlakyCount = 0;

  for (const key of allKeys) {
    const b = beforeMap.get(key);
    const a = afterMap.get(key);
    const beforeFlaky = b?.flaky ?? 0;
    const afterFlaky = a?.flaky ?? 0;
    const flakyDelta = afterFlaky - beforeFlaky;

    let status: "fixed" | "improved" | "regressed" | "new" | "removed" | "unchanged" = "unchanged";
    if (!b && a) { status = afterFlaky > 0 ? "new" : "unchanged"; if (afterFlaky > 0) newFlakyCount++; }
    else if (b && !a) { status = "removed"; }
    else if (beforeFlaky > 0 && afterFlaky === 0) { status = "fixed"; fixedCount++; }
    else if (flakyDelta < 0) { status = "improved"; improvedCount++; }
    else if (flakyDelta > 0) { status = "regressed"; regressedCount++; }

    if (beforeFlaky === 0 && afterFlaky === 0) continue;
    tests.push({
      testSK: key,
      testName: a?.testName ?? b?.testName ?? "(unknown)",
      beforeFlaky, afterFlaky, flakyDelta,
      beforeFlakyRate: b?.flakyRate ?? 0,
      afterFlakyRate: a?.flakyRate ?? 0,
      beforePassRate: b?.passRate ?? 0,
      afterPassRate: a?.passRate ?? 0,
      status,
    });
  }

  tests.sort((x, y) => Math.abs(y.flakyDelta) - Math.abs(x.flakyDelta) || y.afterFlaky - x.afterFlaky);
  const round = (n: number) => Math.round(n * 10) / 10;

  return {
    app: after.app,
    appName: after.appName,
    before: { date: before.date, summary: before.summary },
    after: { date: after.date, summary: after.summary },
    delta: {
      passRate: round(after.summary.passRate - before.summary.passRate),
      flakyRate: round(after.summary.flakyRate - before.summary.flakyRate),
      flakyTestCount: after.summary.flakyTestCount - before.summary.flakyTestCount,
      fixedCount, improvedCount, regressedCount, newFlakyCount,
    },
    tests,
  };
}

export type { AppConfig };
