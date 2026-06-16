import { useEffect, useMemo, useState } from "react";
import { AppInfo, Comparison, ComparedTest, FlakySnapshot } from "./types";
import { fetchDay, getApps, getCompare, getSnapshot } from "./api";
import { StatCards } from "./components/StatCards";
import { OutcomeDonut, TopFlakyBar } from "./components/OutcomeCharts";
import { FlakyTable } from "./components/FlakyTable";
import { CompareView } from "./components/CompareView";
import { FileDropZone } from "./components/FileDropZone";

type Mode = "day" | "compare";

const today = () => new Date().toISOString().slice(0, 10);

function compareSnapshots(before: FlakySnapshot, after: FlakySnapshot): Comparison {
  const beforeMap = new Map(before.tests.map((t) => [t.testSK, t]));
  const afterMap = new Map(after.tests.map((t) => [t.testSK, t]));
  const allKeys = new Set<number>([...beforeMap.keys(), ...afterMap.keys()]);

  const tests: ComparedTest[] = [];
  let fixedCount = 0, improvedCount = 0, regressedCount = 0, newFlakyCount = 0;

  for (const key of allKeys) {
    const b = beforeMap.get(key);
    const a = afterMap.get(key);
    const beforeFlaky = b?.flaky ?? 0;
    const afterFlaky = a?.flaky ?? 0;
    const flakyDelta = afterFlaky - beforeFlaky;

    let status: ComparedTest["status"] = "unchanged";
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

export default function App() {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [mock, setMock] = useState(false);
  const [activeKey, setActiveKey] = useState<string>("");
  const [mode, setMode] = useState<Mode>("day");

  const [snap, setSnap] = useState<FlakySnapshot | null>(null);
  const [cmp, setCmp] = useState<Comparison | null>(null);

  const [fetchDate, setFetchDate] = useState(today());
  const [beforeDate, setBeforeDate] = useState("");
  const [afterDate, setAfterDate] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);

  const activeApp = useMemo(
    () => apps.find((a) => a.key === activeKey),
    [apps, activeKey]
  );

  async function refreshApps(selectKey?: string) {
    const data = await getApps();
    setApps(data.apps);
    setMock(data.mock);
    if (!activeKey && data.apps[0]) setActiveKey(selectKey ?? data.apps[0].key);
  }

  useEffect(() => {
    refreshApps().catch((e) => {
      setError(String(e.message ?? e));
      setOffline(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDroppedFiles(snapshots: FlakySnapshot[]) {
    setOffline(false);
    setError("");
    if (snapshots.length === 1) {
      setSnap(snapshots[0]);
      setCmp(null);
      setMode("day");
    } else {
      setSnap(snapshots[0]);
      setCmp(compareSnapshots(snapshots[0], snapshots[1]));
      setMode("compare");
    }
  }

  // When the active app changes, load its newest snapshot if any.
  useEffect(() => {
    if (!activeApp) return;
    setError("");
    setCmp(null);
    const dates = activeApp.snapshots;
    if (dates.length) {
      const latest = dates[dates.length - 1];
      setAfterDate(latest);
      setBeforeDate(dates.length > 1 ? dates[dates.length - 2] : dates[0]);
      loadSnapshot(activeApp.key, latest);
    } else {
      setSnap(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  async function loadSnapshot(app: string, date: string) {
    try {
      setBusy(true);
      setSnap(await getSnapshot(app, date));
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function onFetch() {
    if (!activeApp) return;
    try {
      setBusy(true);
      setError("");
      const result = await fetchDay(activeApp.key, fetchDate);
      setSnap(result);
      await refreshApps(activeApp.key);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function onCompare() {
    if (!activeApp || !beforeDate || !afterDate) return;
    try {
      setBusy(true);
      setError("");
      setCmp(await getCompare(activeApp.key, beforeDate, afterDate));
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  const dates = activeApp?.snapshots ?? [];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="dot" /> Flaky Test Dashboard
        </div>
        {mock && (
          <span className="mock-pill" title="No PAT configured — sample data">
            MOCK MODE
          </span>
        )}
      </header>

      <nav className="tabs">
        {apps.map((a) => (
          <button
            key={a.key}
            className={`tab ${a.key === activeKey ? "active" : ""}`}
            onClick={() => {
              setActiveKey(a.key);
              setMode("day");
            }}
          >
            {a.name}
            {a.snapshots.length > 0 && (
              <span className="tab-count">{a.snapshots.length}</span>
            )}
          </button>
        ))}
      </nav>

      {activeApp && (
        <section className="toolbar">
          <div className="mode-switch">
            <button
              className={mode === "day" ? "active" : ""}
              onClick={() => setMode("day")}
            >
              Day view
            </button>
            <button
              className={mode === "compare" ? "active" : ""}
              onClick={() => setMode("compare")}
            >
              Compare
            </button>
          </div>

          {mode === "day" ? (
            <div className="controls">
              {dates.length > 0 && (
                <label>
                  Snapshot
                  <select
                    value={snap?.date ?? ""}
                    onChange={(e) => loadSnapshot(activeApp.key, e.target.value)}
                  >
                    {dates.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Fetch date
                <input
                  type="date"
                  value={fetchDate}
                  onChange={(e) => setFetchDate(e.target.value)}
                />
              </label>
              <button className="primary" disabled={busy} onClick={onFetch}>
                {busy ? "Working…" : "Fetch & store"}
              </button>
            </div>
          ) : (
            <div className="controls">
              <label>
                Before
                <select value={beforeDate} onChange={(e) => setBeforeDate(e.target.value)}>
                  {dates.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label>
                After
                <select value={afterDate} onChange={(e) => setAfterDate(e.target.value)}>
                  {dates.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
              <button className="primary" disabled={busy || dates.length < 2} onClick={onCompare}>
                {busy ? "Working…" : "Compare"}
              </button>
            </div>
          )}
        </section>
      )}

      {error && !offline && <div className="error">{error}</div>}

      <main className="content">
        {(offline || mock) && <FileDropZone onFiles={handleDroppedFiles} />}

        {!activeApp && !offline && <Empty text="No apps configured. Edit your .env file." />}

        {(activeApp || (!offline && snap)) && mode === "day" && (
          snap ? (
            <>
              <div className="snap-meta">
                Pipeline <code>{snap.pipeline}</code> · {snap.workflow} ·
                fetched {new Date(snap.fetchedAt).toLocaleString()}
                {snap.mock && " · sample data"}
              </div>
              <StatCards snap={snap} />
              <div className="grid-2">
                <div className="card">
                  <OutcomeDonut snap={snap} />
                </div>
                <div className="card">
                  <TopFlakyBar snap={snap} />
                </div>
              </div>
              <FlakyTable snap={snap} />
            </>
          ) : (
            activeApp
              ? <Empty text={`No stored data for ${activeApp.name}. Pick a date and "Fetch & store".`} />
              : null
          )
        )}

        {(activeApp || (!offline && cmp)) && mode === "compare" && (
          cmp ? (
            <CompareView cmp={cmp} />
          ) : dates.length < 2 ? (
            <Empty text="Fetch at least two days to compare before/after." />
          ) : (
            <Empty text="Choose two snapshots and press Compare." />
          )
        )}
      </main>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}
