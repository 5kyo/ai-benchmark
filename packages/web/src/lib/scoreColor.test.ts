import { describe, it, expect } from "vitest";
import { scoreBand, scoreColor } from "./scoreColor.js";

describe("scoreBand", () => {
  it("maps ranges to bands", () => {
    expect(scoreBand(null)).toBe("none");
    expect(scoreBand(0)).toBe("low");
    expect(scoreBand(39.9)).toBe("low");
    expect(scoreBand(40)).toBe("mid");
    expect(scoreBand(69.9)).toBe("mid");
    expect(scoreBand(70)).toBe("high");
    expect(scoreBand(100)).toBe("high");
  });
});

describe("scoreColor", () => {
  it("returns the CSS var for the band", () => {
    expect(scoreColor(20)).toBe("var(--score-low)");
    expect(scoreColor(55)).toBe("var(--score-mid)");
    expect(scoreColor(85)).toBe("var(--score-high)");
    expect(scoreColor(null)).toBe("var(--muted)");
  });
});
