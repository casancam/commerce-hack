"use client";

import Image from "next/image";
import { useState } from "react";
import { gbp } from "@/lib/format";
import type { Bundle, CounterResult } from "@/lib/types";

export function Desk({ initial }: { initial: Bundle }) {
  const [bundle] = useState(initial);
  const [notice, setNotice] = useState<string | null>(null);
  const [counter, setCounter] = useState<CounterResult | null>(null);
  const [price, setPrice] = useState("");
  const [pending, setPending] = useState<"send" | "counter" | null>(null);

  async function sendPick() {
    setPending("send");
    setNotice(null);
    try {
      const response = await fetch("/api/decide", { method: "POST" });
      const body = await response.json();
      setNotice(
        body.telegram?.sent
          ? "Sent to Telegram."
          : body.telegram?.reason ?? "Telegram did not send.",
      );
    } catch {
      setNotice("Could not send the pick.");
    } finally {
      setPending(null);
    }
  }

  async function submitCounter() {
    setPending("counter");
    setNotice(null);
    try {
      const response = await fetch("/api/counter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price }),
      });
      const body = await response.json();
      if (!response.ok) {
        setNotice(body.error ?? "Could not check that price.");
        setCounter(null);
        return;
      }
      setCounter(body.result);
      setNotice(body.telegram?.sent ? "Verdict sent to Telegram." : null);
    } catch {
      setNotice("Could not check that price.");
    } finally {
      setPending(null);
    }
  }

  const { chosen, policy, rejected, campaigns } = bundle;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Daily merchant desk</p>
          <h1 className="text-3xl font-semibold tracking-tight">Today&apos;s pick</h1>
        </div>
        <p className="text-sm text-muted">
          {policy.minMarginPct}% margin · {gbp(policy.maxDailySpendCents)} a day · skip stock under {policy.minStock}
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-line bg-card p-5">
          <p className="text-sm text-muted">Chosen</p>
          <h2 className="mt-1 text-2xl font-semibold">{chosen.title}</h2>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <Stat label="Price" value={gbp(chosen.priceCents)} />
            <Stat label="Margin" value={`${chosen.marginPct}%`} />
            <Stat label="Stock" value={String(chosen.stock)} />
          </dl>
          <p className="mt-4 text-sm text-muted">
            Sold {chosen.unitsSold30d} in the last 30 days. Eligible products with stronger sales stayed on the shelf.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={sendPick}
              disabled={pending !== null}
              className="rounded-full bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
            >
              {pending === "send" ? "Sending…" : "Send to Telegram"}
            </button>
          </div>
          {notice ? <p className="mt-3 text-sm">{notice}</p> : null}
        </article>

        <article className="overflow-hidden rounded-2xl border border-line bg-card">
          <div className="relative h-52 w-full">
            <Image src={chosen.imageUrl} alt="" fill className="object-cover" />
          </div>
          <div className="space-y-2 p-5">
            <p className="text-xs uppercase tracking-wide text-muted">Ad card</p>
            <h3 className="text-lg font-semibold">{chosen.headline}</h3>
            <p className="text-sm">{chosen.primaryText}</p>
            <p className="text-sm font-medium">{gbp(chosen.priceCents)}</p>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-lg font-semibold">Rejected</h2>
          <ul className="mt-3 space-y-3">
            {rejected.map((item) => (
              <li key={item.title} className="text-sm">
                <span className="font-medium">{item.title}.</span>{" "}
                <span className="text-muted">{item.reason}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-lg font-semibold">Counter the price</h2>
          <p className="mt-1 text-sm text-muted">
            Reply on Telegram with a number, or check it here. The agent uses this product&apos;s cost and stock.
          </p>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submitCounter();
            }}
          >
            <input
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              inputMode="decimal"
              placeholder="70"
              className="w-full rounded-full border border-line bg-background px-4 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={pending !== null}
              className="rounded-full border border-foreground px-4 py-2 text-sm disabled:opacity-50"
            >
              {pending === "counter" ? "Checking…" : "Check"}
            </button>
          </form>
          {counter ? (
            <p className={`mt-4 text-sm ${counter.doable ? "text-good" : "text-bad"}`}>
              {counter.reply}
            </p>
          ) : null}
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {campaigns.map((campaign) => (
          <article key={campaign.platform} className="rounded-2xl border border-line bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold capitalize">{campaign.platform}</h2>
              <span className="rounded-full bg-background px-3 py-1 text-xs uppercase tracking-wide text-muted">
                {campaign.status}
              </span>
            </div>
            <p className="mt-3 text-sm">{campaign.name}</p>
            <p className="mt-1 text-sm text-muted">
              {gbp(campaign.dailyBudgetCents)} / day · {campaign.destinationUrl}
            </p>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-background p-3 text-xs text-muted">
              {JSON.stringify(
                {
                  headline: campaign.headline,
                  primaryText: campaign.primaryText,
                  imageUrl: campaign.imageUrl,
                  status: campaign.status,
                },
                null,
                2,
              )}
            </pre>
          </article>
        ))}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background px-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
