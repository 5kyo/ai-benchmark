export interface FetchResult {
  url: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  elapsedMs: number;
}

export interface Fetcher {
  fetch(url: string): Promise<FetchResult>;
}

/** 실제 네트워크 fetcher. 테스트에서는 사용하지 않는다(주입으로 대체). */
export class HttpFetcher implements Fetcher {
  constructor(private readonly timeoutMs = 15000) {}

  async fetch(url: string): Promise<FetchResult> {
    const start = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await globalThis.fetch(url, {
        signal: controller.signal,
        headers: { "user-agent": "ai-benchmark-crawler/1.0" },
      });
      const body = await res.text();
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => (headers[k] = v));
      return { url, status: res.status, headers, body, elapsedMs: performance.now() - start };
    } catch {
      return { url, status: 0, headers: {}, body: "", elapsedMs: performance.now() - start };
    } finally {
      clearTimeout(timer);
    }
  }
}
