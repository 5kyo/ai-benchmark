"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "순위" },
  { href: "/improvement", label: "자사 개선 방향" },
  { href: "/trend", label: "자사 추이" },
  { href: "/changes", label: "변화 소식" },
  { href: "/methodology", label: "평가 기준·방식" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
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
      </nav>
    </header>
  );
}
