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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-accent px-6 py-16">
      <div className="dotgrid absolute inset-0" aria-hidden="true" />
      <div className="relative w-full max-w-xl">
        <img src="/haggly.png" alt="" className="brief-logo h-28 w-28 object-contain" />
        <p className="chip mt-6">
          <span className="blink h-2 w-2 rounded-full bg-hot" /> Importing
        </p>
        <h1 className="display mt-4 text-[clamp(2.5rem,7vw,4.5rem)] break-words">{summary?.shopName ?? shop}</h1>
        <ol className="panel mt-8 divide-y-2 divide-ink overflow-hidden">
          {STEPS.map((label, index) => {
            const done = step > index;
            return (
              <li
                key={label}
                className={`flex items-center gap-4 px-5 py-4 text-[15px] font-semibold ${done ? "bg-card" : "bg-card/60 text-muted"}`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-ink font-mono text-xs ${
                    done ? "bg-ink text-accent" : "bg-transparent"
                  }`}
                >
                  {done ? "✓" : `0${index + 1}`}
                </span>
                {label}
              </li>
            );
          })}
        </ol>
        {summary ? (
          <p className="serif mt-6 text-2xl">
            {summary.products} products · {summary.stock} in stock
            {summary.sales === "loaded" ? ` · ${summary.sold} sold in 30 days` : ""}. Opening the studio.
          </p>
        ) : null}
        {error ? (
          <div className="mt-6 space-y-4">
            <p className="panel bg-hot px-5 py-4 text-[15px] font-medium">{error}</p>
            <a href="/api/shopify/disconnect" className="studio-btn studio-btn-primary">
              Connect again
            </a>
          </div>
        ) : null}
      </div>
    </main>
  );
}
