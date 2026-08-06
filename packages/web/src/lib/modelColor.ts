// 채점 모델별 고정 색/짧은 이름. 순위·레이더·모델비교에서 공용.
//
// 같은 벤더의 모델이 둘 이상이면 이름과 색이 모두 갈려야 한다. 종전에는 claude-opus-5와
// claude-sonnet-5가 둘 다 "Claude" / 같은 시안이라, 헤더가 "Claude Claude GPT"로 찍혀
// 어느 열이 어느 모델인지 알 수 없었다(2026-08-06).
const COLORS: Record<string, string> = {
  "claude-opus": "#57c7d4", // 시그널 시안
  "claude-sonnet": "#a78bfa", // 바이올렛
  "claude-haiku": "#34d399", // 그린
  gpt: "#f5a524", // 앰버
  gemini: "#8b7cf6", // 퍼플
};

export function modelColor(model: string): string {
  const m = model.toLowerCase();
  for (const [key, color] of Object.entries(COLORS)) {
    if (m.startsWith(key)) return color;
  }
  // 벤더만 아는 경우의 차선책. 그것도 모르면 회색으로 둔다(색을 지어내지 않는다).
  if (m.includes("claude")) return COLORS["claude-opus"];
  if (m.includes("gpt")) return COLORS.gpt;
  if (m.includes("gemini")) return COLORS.gemini;
  return "#9aa4b2";
}

/** 버전 조각을 표시용으로. "4-5" → "4.5", "5" → "5". */
function version(parts: string[]): string {
  return parts.join(".");
}

/**
 * 표에 넣을 짧은 모델 이름. 벤더가 아니라 모델을 식별할 수 있어야 한다.
 * claude-opus-5 → "Opus 5" · claude-haiku-4-5 → "Haiku 4.5" · gpt-5.5 → "GPT-5.5"
 */
export function modelShort(model: string): string {
  const m = model.toLowerCase().trim();
  if (!m) return model;

  const claude = /^claude-(opus|sonnet|haiku|fable)-?(.*)$/.exec(m);
  if (claude) {
    const family = claude[1][0].toUpperCase() + claude[1].slice(1);
    const ver = version(claude[2].split("-").filter(Boolean));
    return ver ? `${family} ${ver}` : family;
  }
  if (m.startsWith("gpt")) return `GPT-${m.slice(3).replace(/^[-\s]/, "")}`.replace(/-$/, "");
  if (m.startsWith("gemini")) {
    const ver = m.slice("gemini".length).replace(/^[-\s]/, "");
    return ver ? `Gemini ${ver}` : "Gemini";
  }
  return model;
}
