import type { Axis } from "@ai-benchmark/core";
import { AXIS_INFO, METRIC_INFO } from "../lib/glossary.js";
import type { WebChangeEntry, WebChangesFile } from "../lib/data/changes.js";

const KIND_LABEL: Record<string, string> = {
  content: "콘텐츠", score: "점수", rank: "순위", new: "신규", removed: "제외",
};

/** 점수/순위 delta. 순위는 숫자가 줄어드는 게 개선이므로 invert. */
function Delta({ from, to, invert = false, suffix = "" }: {
  from: number; to: number; invert?: boolean; suffix?: string;
}) {
  const up = invert ? to < from : to > from;
  const color = up ? "var(--score-high)" : "var(--score-low)";
  return (
    <span className="mono" style={{ color }}>
      {from}{suffix} → {to}{suffix} <span aria-hidden>{up ? "▲" : "▼"}</span>
    </span>
  );
}

function EntryCard({ e }: { e: WebChangeEntry }) {
  const c = e.content;
  return (
    <article className="rounded-lg border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-base font-semibold">{e.name}</h3>
        {e.kinds.map((k) => (
          <span
            key={k}
            className="rounded px-1.5 py-0.5 text-xs"
            style={{ border: "1px solid var(--line)", color: "var(--muted)" }}
          >
            {KIND_LABEL[k] ?? k}
          </span>
        ))}
      </div>
      {e.summary && <p className="mt-2 text-sm">{e.summary}</p>}
      <ul className="mt-2 space-y-1 text-sm" style={{ color: "var(--muted)" }}>
        {e.overall && <li>종합 <Delta from={e.overall.from} to={e.overall.to} /></li>}
        {(e.axes ?? []).map((a) => (
          <li key={a.axis}>
            {AXIS_INFO[a.axis as Axis]?.label ?? a.axis} <Delta from={a.from} to={a.to} />
          </li>
        ))}
        {e.rank && <li>순위 <Delta from={e.rank.from} to={e.rank.to} invert suffix="위" /></li>}
        {(e.metrics ?? []).map((m) => (
          <li key={m.metricKey}>
            {METRIC_INFO[m.metricKey]?.label ?? m.metricKey} <Delta from={m.from} to={m.to} />
            {m.evidence && <span className="ml-1">— {m.evidence}</span>}
          </li>
        ))}
        {c?.titleChanged && <li>title 변경: “{c.titleFrom}” → “{c.titleTo}”</li>}
        {c?.metaChanged && <li>메타 설명 변경</li>}
        {c && c.headingsAdded.length > 0 && <li>헤딩 추가: {c.headingsAdded.join(" · ")}</li>}
        {c && c.headingsRemoved.length > 0 && <li>헤딩 삭제: {c.headingsRemoved.join(" · ")}</li>}
        {c && c.textChangedPct > 0 && <li>본문 텍스트 약 {c.textChangedPct}% 변경</li>}
      </ul>
    </article>
  );
}

export function ChangesView({ files }: { files: WebChangesFile[] }) {
  if (files.length === 0) {
    return (
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">변화 소식</h1>
        <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
          아직 감지된 변화가 없습니다. 재측정 후 <code className="mono">pnpm detect-changes</code>를
          실행하면 이곳에 표시됩니다.
        </p>
      </div>
    );
  }
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">변화 소식</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
        재측정 시점마다 직전 측정 대비 각 사 홈페이지의 콘텐츠·점수·순위 변화를 기록합니다.
      </p>
      <div className="mt-6 space-y-8">
        {files.map((f) => (
          <section key={f.date}>
            <h2 className="font-display text-lg font-semibold">
              {f.date}{" "}
              <span className="text-sm font-normal" style={{ color: "var(--muted)" }}>
                (vs {f.fromDate})
              </span>
            </h2>
            {f.entries.length === 0 ? (
              <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                변화가 감지되지 않았습니다.
              </p>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {f.entries.map((e) => (
                  <EntryCard key={e.slug} e={e} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
