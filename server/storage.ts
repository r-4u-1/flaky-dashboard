import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlakySnapshot } from "./types.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(dir, "..", "data");

function appDir(app: string): string {
  return path.join(DATA_ROOT, app.replace(/[^a-z0-9_-]/gi, "_"));
}

function snapshotPath(app: string, date: string): string {
  return path.join(appDir(app), `${date}.json`);
}

export async function saveSnapshot(snap: FlakySnapshot): Promise<void> {
  const d = appDir(snap.app);
  await fs.mkdir(d, { recursive: true });
  await fs.writeFile(
    snapshotPath(snap.app, snap.date),
    JSON.stringify(snap, null, 2),
    "utf8"
  );
}

export async function readSnapshot(
  app: string,
  date: string
): Promise<FlakySnapshot | null> {
  try {
    const raw = await fs.readFile(snapshotPath(app, date), "utf8");
    return JSON.parse(raw) as FlakySnapshot;
  } catch {
    return null;
  }
}

export async function listSnapshots(app: string): Promise<string[]> {
  try {
    const files = await fs.readdir(appDir(app));
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort(); // ascending YYYY-MM-DD
  } catch {
    return [];
  }
}
