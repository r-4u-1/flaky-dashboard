import { AppInfo } from "./types";

export interface AppConfig {
  key: string;
  name: string;
  pipeline: string;
  org: string;
  project: string;
}

const APPS_KEY = "flaky_apps";
const PAT_KEY = "flaky_pat";
const WORKFLOW_KEY = "flaky_workflow";

export const DEFAULT_WORKFLOW = "Build";

export function loadApps(): AppConfig[] {
  try {
    return JSON.parse(localStorage.getItem(APPS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveApps(apps: AppConfig[]): void {
  localStorage.setItem(APPS_KEY, JSON.stringify(apps));
}

export function loadPat(): string {
  return localStorage.getItem(PAT_KEY) ?? "";
}

export function savePat(pat: string): void {
  localStorage.setItem(PAT_KEY, pat);
}

export function loadWorkflow(): string {
  return localStorage.getItem(WORKFLOW_KEY) ?? DEFAULT_WORKFLOW;
}

export function saveWorkflow(w: string): void {
  localStorage.setItem(WORKFLOW_KEY, w);
}

export function appsToAppInfo(apps: AppConfig[], snapshots: Record<string, string[]>): AppInfo[] {
  return apps.map((a) => ({ ...a, snapshots: snapshots[a.key] ?? [] }));
}
