import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ChangesFile } from "./detect.js";
import { buildChangeReport } from "./changeReport.js";
import { mergeSummaries, parseSummaryFile, type ChangeSummary } from "./summaries.js";

const DATE_JSON_RE = /^\d{4}-\d{2}-\d{2}\.json$/;

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "../../..");
  const changesDir = resolve(root, "changes");
  const outboxDir = resolve(root, "scoring/changes-outbox");

  const files = existsSync(changesDir)
    ? readdirSync(changesDir).filter((f) => DATE_JSON_RE.test(f)).sort()
    : [];
  if (files.length === 0) {
    console.log("changes/ 에 변화 기록이 없습니다 — 먼저 `pnpm detect-changes`를 실행하세요.");
    return;
  }
  const latest = files[files.length - 1];
  const changesPath = resolve(changesDir, latest);
  const changes = JSON.parse(readFileSync(changesPath, "utf8")) as ChangesFile;

  const summaries: ChangeSummary[] = [];
  let failed = 0;
  if (existsSync(outboxDir)) {
    for (const f of readdirSync(outboxDir)) {
      if (!f.endsWith(".json")) continue;
      try {
        summaries.push(parseSummaryFile(readFileSync(resolve(outboxDir, f), "utf8")));
      } catch (e) {
        console.error(`[${f}] 검증 실패: ${(e as Error).message}`);
        failed += 1;
      }
    }
  }

  const { merged, unmatched } = mergeSummaries(changes, summaries);
  for (const slug of unmatched) console.warn(`[${slug}] changes 엔트리에 없는 slug — 건너뜀`);
  writeFileSync(changesPath, JSON.stringify(merged, null, 2));

  const reportDir = resolve(root, "reports/changes");
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(resolve(reportDir, `${merged.date}.md`), buildChangeReport(merged));

  const applied = summaries.length - unmatched.length;
  console.log(
    `요약 ${applied}건 병합(검증 실패 ${failed}건, 미매칭 ${unmatched.length}건) → ` +
    `changes/${latest} / reports/changes/${merged.date}.md 갱신.`,
  );
  if (failed > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
