import { useCallback, useEffect, useMemo, useState } from "react";
import { AppInfo, Comparison, FlakySnapshot } from "./types";
import { compareSnapshots, fetchDay, getApps, getSnapshot } from "./api";
import { saveSnapshot } from "./storage";
import { StatCards } from "./components/StatCards";
import { OutcomeDonut, TopFlakyBar } from "./components/OutcomeCharts";
import { FlakyTable } from "./components/FlakyTable";
import { CompareView } from "./components/CompareView";
import { FileDropZone } from "./components/FileDropZone";
import { SettingsPanel } from "./components/SettingsPanel";

type Mode = "day" | "compare";

const today = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [mock, setMock] = useState(false);
  const [activeKey, setActiveKey] = useState<string>("");
  const [mode, setMode] = useState<Mode>("day");
  const [showSettings, setShowSettings] = useState(false);

  const [snap, setSnap] = useState<FlakySnapshot | null>(null);
  const [cmp, setCmp] = useState<Comparison | null>(null);

  const [fetchDate, setFetchDate] = useState(today());
  const [beforeDate, setBeforeDate] = useState("");
  const [afterDate, setAfterDate] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const activeApp = useMemo(() => apps.find((a) => a.key === activeKey), [apps, activeKey]);

  const refreshApps = useCallback((selectKey?: string) => {
    const data = getApps();
    setApps(data.apps);
    setMock(data.mock);
    if (data.apps.length > 0) {
      const key = selectKey ?? activeKey ?? data.apps[0].key;
      setActiveKey(key);
    }
  }, [activeKey]);

  useEffect(() => {
    refreshApps();
  }, []);

  function handleDroppedFiles(snapshots: FlakySnapshot[]) {
    setError("");
    snapshots.forEach(saveSnapshot);
    refreshApps();
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

  useEffect(() => {
    if (!activeApp) return;
    setError("");
    setCmp(null);
    const dates = activeApp.snapshots;
    if (dates.length) {
      const latest = dates[dates.length - 1];
      setAfterDate(latest);
      setBeforeDate(dates.length > 1 ? dates[dates.length - 2] : dates[0]);
      const stored = getSnapshot(activeApp.key, latest);
      if (stored) setSnap(stored);
      else setSnap(null);
    } else {
      setSnap(null);
    }
  }, [activeKey]);

  async function onFetch() {
    if (!activeApp) return;
    try {
      setBusy(true);
      setError("");
      const result = await fetchDay(activeApp.key, fetchDate);
      setSnap(result);
      refreshApps(activeApp.key);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  function onCompare() {
    if (!activeApp || !beforeDate || !afterDate) return;
    try {
      setError("");
      const before = getSnapshot(activeApp.key, beforeDate);
      const after = getSnapshot(activeApp.key, afterDate);
      if (!before || !after) throw new Error("Both snapshots must be fetched first.");
      setCmp(compareSnapshots(before, after));
    } catch (e) {
      setError(String((e as Error).message));
    }
  }

  const dates = activeApp?.snapshots ?? [];
  const noApps = apps.length === 0;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="dot" /> Flaky Test Dashboard
        </div>
        <div className="topbar-right">
          {mock && (
            <span className="mock-pill" title="No PAT configured — sample data">
              MOCK MODE
            </span>
          )}
          <button className="icon-btn" title="Settings" onClick={() => setShowSettings(true)}>
            ⚙
          </button>
        </div>
      </header>

      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onSaved={() => { refreshApps(); setSnap(null); setCmp(null); }}
        />
      )}

      {!noApps && (
        <nav className="tabs">
          {apps.map((a) => (
            <button
              key={a.key}
              className={`tab ${a.key === activeKey ? "active" : ""}`}
              onClick={() => { setActiveKey(a.key); setMode("day"); }}
            >
              {a.name}
              {a.snapshots.length > 0 && <span className="tab-count">{a.snapshots.length}</span>}
            </button>
          ))}
        </nav>
      )}

      {activeApp && (
        <section className="toolbar">
          <div className="mode-switch">
            <button className={mode === "day" ? "active" : ""} onClick={() => setMode("day")}>Day view</button>
            <button className={mode === "compare" ? "active" : ""} onClick={() => setMode("compare")}>Compare</button>
          </div>

          {mode === "day" ? (
            <div className="controls">
              {dates.length > 0 && (
                <label>
                  Snapshot
                  <select
                    value={snap?.date ?? ""}
                    onChange={(e) => {
                      const s = getSnapshot(activeApp.key, e.target.value);
                      if (s) setSnap(s);
                    }}
                  >
                    {dates.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
              )}
              <label>
                Fetch date
                <input type="date" value={fetchDate} onChange={(e) => setFetchDate(e.target.value)} />
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
                  {dates.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label>
                After
                <select value={afterDate} onChange={(e) => setAfterDate(e.target.value)}>
                  {dates.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <button className="primary" disabled={dates.length < 2} onClick={onCompare}>
                Compare
              </button>
            </div>
          )}
        </section>
      )}

      {error && <div className="error">{error}</div>}

      <main className="content">
        <FileDropZone onFiles={handleDroppedFiles} noApps={noApps} />

        {noApps && (
          <div className="empty">
            No apps configured.{" "}
            <button className="link-btn" onClick={() => setShowSettings(true)}>Open Settings</button>{" "}
            to add an app, or drop snapshot JSON files above.
          </div>
        )}

        {activeApp && mode === "day" && (
          snap ? (
            <>
              <div className="snap-meta">
                Pipeline <code>{snap.pipeline}</code> · {snap.workflow} ·
                fetched {new Date(snap.fetchedAt).toLocaleString()}
                {snap.mock && " · sample data"}
              </div>
              <StatCards snap={snap} />
              <div className="grid-2">
                <div className="card"><OutcomeDonut snap={snap} /></div>
                <div className="card"><TopFlakyBar snap={snap} /></div>
              </div>
              <FlakyTable snap={snap} />
            </>
          ) : (
            <Empty text={`No stored data for ${activeApp.name}. Pick a date and "Fetch & store".`} />
          )
        )}

        {activeApp && mode === "compare" && (
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
