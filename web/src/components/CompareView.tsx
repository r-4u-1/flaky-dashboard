import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import { Comparison } from "../types";

export function CompareView({ cmp }: { cmp: Comparison }) {
  return (
    <div>
      <DeltaCards cmp={cmp} />
      <div className="grid-2">
        <div className="card">
          <RateComparisonChart cmp={cmp} />
        </div>
        <div className="card">
          <MoversChart cmp={cmp} />
        </div>
      </div>
      <CompareTable cmp={cmp} />
    </div>
  );
}

function sign(n: number, unit = ""): string {
  const v = `${Math.abs(n)}${unit}`;
  if (n > 0) return `+${n}${unit}`;
  if (n < 0) return `-${v}`;
  return `0${unit}`;
}

function DeltaCards({ cmp }: { cmp: Comparison }) {
  const d = cmp.delta;
  const cards = [
    {
      label: "Pass rate change",
      value: sign(d.passRate, " pp"),
      tone: d.passRate >= 0 ? "ok" : "bad",
      sub: `${cmp.before.summary.passRate}% → ${cmp.after.summary.passRate}%`,
    },
    {
      label: "Flaky rate change",
      value: sign(d.flakyRate, " pp"),
      tone: d.flakyRate <= 0 ? "ok" : "bad",
      sub: `${cmp.before.summary.flakyRate}% → ${cmp.after.summary.flakyRate}%`,
    },
    {
      label: "Flaky tests change",
      value: sign(d.flakyTestCount),
      tone: d.flakyTestCount <= 0 ? "ok" : "bad",
      sub: `${cmp.before.summary.flakyTestCount} → ${cmp.after.summary.flakyTestCount}`,
    },
    { label: "Fixed", value: d.fixedCount, tone: "ok", sub: "flaky → stable" },
    { label: "Improved", value: d.improvedCount, tone: "ok", sub: "less flaky" },
    { label: "Regressed / new", value: d.regressedCount + d.newFlakyCount, tone: "bad", sub: "more / newly flaky" },
  ];
  return (
    <div className="stat-grid wide">
      {cards.map((c) => (
        <div key={c.label} className={`stat ${c.tone}`}>
          <div className="stat-value">{c.value}</div>
          <div className="stat-label">{c.label}</div>
          <div className="stat-sub">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

function RateComparisonChart({ cmp }: { cmp: Comparison }) {
  const options: Highcharts.Options = {
    chart: { type: "column", backgroundColor: "transparent", height: 340 },
    title: { text: "Before vs after", style: { fontSize: "14px" } },
    credits: { enabled: false },
    xAxis: { categories: ["Pass rate", "Flaky rate"] },
    yAxis: { title: { text: "%" }, max: 100 },
    plotOptions: {
      column: { animation: { duration: 1100 }, borderRadius: 4, grouping: true },
    },
    tooltip: { valueSuffix: "%" },
    series: [
      {
        type: "column",
        name: cmp.before.date,
        color: "#94a3b8",
        data: [cmp.before.summary.passRate, cmp.before.summary.flakyRate],
      },
      {
        type: "column",
        name: cmp.after.date,
        color: "#6366f1",
        data: [cmp.after.summary.passRate, cmp.after.summary.flakyRate],
      },
    ],
  };
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

function MoversChart({ cmp }: { cmp: Comparison }) {
  const movers = cmp.tests.slice(0, 12);
  const options: Highcharts.Options = {
    chart: { type: "bar", backgroundColor: "transparent", height: 340 },
    title: { text: "Biggest movers (flaky executions)", style: { fontSize: "14px" } },
    credits: { enabled: false },
    xAxis: { categories: movers.map((t) => shorten(t.testName)), labels: { style: { fontSize: "10px" } } },
    yAxis: { title: { text: "Flaky executions" }, allowDecimals: false },
    plotOptions: { bar: { animation: { duration: 1100 }, borderRadius: 3, grouping: true } },
    series: [
      { type: "bar", name: cmp.before.date, color: "#cbd5e1", data: movers.map((t) => t.beforeFlaky) },
      { type: "bar", name: cmp.after.date, color: "#f59e0b", data: movers.map((t) => t.afterFlaky) },
    ],
  };
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

function CompareTable({ cmp }: { cmp: Comparison }) {
  return (
    <div className="card">
      <h3>Per-test comparison ({cmp.tests.length} flaky-involved tests)</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Test</th>
              <th>Status</th>
              <th className="num">Flaky {cmp.before.date}</th>
              <th className="num">Flaky {cmp.after.date}</th>
              <th className="num">Δ</th>
              <th className="num">Pass % before → after</th>
            </tr>
          </thead>
          <tbody>
            {cmp.tests.map((t) => (
              <tr key={t.testSK}>
                <td className="test-name" title={t.testName}>{t.testName}</td>
                <td><span className={`badge ${statusTone(t.status)}`}>{t.status}</span></td>
                <td className="num">{t.beforeFlaky}</td>
                <td className="num">{t.afterFlaky}</td>
                <td className={`num strong ${t.flakyDelta <= 0 ? "good" : "flaky"}`}>
                  {t.flakyDelta > 0 ? `+${t.flakyDelta}` : t.flakyDelta}
                </td>
                <td className="num muted">{t.beforePassRate}% → {t.afterPassRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statusTone(s: string): string {
  if (s === "fixed" || s === "improved") return "ok";
  if (s === "regressed" || s === "new") return "bad";
  if (s === "removed") return "neutral";
  return "warn";
}

function shorten(name: string): string {
  if (name.length <= 32) return name;
  return "…" + name.slice(-31);
}
