import { FlakySnapshot } from "./types";

function snapKey(app: string, date: string): string {
  return `flaky_snap_${app}_${date}`;
}

function indexKey(app: string): string {
  return `flaky_index_${app}`;
}

export function saveSnapshot(snap: FlakySnapshot): void {
  localStorage.setItem(snapKey(snap.app, snap.date), JSON.stringify(snap));
  const dates = listSnapshots(snap.app);
  if (!dates.includes(snap.date)) {
    dates.push(snap.date);
    dates.sort();
    localStorage.setItem(indexKey(snap.app), JSON.stringify(dates));
  }
}

export function readSnapshot(app: string, date: string): FlakySnapshot | null {
  try {
    const raw = localStorage.getItem(snapKey(app, date));
    return raw ? (JSON.parse(raw) as FlakySnapshot) : null;
  } catch {
    return null;
  }
}

export function listSnapshots(app: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(indexKey(app)) ?? "[]");
  } catch {
    return [];
  }
}

export function deleteSnapshot(app: string, date: string): void {
  localStorage.removeItem(snapKey(app, date));
  const dates = listSnapshots(app).filter((d) => d !== date);
  localStorage.setItem(indexKey(app), JSON.stringify(dates));
}

export function allSnapshotDates(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith("flaky_index_")) {
      const app = k.slice("flaky_index_".length);
      result[app] = listSnapshots(app);
    }
  }
  return result;
}
