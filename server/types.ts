export interface FlakyTest {
  testSK: number;
  testName: string;
  total: number;
  passed: number;
  failed: number;
  notExecuted: number;
  notImpacted: number;
  flaky: number;
  flakyRate: number; // %
  passRate: number; // %
}

export interface SnapshotSummary {
  totalTests: number; // distinct tests
  totalResults: number; // sum of all executions
  passed: number;
  failed: number;
  flaky: number;
  notExecuted: number;
  notImpacted: number;
  passRate: number; // %
  flakyRate: number; // % of results that were flaky
  flakyTestCount: number; // distinct tests with flaky > 0
}

export interface FlakySnapshot {
  app: string;
  appName: string;
  pipeline: string;
  workflow: string;
  date: string; // YYYY-MM-DD
  fetchedAt: string; // ISO
  mock: boolean;
  summary: SnapshotSummary;
  tests: FlakyTest[]; // sorted, flakiest first
}

export interface ComparedTest {
  testSK: number;
  testName: string;
  beforeFlaky: number;
  afterFlaky: number;
  flakyDelta: number;
  beforeFlakyRate: number;
  afterFlakyRate: number;
  beforePassRate: number;
  afterPassRate: number;
  status: "fixed" | "improved" | "regressed" | "new" | "removed" | "unchanged";
}

export interface Comparison {
  app: string;
  appName: string;
  before: { date: string; summary: SnapshotSummary };
  after: { date: string; summary: SnapshotSummary };
  delta: {
    passRate: number; // percentage points
    flakyRate: number;
    flakyTestCount: number;
    fixedCount: number;
    improvedCount: number;
    regressedCount: number;
    newFlakyCount: number;
  };
  tests: ComparedTest[];
}
