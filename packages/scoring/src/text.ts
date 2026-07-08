import * as cheerio from "cheerio";

const MAX_CHARS = 12000;

export function extractText(html: string, maxChars = MAX_CHARS): string {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const text = $("body").text() || $.root().text();
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > maxChars ? clean.slice(0, maxChars) : clean;
}
