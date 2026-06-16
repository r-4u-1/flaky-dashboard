import express from "express";
import cors from "cors";
import { APPS, getApp, MOCK, PORT } from "./config.js";
import { fetchFromAzure, generateMock } from "./azure.js";
import { listSnapshots, readSnapshot, saveSnapshot } from "./storage.js";
import { compareSnapshots } from "./compare.js";

const app = express();
app.use(cors());
app.use(express.json());

/** List configured apps + whether snapshots exist. */
app.get("/api/apps", async (_req, res) => {
  const apps = await Promise.all(
    APPS.map(async (a) => ({
      key: a.key,
      name: a.name,
      pipeline: a.pipeline,
      org: a.org,
      project: a.project,
      snapshots: await listSnapshots(a.key),
    }))
  );
  res.json({ mock: MOCK, apps });
});

/** Fetch a day's data from Azure (or mock) and store it. */
app.post("/api/fetch/:app", async (req, res) => {
  const cfg = getApp(req.params.app);
  if (!cfg) return res.status(404).json({ error: "Unknown app" });

  const date: string =
    req.body?.date ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  }
  const forceMock = MOCK || req.body?.mock === true;

  try {
    const snap = forceMock
      ? generateMock(cfg, date)
      : await fetchFromAzure(cfg, date);
    await saveSnapshot(snap);
    res.json(snap);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

/** List stored snapshot dates for an app. */
app.get("/api/snapshots/:app", async (req, res) => {
  if (!getApp(req.params.app))
    return res.status(404).json({ error: "Unknown app" });
  res.json({ dates: await listSnapshots(req.params.app) });
});

/** Get one stored snapshot. */
app.get("/api/snapshots/:app/:date", async (req, res) => {
  const snap = await readSnapshot(req.params.app, req.params.date);
  if (!snap) return res.status(404).json({ error: "Snapshot not found" });
  res.json(snap);
});

/** Compare two stored snapshots. */
app.get("/api/compare/:app", async (req, res) => {
  const beforeDate = String(req.query.before ?? "");
  const afterDate = String(req.query.after ?? "");
  const before = await readSnapshot(req.params.app, beforeDate);
  const after = await readSnapshot(req.params.app, afterDate);
  if (!before || !after) {
    return res
      .status(404)
      .json({ error: "Both before and after snapshots must exist" });
  }
  res.json(compareSnapshots(before, after));
});

app.listen(PORT, () => {
  console.log(
    `Flaky dashboard API on http://localhost:${PORT}  (mode: ${
      MOCK ? "MOCK — no PAT set" : "LIVE Azure DevOps"
    })`
  );
  console.log(`Configured apps: ${APPS.map((a) => a.key).join(", ") || "(none)"}`);
});
