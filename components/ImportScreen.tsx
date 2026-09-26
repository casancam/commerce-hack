"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Summary = {
  shopName: string | null;
  products: number;
  stock: number;
  sold: number;
  sales: "loaded" | "unavailable";
};

const STEPS = ["Shopify approved", "Products, prices, stock, and cost", "Sales from the last 30 days"];

export function ImportScreen({ shop }: { shop: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [step, setStep] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;

    async function run() {
      setStep(1);
      try {
        const response = await fetch("/api/shopify/import", { method: "POST" });
        const body = (await response.json().catch(() => null)) as (Summary & { error?: string }) | null;
        if (cancelled) return;
        if (!response.ok || !body || body.error) {
          setError(body?.error ?? "Could not import the store.");
          return;
        }
        setSummary(body);
        setStep(STEPS.length);
      } catch {
        if (!cancelled) setError("Could not import the store.");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!summary) return;
    const timer = window.setTimeout(() => {
      router.refresh();
      router.replace("/");
    }, 900);
    return () => window.clearTimeout(timer);
  }, [router, summary]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-16">
      <img src="/haggly.png" alt="" className="h-16 w-16 object-contain" />
      <p className="kicker mt-6">Import</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{summary?.shopName ?? shop}</h1>
      <ol className="mt-6 space-y-2">
        {STEPS.map((label, index) => {
          const done = step > index;
          return (
            <li key={label} className={`text-sm ${done ? "text-foreground" : "text-muted"}`}>
              {done ? "✓" : "·"} {label}
            </li>
          );
        })}
      </ol>
      {summary ? (
        <p className="mt-6 text-sm text-muted">
          {summary.products} products · {summary.stock} in stock
          {summary.sales === "loaded" ? ` · ${summary.sold} sold in 30 days` : ""}. Opening the studio.
        </p>
      ) : null}
      {error ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-bad">{error}</p>
          <a href="/api/shopify/disconnect" className="studio-btn studio-btn-secondary">
            Connect again
          </a>
        </div>
      ) : null}
    </main>
  );
}
