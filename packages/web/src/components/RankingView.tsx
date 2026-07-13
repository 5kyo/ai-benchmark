"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Axis, ScoreView, Weights } from "@ai-benchmark/core";
import type { CompanyRecord } from "../lib/data/types.js";
import { buildRanking, industryAverage } from "../lib/data/build.js";
import { AXIS_INFO, categoryLabel } from "../lib/glossary.js";
import { scoreColor } from "../lib/scoreColor.js";
import { modelColor, modelShort } from "../lib/modelColor.js";
import { ModelToggle } from "./ModelToggle.js";
import { ScorePill } from "./ScorePill.js";

const AXES: Axis[] = ["A", "B", "C", "D"];

function Chip({ children, accent }: { children: React.ReactNode; accent?: "signal" | "muted" }) {
  const color = accent === "signal" ? "var(--signal)" : "var(--muted)";
  return (
    <span
      className="mono rounded px-1.5 py-0.5 text-[11px] leading-none"
      style={{ color, border: `1px solid ${accent === "signal" ? "var(--signal)" : "var(--line)"}` }}
    >
      {children}
    </span>
  );
}

/** 0~100 점수를 숫자 + 가는 미터바로 표시. */
function AxisMeter({ score }: { score: number | null }) {
  const c = scoreColor(score);
  // null(미측정)과 실제 0점은 모두 빈 바로 두고 숫자(— vs 0)로 구분한다.
  const pct = score == null || score <= 0 ? 0 : Math.max(2, Math.round(score));
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="mono text-sm tabular-nums" style={{ color: c }}>
        {score == null ? "—" : Math.round(score)}
      </span>
      <div className="h-1 w-9 overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c }} />
      </div>
    </div>
  );
}

export function RankingView({ companies, weights, models }: { companies: CompanyRecord[]; weights: Weights; models: string[] }) {
  const router = useRouter();
  const [view, setView] = useState<ScoreView>("average");
  const rows = useMemo(() => buildRanking(companies, weights, view), [companies, weights, view]);
  const avg = industryAverage(rows);
  // 모델이 2개 이상이고 평균 뷰일 때 종합을 모델별로 함께 보여준다.
  const splitModels = models.length >= 2 && view === "average";

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="font-display text-2xl font-semibold">블록체인 기업 홈페이지 AI 친화도 벤치마크</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            국내외 블록체인 기업의 공식 홈페이지를 AI·AI 에이전트가 얼마나 잘 읽는지 채점한 순위입니다.
            <br />
            점수가 높을수록 AI 친화적입니다.
          </p>
        </div>
        <div className="text-right">
          <div className="mb-1 text-[11px]" style={{ color: "var(--muted)" }}>채점 모델</div>
          <ModelToggle models={models} value={view} onChange={setView} />
        </div>
      </div>

      {/* 범례: 축 뜻 + 점수 색 스케일 */}
      <div className="panel mb-4 flex flex-wrap items-center justify-between gap-4 p-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span style={{ color: "var(--muted)" }}>채점 축</span>
          {AXES.map((a) => (
            <span key={a} className="flex items-baseline gap-1" title={AXIS_INFO[a].summary}>
              <span className="mono font-semibold" style={{ color: "var(--signal)" }}>{a}</span>
              <span>{AXIS_INFO[a].label}</span>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {models.length >= 2 && (
            <span className="flex items-center gap-2">
              <span style={{ color: "var(--muted)" }}>모델</span>
              {models.map((m) => (
                <span key={m} className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: modelColor(m) }} />
                  {modelShort(m)}
                </span>
              ))}
            </span>
          )}
          <span className="flex items-center gap-2">
            <span style={{ color: "var(--muted)" }}>0</span>
            <div
              className="h-2 w-24 rounded-full"
              style={{ background: "linear-gradient(90deg, var(--score-low), var(--score-mid), var(--score-high))" }}
            />
            <span style={{ color: "var(--muted)" }}>100</span>
            <span className="ml-1" style={{ color: "var(--muted)" }}>낮음 → 높음</span>
          </span>
        </div>
      </div>

      <div className="panel relative overflow-hidden">
        <div className="scanline" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="text-left" style={{ color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
                <th className="whitespace-nowrap px-4 py-2.5 text-xs font-normal" style={{ width: 56 }}>순위</th>
                <th className="px-2 py-2.5 text-xs font-normal">기업</th>
                {AXES.map((a) => (
                  <th key={a} className="px-2 py-2.5 text-center text-xs font-normal" style={{ width: 64 }} title={AXIS_INFO[a].summary}>
                    <div className="flex flex-col items-center leading-tight">
                      <span className="mono font-semibold" style={{ color: "var(--signal)" }}>{a}</span>
                      <span className="text-[10px]">{AXIS_INFO[a].label}</span>
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right text-xs font-normal" style={{ width: 72 }}>종합</th>
                <th className="px-4 py-2.5 text-right text-xs font-normal" style={{ width: 84 }}>평균대비</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const delta = avg != null && r.overall != null ? r.overall - avg : null;
                return (
                  <tr
                    key={r.slug}
                    onClick={() => router.push(`/company/${r.slug}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/company/${r.slug}`);
                      }
                    }}
                    tabIndex={0}
                    role="link"
                    aria-label={`${r.name} 상세 보기`}
                    className="cursor-pointer border-t transition-colors hover:bg-[rgba(255,255,255,0.02)]"
                    style={{ borderColor: "var(--line)", background: r.isSelf ? "rgba(87,199,212,0.08)" : "transparent" }}
                  >
                    <td className="mono px-4 py-3 text-sm tabular-nums" style={{ color: i < 3 ? "var(--text)" : "var(--muted)" }}>
                      {i + 1}
                    </td>
                    <td className="px-2 py-3">
                      <Link href={`/company/${r.slug}`} className="font-medium hover:text-[var(--signal)]">
                        {r.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {r.isSelf && <Chip accent="signal">자사</Chip>}
                        {r.category && <Chip>{categoryLabel(r.category)}</Chip>}
                        {r.region && <Chip>{r.region}</Chip>}
                      </div>
                    </td>
                    {AXES.map((a) => (
                      <td key={a} className="px-2 py-3">
                        <AxisMeter score={r.axes.find((x) => x.axis === a)?.score ?? null} />
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right">
                      <ScorePill score={r.overall} />
                      {splitModels && (
                        <div className="mt-1 flex flex-col items-end gap-0.5">
                          {r.overallByModel.map((m) => (
                            <span key={m.model} className="flex items-center gap-1" title={m.model}>
                              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: modelColor(m.model) }} />
                              <span className="mono text-[10px] tabular-nums" style={{ color: scoreColor(m.score) }}>
                                {m.score == null ? "—" : Math.round(m.score)}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td
                      className="mono px-4 py-3 text-right text-xs tabular-nums"
                      style={{ color: delta == null ? "var(--muted)" : delta >= 0 ? "var(--score-high)" : "var(--score-low)" }}
                    >
                      {delta == null ? "—" : `${delta >= 0 ? "+" : ""}${Math.round(delta)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--muted)" }}>
        <span>업계 평균 종합 <span className="mono" style={{ color: "var(--text)" }}>{avg == null ? "—" : Math.round(avg)}</span></span>
        <span>· <span className="mono">종합</span> = 축 A·B·C·D 가중 평균</span>
        <span>· <span className="mono">평균대비</span> = 종합 − 업계 평균</span>
        <span>· 현재 뷰: {view === "average" ? "모델 평균" : view.model}</span>
      </p>
    </div>
  );
}
