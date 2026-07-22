import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { extractText } from "./text.js";

export interface Heading {
  level: number;
  text: string;
}

/** 한 회사·한 시점의 콘텐츠 지문 — 변화 감지(diffContent)의 비교 재료. */
export interface Fingerprint {
  slug: string;
  date: string;
  url: string;
  title: string;
  metaDescription: string;
  headings: Heading[];
  text: string;
  textHash: string;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

export function extractFingerprint(
  html: string,
  meta: { slug: string; date: string; url: string },
): Fingerprint {
  const $ = cheerio.load(html);
  const title = norm($("head title").first().text() || "");
  const metaDescription = norm($('meta[name="description"]').attr("content") ?? "");
  const headings: Heading[] = [];
  $("h1, h2, h3").each((_, el) => {
    const text = norm($(el).text());
    if (text) headings.push({ level: Number(el.name.slice(1)), text });
  });
  const text = extractText(html);
  const textHash = createHash("sha256").update(text).digest("hex");
  return { slug: meta.slug, date: meta.date, url: meta.url, title, metaDescription, headings, text, textHash };
}
