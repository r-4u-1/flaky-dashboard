import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import { FlakySnapshot } from "../types";

const COLORS = {
  passed: "#22c55e",
  failed: "#ef4444",
  flaky: "#f59e0b",
  notExecuted: "#94a3b8",
  notImpacted: "#38bdf8",
};

export function OutcomeDonut({ snap }: { snap: FlakySnapshot }) {
  const s = snap.summary;
  const options: Highcharts.Options = {
    chart: { type: "pie", backgroundColor: "transparent", height: 320 },
    title: { text: "Outcome distribution", style: { fontSize: "14px" } },
    credits: { enabled: false },
    tooltip: { pointFormat: "<b>{point.y}</b> ({point.percentage:.1f}%)" },
    plotOptions: {
      pie: {
        innerSize: "60%",
        animation: { duration: 1100, easing: "easeOutBounce" },
        dataLabels: {
          enabled: true,
          format: "{point.name}: {point.percentage:.0f}%",
          style: { fontSize: "11px" },
        },
      },
    },
    series: [
      {
        type: "pie",
        name: "Results",
        data: [
          { name: "Passed", y: s.passed, color: COLORS.passed },
          { name: "Failed", y: s.failed, color: COLORS.failed },
          { name: "Flaky", y: s.flaky, color: COLORS.flaky },
          { name: "Not executed", y: s.notExecuted, color: COLORS.notExecuted },
          { name: "Not impacted", y: s.notImpacted, color: COLORS.notImpacted },
        ].filter((d) => d.y > 0),
      },
    ],
  };
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

export function TopFlakyBar({ snap }: { snap: FlakySnapshot }) {
  const top = snap.tests.slice(0, 20);
  const options: Highcharts.Options = {
    chart: { type: "bar", backgroundColor: "transparent", height: 560 },
    title: { text: "Top 20 flaky tests (flaky executions)", style: { fontSize: "14px" } },
    credits: { enabled: false },
    xAxis: {
      categories: top.map((t) => shorten(t.testName)),
      labels: { style: { fontSize: "10px" } },
    },
    yAxis: { title: { text: "Flaky executions" }, allowDecimals: false },
    legend: { enabled: false },
    tooltip: {
      formatter: function () {
        const t = top[this.point.index];
        return `<b>${t.testName}</b><br/>Flaky: ${t.flaky} of ${t.total} (${t.flakyRate}%)<br/>Pass rate: ${t.passRate}%`;
      },
    },
    plotOptions: {
      bar: {
        animation: { duration: 1200 },
        colorByPoint: false,
        color: COLORS.flaky,
        borderRadius: 3,
      },
    },
    series: [
      {
        type: "bar",
        name: "Flaky executions",
        data: top.map((t) => t.flaky),
      },
    ],
  };
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

function shorten(name: string): string {
  if (name.length <= 38) return name;
  return "…" + name.slice(-37);
}
