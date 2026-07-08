"use client";
import { useState } from "react";
import type { CompanyRecord } from "../lib/data/types.js";
import { modelDeltas } from "../lib/data/compare.js";

export function ModelCompareView({ companies, models }: { companies: CompanyRecord[]; models: string[] }) {
  const [slug, setSlug] = useState(companies[0]?.slug ?? "");
  const company = companies.find((c) => c.slug === slug) ?? companies[0];
  const [a, b] = models;
  const rows = company && a && b ? modelDeltas(company, a, b) : [];
  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-semibold">모델 비교</h1>
      <p className="mb-4 text-sm" style={{ color: "var(--muted)" }}>
        같은 사이트를 두 모델이 어떻게 다르게 봤나 (축 C). 편차 큰 지표 상단.
      </p>
      <select value={slug} onChange={(e) => setSlug(e.target.value)}
        className="mono mb-4 rounded border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--line)", color: "var(--text)" }}>
        {companies.map((c) => <option key={c.slug} value={c.slug} style={{ color: "#000" }}>{c.name}</option>)}
      </select>
      {(!a || !b) && <p className="mono text-sm" style={{ color: "var(--muted)" }}>모델이 2개 이상 필요합니다.</p>}
      <div className="panel divide-y" style={{ borderColor: "var(--line)" }}>
        {rows.map((r) => (
          <div key={r.metricKey} className="flex items-center justify-between p-3 text-sm">
            <span className="mono">{r.metricKey}</span>
            <span className="flex items-center gap-4">
              <span className="mono" style={{ color: "#57C7D4" }}>{a} {r.a == null ? "—" : Math.round(r.a)}</span>
              <span className="mono" style={{ color: "#F5A524" }}>{b} {r.b == null ? "—" : Math.round(r.b)}</span>
              <span className="mono font-semibold" style={{ width: 44, textAlign: "right" }}>{r.delta >= 0 ? "+" : ""}{Math.round(r.delta)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
