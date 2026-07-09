import { describe, it, expect } from "vitest";
import { scoreBand, scoreColor } from "./scoreColor.js";

describe("scoreBand", () => {
  it("maps ranges to bands", () => {
    expect(scoreBand(null)).toBe("none");
    expect(scoreBand(0)).toBe("low");
    expect(scoreBand(59.9)).toBe("low"); // ~59점대까지 빨강
    expect(scoreBand(60)).toBe("mid"); // 60점대 노랑
    expect(scoreBand(69.9)).toBe("mid");
    expect(scoreBand(70)).toBe("good"); // 70점대 라임
    expect(scoreBand(79.9)).toBe("good");
    expect(scoreBand(80)).toBe("high"); // 80점대 이상 초록
    expect(scoreBand(100)).toBe("high");
  });
});

describe("scoreColor", () => {
  it("returns the CSS var for the band", () => {
    expect(scoreColor(20)).toBe("var(--score-low)");
    expect(scoreColor(55)).toBe("var(--score-low)");
    expect(scoreColor(65)).toBe("var(--score-mid)");
    expect(scoreColor(75)).toBe("var(--score-good)");
    expect(scoreColor(85)).toBe("var(--score-high)");
    expect(scoreColor(null)).toBe("var(--muted)");
  });
});
