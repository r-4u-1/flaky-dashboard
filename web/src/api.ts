import { AppInfo, Comparison, FlakySnapshot } from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function getApps(): Promise<{ mock: boolean; apps: AppInfo[] }> {
  return json(await fetch("/api/apps"));
}

export async function fetchDay(
  app: string,
  date: string
): Promise<FlakySnapshot> {
  return json(
    await fetch(`/api/fetch/${app}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    })
  );
}

export async function getSnapshot(
  app: string,
  date: string
): Promise<FlakySnapshot> {
  return json(await fetch(`/api/snapshots/${app}/${date}`));
}

export async function getCompare(
  app: string,
  before: string,
  after: string
): Promise<Comparison> {
  return json(
    await fetch(
      `/api/compare/${app}?before=${encodeURIComponent(
        before
      )}&after=${encodeURIComponent(after)}`
    )
  );
}
