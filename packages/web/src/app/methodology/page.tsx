import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { loadMethodology } from "../../lib/methodology.js";
import { AXIS_INFO, metricLabel, metricDescription } from "../../lib/glossary.js";

export default function MethodologyPage() {
  const root = resolve(process.cwd(), "../..");
  const axes = loadMethodology(resolve(root, "config/weights.yaml"));
  const rubric = readFileSync(resolve(root, "config/rubric/rubric_v1.md"), "utf8");
  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-semibold">평가 방법론</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--muted)" }}>
        종합 점수는 4개 축의 가중 평균입니다. 아래 가중치·지표는 실제 채점에 쓰인 <span className="mono">config/weights.yaml</span>을 그대로 읽어 표시합니다.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {axes.map((a) => (
          <div key={a.axis} className="panel p-4">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="font-display font-semibold">{a.axis}. {AXIS_INFO[a.axis].label}</h2>
              <span className="mono text-sm" style={{ color: "var(--signal)" }}>{Math.round(a.weight * 100)}% · {a.scorer}</span>
            </div>
            <p className="mb-3 text-xs leading-snug" style={{ color: "var(--muted)" }}>{AXIS_INFO[a.axis].summary}</p>
            <ul className="space-y-2">
              {a.metrics.map((m) => (
                <li key={m.key}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm">
                      {metricLabel(m.key)} <span className="mono text-[10px]" style={{ color: "var(--muted)" }}>{m.key}</span>
                    </span>
                    <span className="mono text-xs" style={{ color: "var(--muted)" }}>{Math.round(m.weight * 100)}%</span>
                  </div>
                  <p className="text-xs leading-snug" style={{ color: "var(--muted)" }}>{metricDescription(m.key)}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="panel mt-6 p-4">
        <h2 className="mb-2 font-display text-sm" style={{ color: "var(--muted)" }}>축 C 루브릭</h2>
        <pre className="mono whitespace-pre-wrap text-xs" style={{ color: "var(--text)" }}>{rubric}</pre>
      </div>
    </div>
  );
}
