// 채점 모델별 고정 색/짧은 이름. 순위·레이더·모델비교에서 공용.
export function modelColor(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("gpt")) return "#f5a524"; // 앰버
  if (m.includes("claude")) return "#57c7d4"; // 시그널 시안
  if (m.includes("gemini")) return "#8b7cf6"; // 퍼플
  return "#8b7cf6";
}

export function modelShort(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("gpt")) return "GPT";
  if (m.includes("claude")) return "Claude";
  if (m.includes("gemini")) return "Gemini";
  return model;
}
