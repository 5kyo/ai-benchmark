import type { Axis } from "@ai-benchmark/core";
import { AXIS_INFO } from "../lib/glossary.js";
import { scoreColor } from "../lib/scoreColor.js";
import type { ImprovementItem, ImprovementPlan, Tier } from "../lib/improvement.js";

const TIER_META: Record<Tier, { label: string; hint: string; color: string }> = {
  high: { label: "최우선", hint: "종합점수 +1.0점 이상 기여", color: "var(--score-low)" },
  mid: { label: "권장", hint: "종합점수 +0.3~1.0점 기여", color: "var(--score-mid)" },
  low: { label: "여력 시", hint: "종합점수 +0.3점 미만 기여", color: "var(--muted)" },
};
const TIER_ORDER: Tier[] = ["high", "mid", "low"];

function AxisTag({ axis }: { axis: Axis }) {
  return (
    <span className="mono text-[10px]" style={{ color: "var(--muted)" }}>
      {axis} {AXIS_INFO[axis].label}
    </span>
  );
}

/** 자사 현재치(채움) + 목표까지의 격차(옅은 구간)를 한 트랙에 표시. */
function GapBar({ self, target }: { self: number; target: number }) {
  const selfPct = Math.max(2, Math.min(100, self));
  const gapPct = Math.max(0, Math.min(100, target) - selfPct);
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${selfPct}%`, background: scoreColor(self) }} />
      <div
        className="absolute inset-y-0 rounded-full"
        style={{ left: `${selfPct}%`, width: `${gapPct}%`, background: "var(--signal)", opacity: 0.28 }}
      />
    </div>
  );
}

function ItemCard({ item, rank }: { item: ImprovementItem; rank: number }) {
  return (
    <li className="panel p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="mono text-xs tabular-nums" style={{ color: "var(--muted)" }}>{String(rank).padStart(2, "0")}</span>
          <span className="text-[15px] font-semibold">{item.label}</span>
          <AxisTag axis={item.axis} />
        </div>
        <span
          className="mono shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold leading-none"
          style={{ color: "var(--signal)", border: "1px solid var(--signal)" }}
          title="이 지표를 목표 수준으로 올렸을 때 예상 종합점수 상승분"
        >
          +{item.projectedGain.toFixed(1)}점
        </span>
      </div>

      {/* 점수 비교 */}
      <div className="mt-2.5">
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="flex items-baseline gap-2">
            <span style={{ color: "var(--muted)" }}>자사</span>
            <span className="mono tabular-nums font-semibold" style={{ color: scoreColor(item.selfScore) }}>{item.selfScore}</span>
          </span>
          <span className="flex items-baseline gap-2 mono tabular-nums" style={{ color: "var(--muted)" }}>
            {item.leaderScores.map((l) => (
              <span key={l.name}>
                {l.name} <span style={{ color: "var(--text)" }}>{l.score == null ? "—" : Math.round(l.score)}</span>
              </span>
            ))}
          </span>
        </div>
        <GapBar self={item.selfScore} target={item.target} />
      </div>

      {/* 현상 → 처방 */}
      {item.selfEvidence && (
        <p className="mt-2.5 text-xs leading-snug" style={{ color: "var(--muted)" }}>
          <span className="mono mr-1 text-[10px] uppercase tracking-wide">현상</span>
          {item.selfEvidence}
        </p>
      )}
      <p className="mt-1 text-xs leading-snug" style={{ color: "var(--signal)" }}>→ {item.suggestion}</p>

      {/* 리더 참고 */}
      {item.leaderEvidence && (
        <p
          className="mt-2 border-l-2 pl-2.5 text-xs leading-snug"
          style={{ borderColor: "var(--line)", color: "var(--muted)" }}
        >
          <span className="mono mr-1 text-[10px]" style={{ color: "var(--text)" }}>{item.leaderName} 사례</span>
          {item.leaderEvidence}
        </p>
      )}
    </li>
  );
}

export function ImprovementView({ plan }: { plan: ImprovementPlan }) {
  const { self, leaders, gapToTop, items, projectedOverallIfHigh } = plan;
  const fmt = (v: number | null) => (v == null ? "—" : v.toFixed(1));

  if (self.overall == null) {
    return (
      <div className="panel p-6 text-sm" style={{ color: "var(--muted)" }}>
        자사(파라메타) 데이터를 찾을 수 없습니다.
      </div>
    );
  }

  const highCount = items.filter((i) => i.tier === "high").length;
  let rank = 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-xl font-semibold tracking-tight">자사 홈페이지 개선 방향</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          파라메타를 종합 1·2위와 비교해, 종합점수 상승 효과가 큰 순으로 개선 항목을 정리합니다. 재측정 때마다 자동 갱신됩니다.
        </p>
      </header>

      {/* 요약 패널 */}
      <div className="panel grid gap-4 p-5 sm:grid-cols-3">
        <div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>자사 현황</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="mono text-3xl tabular-nums leading-none" style={{ color: scoreColor(self.overall) }}>{fmt(self.overall)}</span>
            <span className="text-sm" style={{ color: "var(--muted)" }}>{self.rank}위 / {self.total}</span>
          </div>
        </div>
        <div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>목표 (종합 1·2위)</div>
          <ul className="mt-1 space-y-0.5 text-sm">
            {leaders.map((l, i) => (
              <li key={l.name} className="flex items-baseline justify-between gap-3">
                <span><span className="mono mr-1 text-xs" style={{ color: "var(--muted)" }}>{i + 1}위</span>{l.name}</span>
                <span className="mono tabular-nums" style={{ color: scoreColor(l.overall) }}>{fmt(l.overall)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>1위와의 격차 / 개선 잠재력</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="mono text-2xl tabular-nums leading-none" style={{ color: "var(--score-low)" }}>
              {gapToTop == null ? "—" : `−${gapToTop.toFixed(1)}`}
            </span>
          </div>
          {highCount > 0 && projectedOverallIfHigh != null && (
            <p className="mt-1.5 text-xs leading-snug" style={{ color: "var(--muted)" }}>
              최우선 {highCount}개 개선 시 종합{" "}
              <span className="mono" style={{ color: "var(--text)" }}>{fmt(self.overall)}</span>
              {" → 약 "}
              <span className="mono" style={{ color: "var(--signal)" }}>{fmt(projectedOverallIfHigh)}</span>
              {" (예상)"}
            </p>
          )}
        </div>
      </div>

      {/* 우선순위 티어 */}
      {items.length === 0 ? (
        <div className="panel p-6 text-sm" style={{ color: "var(--muted)" }}>
          종합 1·2위 대비 뒤처진 지표가 없습니다. 현재 선도 수준입니다.
        </div>
      ) : (
        TIER_ORDER.map((tier) => {
          const tierItems = items.filter((i) => i.tier === tier);
          if (tierItems.length === 0) return null;
          const meta = TIER_META[tier];
          return (
            <section key={tier}>
              <div className="mb-2.5 flex items-baseline gap-2">
                <span
                  className="rounded px-2 py-0.5 text-xs font-semibold leading-none"
                  style={{ color: meta.color, border: `1px solid ${meta.color}` }}
                >
                  {meta.label}
                </span>
                <span className="text-xs" style={{ color: "var(--muted)" }}>{meta.hint}</span>
                <span className="mono ml-auto text-xs" style={{ color: "var(--muted)" }}>{tierItems.length}개</span>
              </div>
              <ul className="grid gap-3 md:grid-cols-2">
                {tierItems.map((item) => {
                  rank += 1;
                  return <ItemCard key={`${item.axis}-${item.metricKey}`} item={item} rank={rank} />;
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
