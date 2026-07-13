"use client";
import type { ScoreView } from "@ai-benchmark/core";
import { modelShort } from "../lib/modelColor.js";

export function ModelToggle({
  models, value, onChange,
}: { models: string[]; value: ScoreView; onChange: (v: ScoreView) => void }) {
  const isAvg = value === "average";
  const current = isAvg ? "average" : value.model;
  const options: { key: string; label: string; title?: string; view: ScoreView }[] = [
    { key: "average", label: "평균", view: "average" },
    ...models.map((m) => ({ key: m, label: modelShort(m), title: m, view: { model: m } as ScoreView })),
  ];
  return (
    <div className="inline-flex overflow-hidden rounded-md border" style={{ borderColor: "var(--line)" }} role="tablist">
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          title={o.title}
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
