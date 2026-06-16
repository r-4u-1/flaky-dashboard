import { FlakySnapshot } from "../types";

export function StatCards({ snap }: { snap: FlakySnapshot }) {
  const s = snap.summary;
  const cards = [
    { label: "Pass rate", value: `${s.passRate}%`, tone: rateTone(s.passRate, true) },
    { label: "Flaky rate", value: `${s.flakyRate}%`, tone: rateTone(s.flakyRate, false) },
    { label: "Flaky tests", value: s.flakyTestCount, tone: s.flakyTestCount ? "warn" : "ok" },
    { label: "Total tests", value: s.totalTests, tone: "neutral" },
    { label: "Total runs", value: s.totalResults, tone: "neutral" },
  ];
  return (
    <div className="stat-grid">
      {cards.map((c) => (
        <div key={c.label} className={`stat ${c.tone}`}>
          <div className="stat-value">{c.value}</div>
          <div className="stat-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function rateTone(v: number, higherIsBetter: boolean): string {
  if (higherIsBetter) return v >= 95 ? "ok" : v >= 80 ? "warn" : "bad";
  return v <= 2 ? "ok" : v <= 8 ? "warn" : "bad";
}
