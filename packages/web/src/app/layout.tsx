import type { Metadata } from "next";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "AI Readability Benchmark",
  description: "국내 블록체인 기업 홈페이지 AI 친화도 벤치마크",
};

const NAV = [
  { href: "/", label: "순위" },
  { href: "/methodology", label: "방법론" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <header className="border-b" style={{ borderColor: "var(--line)" }}>
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
            <Link href="/" className="font-display text-lg font-semibold tracking-tight">
              READABILITY<span style={{ color: "var(--signal)" }}>/</span>BENCH
            </Link>
            <ul className="flex gap-4 text-sm" style={{ color: "var(--muted)" }}>
              {NAV.map((n) => (
                <li key={n.href}><Link href={n.href} className="hover:text-[var(--text)]">{n.label}</Link></li>
              ))}
            </ul>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
