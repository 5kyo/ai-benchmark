"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "순위" },
  { href: "/improvement", label: "자사 개선 방향" },
  { href: "/trend", label: "자사 추이" },
  { href: "/methodology", label: "평가 기준·방식" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    setTheme(t === "light" ? "light" : "dark");
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "밝은 테마로 전환" : "어두운 테마로 전환"}
      className="shrink-0 rounded-md border px-2 py-1 text-sm leading-none transition-colors hover:text-[var(--text)]"
      style={{ borderColor: "var(--line)", color: "var(--muted)" }}
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}

export function NavBar() {
  const pathname = usePathname() ?? "/";
  return (
    <header className="border-b" style={{ borderColor: "var(--line)" }}>
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
        <Link href="/" className="font-display shrink-0 text-lg font-semibold tracking-tight">
          READABILITY<span style={{ color: "var(--signal)" }}>/</span>BENCH
        </Link>
        <ul className="flex flex-1 items-center gap-4 overflow-x-auto text-sm">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <li key={n.href} className="whitespace-nowrap">
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className="inline-block pb-0.5 transition-colors hover:text-[var(--text)]"
                  style={{
                    color: active ? "var(--text)" : "var(--muted)",
                    borderBottom: `2px solid ${active ? "var(--signal)" : "transparent"}`,
                  }}
                >
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <ThemeToggle />
      </nav>
    </header>
  );
}
