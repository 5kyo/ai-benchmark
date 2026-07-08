"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { ScoreView, Weights } from "@ai-benchmark/core";
import type { CompanyRecord } from "../lib/data/types.js";
import { buildRanking, industryAverage } from "../lib/data/build.js";
import { ModelToggle } from "./ModelToggle.js";
import { SignalBars } from "./SignalBars.js";
import { ScorePill } from "./ScorePill.js";

export function RankingView({ companies, weights, models }: { companies: CompanyRecord[]; weights: Weights; models: string[] }) {
  const [view, setView] = useState<ScoreView>("average");
  const rows = useMemo(() => buildRanking(companies, weights, view), [companies, weights, view]);
  const avg = industryAverage(rows);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">종합 순위</h1>
        <ModelToggle models={models} value={view} onChange={setView} />
      </div>
      <div className="panel relative overflow-hidden">
        <div className="scanline" />
        <table className="w-full">
          <tbody>
            {rows.map((r, i) => {
              const delta = avg != null && r.overall != null ? r.overall - avg : null;
              return (
                <tr key={r.slug} className="border-t first:border-t-0"
                    style={{ borderColor: "var(--line)", background: r.isSelf ? "rgba(87,199,212,0.08)" : "transparent" }}>
                  <td className="mono px-4 py-3 text-sm" style={{ color: "var(--muted)", width: 48 }}>
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td className="px-2 py-3">
                    <Link href={`/company/${r.slug}`} className="font-medium hover:text-[var(--signal)]">
                      {r.name}{r.isSelf && <span className="mono ml-2 text-xs" style={{ color: "var(--signal)" }}>US</span>}
                    </Link>
                  </td>
                  <td className="px-2 py-3"><SignalBars axes={r.axes} /></td>
                  <td className="px-4 py-3 text-right"><ScorePill score={r.overall} /></td>
                  <td className="mono px-4 py-3 text-right text-xs" style={{ width: 80, color: "var(--muted)" }}>
                    {delta == null ? "" : `${delta >= 0 ? "+" : ""}${Math.round(delta)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mono mt-3 text-xs" style={{ color: "var(--muted)" }}>
        업계 평균 {avg == null ? "—" : Math.round(avg)} · 우측 값은 평균 대비 · 현재 뷰: {view === "average" ? "모델 평균" : view.model}
      </p>
    </div>
  );
}
