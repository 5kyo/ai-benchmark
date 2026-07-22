import { describe, expect, it } from "vitest";
import { extractFingerprint } from "./fingerprint.js";

const HTML = `<!doctype html><html><head><title> Acme —  Web3 </title>
<meta name="description" content="  블록체인   인프라  ">
</head><body>
<h1>Acme</h1>
<h2>제품 <span>소개</span></h2>
<h3>   </h3>
<script>ignored()</script>
<p>우리는 인프라를 만든다.</p>
</body></html>`;

describe("extractFingerprint", () => {
  it("title·메타·헤딩·본문·해시를 추출한다", () => {
    const fp = extractFingerprint(HTML, { slug: "acme", date: "2026-07-22", url: "https://acme.io/" });
    expect(fp.slug).toBe("acme");
    expect(fp.date).toBe("2026-07-22");
    expect(fp.url).toBe("https://acme.io/");
    expect(fp.title).toBe("Acme — Web3");
    expect(fp.metaDescription).toBe("블록체인 인프라");
    expect(fp.headings).toEqual([
      { level: 1, text: "Acme" },
      { level: 2, text: "제품 소개" },
    ]);
    expect(fp.text).toContain("우리는 인프라를 만든다.");
    expect(fp.text).not.toContain("ignored");
    expect(fp.textHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("본문이 다르면 해시가 다르고, 같으면 같다", () => {
    const a = extractFingerprint(HTML, { slug: "a", date: "d", url: "u" });
    const a2 = extractFingerprint(HTML, { slug: "a", date: "d", url: "u" });
    const b = extractFingerprint(HTML.replace("만든다", "만들었다"), { slug: "a", date: "d", url: "u" });
    expect(a.textHash).toBe(a2.textHash);
    expect(a.textHash).not.toBe(b.textHash);
  });

  it("빈/비정상 HTML도 관용적으로 처리한다", () => {
    const fp = extractFingerprint("<div>hi", { slug: "x", date: "d", url: "u" });
    expect(fp.title).toBe("");
    expect(fp.metaDescription).toBe("");
    expect(fp.headings).toEqual([]);
    expect(fp.text).toBe("hi");
  });
});
