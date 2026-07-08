"use client";
import type { ScoreView } from "@ai-benchmark/core";

export function ModelToggle({
  models, value, onChange,
}: { models: string[]; value: ScoreView; onChange: (v: ScoreView) => void }) {
  const isAvg = value === "average";
  const current = isAvg ? "average" : value.model;
  const options: { key: string; label: string; view: ScoreView }[] = [
    { key: "average", label: "평균", view: "average" },
    ...models.map((m) => ({ key: m, label: m, view: { model: m } as ScoreView })),
  ];
  return (
    <div className="inline-flex rounded-md border" style={{ borderColor: "var(--line)" }} role="tablist">
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          aria-selected={current === o.key}
          onClick={() => onChange(o.view)}
          className="mono px-3 py-1.5 text-xs"
          style={{
            background: current === o.key ? "var(--signal)" : "transparent",
            color: current === o.key ? "#0e1116" : "var(--muted)",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
