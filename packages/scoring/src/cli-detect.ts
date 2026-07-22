import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadWeights } from "@ai-benchmark/core";
import { loadCompanies } from "@ai-benchmark/crawler";
import type { Fingerprint } from "./fingerprint.js";
import { detectChanges, type CompanyLike } from "./detect.js";
import { buildChangeInboxDoc, buildChangeReport, formatEntryLines } from "./changeReport.js";

function listSnapshotDates(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .sort();
}

function loadCompaniesFromSnapshot(file: string): CompanyLike[] {
  const raw = JSON.parse(readFileSync(file, "utf8")) as { companies?: unknown };
  if (!Array.isArray(raw.companies)) throw new Error(`companies 배열이 없습니다: ${file}`);
  return raw.companies as CompanyLike[];
}

function loadFingerprints(dir: string): Record<string, Fingerprint> {
  const out: Record<string, Fingerprint> = {};
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    try {
      const fp = JSON.parse(readFileSync(resolve(dir, f), "utf8")) as Fingerprint;
      if (fp && typeof fp.slug === "string" && typeof fp.text === "string") out[fp.slug] = fp;
    } catch {
      // 깨진 지문 파일은 건너뛴다
    }
  }
  return out;
}

function argValue(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(`--${name}=`.length) : null;
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "../../..");
  const snapshotsDir = resolve(root, "snapshots");

  const dates = listSnapshotDates(snapshotsDir);
  const to = argValue("to") ?? dates[dates.length - 1];
  const from = argValue("from") ?? dates.filter((d) => d < (to ?? "")).pop();
  if (!from || !to || from === to) {
    console.log("비교 기준이 없습니다 — snapshots/ 에 서로 다른 날짜의 스냅샷이 2개 이상 필요합니다.");
    return;
  }

  const fromCompanies = loadCompaniesFromSnapshot(resolve(snapshotsDir, `${from}.json`));
  const toCompanies = loadCompaniesFromSnapshot(resolve(snapshotsDir, `${to}.json`));
  const fromFps = loadFingerprints(resolve(snapshotsDir, "content", from));
  const toFps = loadFingerprints(resolve(snapshotsDir, "content", to));
  const weights = loadWeights(resolve(root, "config/weights.yaml"));

  const changes = detectChanges({
    fromDate: from, toDate: to, generatedAt: new Date().toISOString(),
    from: fromCompanies, to: toCompanies, fromFps, toFps, weights,
  });

  const changesDir = resolve(root, "changes");
  mkdirSync(changesDir, { recursive: true });
  writeFileSync(resolve(changesDir, `${to}.json`), JSON.stringify(changes, null, 2));

  // LLM 요약 입력(inbox): 신규/제외를 뺀, 실제 변화가 있는 회사만.
  const urlBySlug = new Map(
    loadCompanies(resolve(root, "config/companies.yaml")).map((c) => [c.slug, c.homepageUrl]),
  );
  const inboxDir = resolve(root, "scoring/changes-inbox");
  mkdirSync(inboxDir, { recursive: true });
  let inboxCount = 0;
  for (const e of changes.entries) {
    if (!e.kinds.some((k) => k === "content" || k === "score" || k === "rank")) continue;
    const doc = buildChangeInboxDoc({
      entry: e,
      url: urlBySlug.get(e.slug) ?? "",
      fromDate: from,
      toDate: to,
      fromText: fromFps[e.slug]?.text ?? "",
      toText: toFps[e.slug]?.text ?? "",
    });
    writeFileSync(resolve(inboxDir, `${e.slug}.md`), doc);
    inboxCount += 1;
  }

  console.log(`\n[${from} → ${to}] 변화 감지: ${changes.entries.length}개사`);
  for (const e of changes.entries) {
    console.log(`\n- ${e.name} (${e.kinds.join(", ")})`);
    for (const l of formatEntryLines(e)) console.log(`    ${l}`);
  }
  console.log(
    `\nchanges/${to}.json 기록. inbox ${inboxCount}건 → Claude Code로 요약해 ` +
    `scoring/changes-outbox/<slug>.json 저장 후 \`pnpm import-change-summaries\` 실행.`,
  );

  if (process.argv.includes("--report")) {
    const reportDir = resolve(root, "reports/changes");
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(resolve(reportDir, `${to}.md`), buildChangeReport(changes));
    console.log(`reports/changes/${to}.md 기록(요약 없음 버전).`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
