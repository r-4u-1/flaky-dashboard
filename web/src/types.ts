export interface FlakyTest {
  testSK: number;
  testName: string;
  total: number;
  passed: number;
  failed: number;
  notExecuted: number;
  notImpacted: number;
  flaky: number;
  flakyRate: number;
  passRate: number;
}

export interface SnapshotSummary {
  totalTests: number;
  totalResults: number;
  passed: number;
  failed: number;
  flaky: number;
  notExecuted: number;
  notImpacted: number;
  passRate: number;
  flakyRate: number;
  flakyTestCount: number;
}

export interface FlakySnapshot {
  app: string;
  appName: string;
  pipeline: string;
  workflow: string;
  date: string;
  fetchedAt: string;
  mock: boolean;
  summary: SnapshotSummary;
  tests: FlakyTest[];
}

export interface AppInfo {
  key: string;
  name: string;
  pipeline: string;
  org: string;
  project: string;
  snapshots: string[];
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
    passRate: number;
    flakyRate: number;
    flakyTestCount: number;
    fixedCount: number;
    improvedCount: number;
    regressedCount: number;
    newFlakyCount: number;
  };
  tests: ComparedTest[];
}
