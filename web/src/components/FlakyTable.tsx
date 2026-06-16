import { FlakySnapshot } from "../types";

export function FlakyTable({ snap }: { snap: FlakySnapshot }) {
  const top = snap.tests.slice(0, 20);
  return (
    <div className="card">
      <h3>20 most flaky tests — {snap.appName} · {snap.date}</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Test</th>
              <th className="num">Runs</th>
              <th className="num">Passed</th>
              <th className="num">Failed</th>
              <th className="num">Flaky</th>
              <th className="num">Flaky %</th>
              <th className="num">Pass %</th>
            </tr>
          </thead>
          <tbody>
            {top.map((t, i) => (
              <tr key={t.testSK}>
                <td className="muted">{i + 1}</td>
                <td className="test-name" title={t.testName}>{t.testName}</td>
                <td className="num">{t.total}</td>
                <td className="num">{t.passed}</td>
                <td className="num">{t.failed}</td>
                <td className="num strong flaky">{t.flaky}</td>
                <td className="num">
                  <RateBadge value={t.flakyRate} kind="flaky" />
                </td>
                <td className="num">
                  <RateBadge value={t.passRate} kind="pass" />
                </td>
              </tr>
            ))}
            {top.length === 0 && (
              <tr>
                <td colSpan={8} className="muted center">
                  No flaky tests recorded for this day.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RateBadge({ value, kind }: { value: number; kind: "flaky" | "pass" }) {
  let cls = "badge ";
  if (kind === "flaky") cls += value >= 20 ? "bad" : value >= 5 ? "warn" : "ok";
  else cls += value >= 95 ? "ok" : value >= 80 ? "warn" : "bad";
  return <span className={cls}>{value}%</span>;
}
