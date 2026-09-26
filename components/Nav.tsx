"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Overview", icon: "overview" },
  { href: "/products", label: "Products", icon: "products" },
  { href: "/decisions", label: "Decisions", icon: "decisions" },
] as const;

export function Frame({ connected, children }: { connected: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  if (!connected || pathname === "/import") return children;
  return <AppShell>{children}</AppShell>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("haggly-nav") === "collapsed") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem("haggly-nav", next ? "collapsed" : "open");
      return next;
    });
  }

  return (
    <div className="min-h-full bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-sidebar px-4 py-3 text-white md:hidden">
        <Link href="/" className="flex items-center gap-2 rounded-lg bg-[#f6f3ee] px-2 py-1.5 text-foreground">
          <img src="/haggly.png" alt="" className="h-8 w-8 object-contain" />
          <span className="text-sm font-semibold tracking-tight">Haggly</span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-2.5 py-1.5 text-xs ${
                pathname === link.href ? "bg-white/10 text-white" : "text-[#b7b1a8]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <aside
        className={`fixed inset-y-0 left-0 z-20 hidden flex-col border-r border-white/10 bg-sidebar text-white md:flex ${
          collapsed ? "w-[72px]" : "w-60"
        }`}
      >
        <div className="border-b border-black/10 bg-[#f6f3ee] text-foreground">
          <div className={`flex items-center gap-3 py-4 ${collapsed ? "justify-center px-2" : "px-4"}`}>
            <Link href="/" className="shrink-0">
              <img src="/haggly.png" alt="" className="h-9 w-9 object-contain" />
            </Link>
            {collapsed ? null : (
              <span className="min-w-0">
                <span className="block text-sm font-semibold tracking-tight">Haggly</span>
                <span className="block text-[11px] text-muted">Ads studio</span>
              </span>
            )}
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-2">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                title={link.label}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-3 rounded-lg py-2 text-[13px] ${
                  collapsed ? "justify-center px-2" : "px-3"
                } ${active ? "bg-white/10 text-white" : "text-[#b7b1a8] hover:bg-white/[0.06] hover:text-white"}`}
              >
                {active ? (
                  <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
                ) : null}
                <NavIcon name={link.icon} />
                {collapsed ? null : link.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={toggle}
          className="mt-auto flex items-center gap-2 border-t border-white/10 px-4 py-3 text-left text-xs text-[#9c968c] hover:text-white"
        >
          <Chevron collapsed={collapsed} />
          {collapsed ? null : "Collapse"}
        </button>
      </aside>
      <div className={`min-h-full transition-[padding] duration-200 ${collapsed ? "md:pl-[72px]" : "md:pl-60"}`}>
        {children}
      </div>
    </div>
  );
}

function NavIcon({ name }: { name: (typeof links)[number]["icon"] }) {
  const paths = {
    overview: "M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z",
    products: "M12 3 3 8l9 5 9-5-9-5zm-9 7v6l9 5 9-5v-6",
    decisions: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  };
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[name]} />
    </svg>
  );
}

function Chevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${collapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 6 9 12l6 6" />
    </svg>
  );
}
