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
      <header className="sticky top-0 z-30 flex items-center justify-between border-b-2 border-ink bg-ink px-4 py-3 text-card md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <img src="/haggly.png" alt="" className="h-8 w-8 rounded-full bg-accent object-contain p-0.5" />
          <span className="display text-xl">haggly</span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                pathname === link.href ? "bg-accent text-ink" : "text-card/60"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <aside
        className={`fixed inset-y-0 left-0 z-20 hidden flex-col border-r-2 border-ink bg-ink text-card md:flex ${
          collapsed ? "w-[76px]" : "w-64"
        }`}
      >
        <div className={`flex items-center gap-3 py-6 ${collapsed ? "justify-center px-2" : "px-5"}`}>
          <Link href="/" className="shrink-0">
            <img src="/haggly.png" alt="" className="h-11 w-11 rounded-full border-2 border-card bg-accent object-contain p-0.5" />
          </Link>
          {collapsed ? null : (
            <span className="min-w-0">
              <span className="display block text-3xl">haggly</span>
              <span className="kicker block text-accent">Ad studio</span>
            </span>
          )}
        </div>
        {collapsed ? null : <p className="kicker px-5 pt-2 pb-3 text-card/40">Menu</p>}
        <nav className="flex flex-col gap-1.5 px-3">
          {links.map((link, index) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                title={link.label}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-full border-2 py-2.5 text-[15px] font-bold transition-colors ${
                  collapsed ? "justify-center px-2" : "px-4"
                } ${
                  active
                    ? "border-accent bg-accent text-ink"
                    : "border-transparent text-card/65 hover:border-card/25 hover:text-card"
                }`}
              >
                <NavIcon name={link.icon} />
                {collapsed ? null : (
                  <>
                    <span className="flex-1">{link.label}</span>
                    <span className={`font-mono text-[10px] ${active ? "text-ink/60" : "text-card/30"}`}>0{index + 1}</span>
                  </>
                )}
              </Link>
            );
          })}
        </nav>
        {collapsed ? null : (
          <div className="mx-4 mt-auto mb-4 rounded-2xl border-2 border-card/20 p-4">
            <p className="serif text-2xl leading-tight text-card">Margin first,</p>
            <p className="serif text-2xl leading-tight text-accent">always on.</p>
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          className={`flex items-center gap-2 border-t-2 border-card/10 px-5 py-4 text-left font-mono text-[11px] tracking-widest text-card/50 uppercase hover:text-accent ${
            collapsed ? "mt-auto justify-center px-2" : ""
          }`}
        >
          <Chevron collapsed={collapsed} />
          {collapsed ? null : "Collapse"}
        </button>
      </aside>
      <div className={`min-h-full transition-[padding] duration-200 ${collapsed ? "md:pl-[76px]" : "md:pl-64"}`}>
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
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[name]} />
    </svg>
  );
}

function Chevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${collapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 6 9 12l6 6" />
    </svg>
  );
}
