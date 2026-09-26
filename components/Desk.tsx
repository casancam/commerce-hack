"use client";

import { useEffect, useState } from "react";
import { PlatformLogo } from "@/components/PlatformLogo";
import { RuleFields } from "@/components/RuleFields";
import { gbp, marginPct } from "@/lib/format";
import type { AdVariant, Brief, CampaignDraft, Product, ProductRule } from "@/lib/types";

type BriefStage = "stock" | "ads" | "assets";

export function Desk({
  initial,
  products,
  rules,
}: {
  initial: Brief;
  products: Product[];
  rules: Record<string, ProductRule>;
}) {
  const [brief, setBrief] = useState(initial);
  const [rulesState, setRulesState] = useState(rules);
  const [budgetDraft, setBudgetDraft] = useState({
    meta: pounds(budgetOf(initial, "meta")),
    tiktok: pounds(budgetOf(initial, "tiktok")),
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState("");
  const [liveNote, setLiveNote] = useState<string | null>(null);
  const [pending, setPending] = useState<"brief" | "suggest" | "budget" | null>(null);
  const [stage, setStage] = useState<BriefStage | null>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [imageNote, setImageNote] = useState("");
  const [imageBusy, setImageBusy] = useState<string | null>(null);

  const metaBudget = budgetOf(brief, "meta");
  const tiktokBudget = budgetOf(brief, "tiktok");
  useEffect(() => {
    setBudgetDraft({ meta: pounds(metaBudget), tiktok: pounds(tiktokBudget) });
  }, [metaBudget, tiktokBudget]);

  const { chosen } = brief;
  const product = products.find((item) => item.id === chosen.id);
  const stockUrl = product?.imageUrl || chosen.imageUrl;
  const rule = rulesState[chosen.id] ?? {
    minPriceCents: 0,
    campaignPriceCents: chosen.campaignPriceCents || chosen.priceCents,
    minMarginPct: 40,
    minStock: 5,
  };
  const variants = variantsFor(brief, stockUrl);
  const selected = variants.find((variant) => variant.id === brief.chosen.selectedVariantId) ?? variants[0];
  const previewImage = selected?.imageUrl || stockUrl;
  const campaignMargin = marginPct(rule.campaignPriceCents, chosen.costCents);
  const profitCents = rule.campaignPriceCents - chosen.costCents;
  const competitorAds = (brief.competitorAds?.length ? brief.competitorAds : brief.competitorAd ? [brief.competitorAd] : []).filter(
    (ad) => ad.imageUrl || ad.url,
  );
  const priceLinks = brief.research.filter((link) => link.kind !== "ad" && usefulLink(link));

  async function runBrief() {
    setPending("brief");
    setStage("stock");
    setNotice(null);
    try {
      const response = await fetch("/api/decide", { method: "POST" });
      if (!response.ok || !response.body) {
        setNotice("Could not run today's brief.");
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            stage?: string;
            brief?: Brief;
            warning?: string | null;
            telegram?: { sent?: boolean; reason?: string };
            slack?: { sent?: boolean; reason?: string };
            grokbot?: { sent?: boolean; reason?: string };
            error?: string;
          };
          if (event.stage === "stock" || event.stage === "ads" || event.stage === "assets") {
            setStage(event.stage);
          }
          if (event.stage === "error") setNotice(event.error ?? "Could not run today's brief.");
          if (event.stage === "done" && event.brief) {
            finished = true;
            const next = event.brief;
            setBrief(next);
            if (next.chosen?.campaignPriceCents) {
              setRulesState((current) => ({
                ...current,
                [next.chosen.id]: {
                  ...(current[next.chosen.id] ?? rule),
                  campaignPriceCents: next.chosen.campaignPriceCents,
                },
              }));
            }
            setNotice(deliveryLine(event));
          }
        }
      }
      if (!finished) setNotice((current) => current ?? "Could not run today's brief.");
    } catch {
      setNotice("Could not run today's brief.");
    } finally {
      setStage(null);
      setPending(null);
    }
  }

  async function saveRules(productId: string, next: ProductRule) {
    setRulesState((current) => ({ ...current, [productId]: next }));
    setBrief((current) =>
      current.chosen.id === productId
        ? { ...current, chosen: { ...current.chosen, campaignPriceCents: next.campaignPriceCents } }
        : current,
    );
    const response = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, ...next }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setNotice(body?.error ?? "Could not save those rules.");
    }
  }

  async function submitSuggestion() {
    setPending("suggest");
    setNotice(null);
    try {
      const response = await fetch("/api/argue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: suggestion, productId: chosen.id, intent: "suggest" }),
      });
      const body = await response.json();
      if (body.brief) setBrief(body.brief);
      setNotice([body.reply, deliveryLine(body)].filter(Boolean).join(" "));
      setSuggestion("");
    } catch {
      setNotice("Could not send that to Grok.");
    } finally {
      setPending(null);
    }
  }

  async function editImage(variantId: string, message?: string) {
    setImageBusy(variantId);
    setNotice(null);
    try {
      const response = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message ? { variantId, message } : { variantId, regenerate: true }),
      });
      const body = await response.json();
      if (!response.ok) {
        setNotice(body.error ?? "Could not update that image.");
        return;
      }
      if (body.brief) setBrief(body.brief);
      setNotice(body.reply ?? null);
      setOpenNote(null);
      setImageNote("");
    } catch {
      setNotice("Could not update that image.");
    } finally {
      setImageBusy(null);
    }
  }

  async function chooseVariant(variantId: string) {
    const variant = variants.find((item) => item.id === variantId);
    if (!variant) return;
    setBrief((current) => ({
      ...current,
      chosen: { ...current.chosen, selectedVariantId: variantId, imageUrl: variant.imageUrl },
      campaigns: current.campaigns.map((campaign) => ({ ...campaign, imageUrl: variant.imageUrl })),
    }));
    await fetch("/api/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId }),
    });
  }

  async function savePlatformBudget(platform: "meta" | "tiktok") {
    const cents = Math.round(Number(budgetDraft[platform]) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return;
    setPending("budget");
    setBrief((current) => ({
      ...current,
      campaigns: current.campaigns.map((campaign) =>
        campaign.platform === platform ? { ...campaign, dailyBudgetCents: cents } : campaign,
      ),
    }));
    try {
      const response = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, dailyBudgetCents: cents }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setNotice(body?.error ?? "Could not save the budget.");
      }
    } finally {
      setPending(null);
    }
  }

  const meta = platformCampaign(brief, "meta", previewImage);
  const tiktok = platformCampaign(brief, "tiktok", previewImage);

  return (
    <>
    {stage ? <BriefLoading stage={stage} /> : null}
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-8 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {brief.shopName ?? "Store"} · {brief.source === "shopify" ? "Shopify" : "Seed"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        </div>
        <div className="text-right">
          <button
            type="button"
            onClick={() => void runBrief()}
            disabled={pending !== null}
            className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
          >
            {pending === "brief" ? "Running…" : "Run brief"}
          </button>
          {brief.timings ? (
            <p className="mt-2 font-mono text-xs text-muted">
              Research {seconds(brief.timings.researchMs)} · Analysis {seconds(brief.timings.analysisMs)} · Images{" "}
              {seconds(brief.timings.imagesMs)} · Total {seconds(brief.timings.totalMs)}
            </p>
          ) : null}
        </div>
      </header>
      {notice ? <p className="text-sm">{notice}</p> : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Shelf" value={gbp(chosen.priceCents)} />
        <Stat label="Campaign price" value={gbp(rule.campaignPriceCents)} />
        <Stat label="Profit" value={gbp(profitCents)} hint="Campaign price minus cost" />
        <Stat label="Margin" value={`${campaignMargin}%`} hint="Profit as a share of the campaign price" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-line bg-card p-5">
          <p className="text-sm text-muted">Chosen</p>
          <h2 className="mt-1 text-2xl font-semibold">{chosen.title}</h2>
          <p className="mt-1 text-sm text-muted">{chosen.stock} in stock</p>
          <div className="mt-5">
            <RuleFields shelfCents={chosen.priceCents} value={rule} onSave={(next) => void saveRules(chosen.id, next)} />
          </div>
          {chosen.priceSuggestion ? (
            <p className="mt-3 text-sm text-muted">
              {chosen.priceSuggestion.replace(
                /min(?:imum)? (?:campaign )?price of £[\d,.]+/i,
                `minimum price of ${gbp(rule.minPriceCents)}`,
              )}
            </p>
          ) : null}
          {priceLinks.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {priceLinks.map((link) => (
                <li key={link.url} className="text-sm">
                  <a href={link.url} className="underline" target="_blank" rel="noreferrer">
                    {link.title}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
        <article className="overflow-hidden rounded-2xl border border-line bg-card">
          <Photo src={stockUrl} alt={chosen.title} />
          <p className="px-5 py-3 text-xs uppercase tracking-wide text-muted">Stock</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {variants.map((variant) => (
          <article
            key={variant.id}
            className={`overflow-hidden rounded-2xl border bg-card ${
              variant.id === selected?.id ? "border-foreground" : "border-line"
            }`}
          >
            <Photo src={variant.imageUrl} alt={variant.label} />
            <div className="space-y-3 p-5">
              <p className="text-xs uppercase tracking-wide text-muted">{variant.label}</p>
              <p className="text-sm">{variant.why}</p>
              {variant.sourceUrl ? (
                <a href={variant.sourceUrl} className="block text-sm underline" target="_blank" rel="noreferrer">
                  {variant.sourceTitle || "Source"}
                </a>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {variants.length > 1 && variant.id !== selected?.id ? (
                  <button
                    type="button"
                    onClick={() => void chooseVariant(variant.id)}
                    className="rounded-full border border-foreground px-4 py-2 text-sm"
                  >
                    Use this
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={imageBusy !== null || pending !== null}
                  onClick={() => {
                    setOpenNote(variant.id);
                    setImageNote("");
                  }}
                  className="rounded-full border border-foreground px-4 py-2 text-sm disabled:opacity-50"
                >
                  Suggest image changes
                </button>
                <button
                  type="button"
                  disabled={imageBusy !== null || pending !== null}
                  onClick={() => void editImage(variant.id)}
                  className="rounded-full border border-line px-4 py-2 text-sm disabled:opacity-50"
                >
                  {imageBusy === variant.id ? "Working…" : "Regenerate"}
                </button>
              </div>
              {openNote === variant.id ? (
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!imageNote.trim()) return;
                    void editImage(variant.id, imageNote.trim());
                  }}
                >
                  <input
                    value={imageNote}
                    onChange={(event) => setImageNote(event.target.value)}
                    placeholder="Put this one on a model in a grey studio"
                    className="w-full rounded-full border border-line bg-background px-4 py-2 text-sm outline-none"
                  />
                  <button
                    type="submit"
                    disabled={imageBusy !== null}
                    className="rounded-full bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
                  >
                    Send
                  </button>
                </form>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Competitor ads</h2>
        {competitorAds.length > 0 ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {competitorAds.map((ad) => (
              <a
                key={ad.url}
                href={ad.url}
                target="_blank"
                rel="noreferrer"
                className="overflow-hidden rounded-xl border border-line bg-card"
              >
                <Photo src={ad.imageUrl || ""} alt={ad.title} />
                <p className="flex items-center gap-2 px-3 py-2 text-xs text-muted">
                  <PlatformLogo platform={ad.platform ?? "Google"} />
                  <span>{ad.title}</span>
                </p>
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Run a brief to pull live creatives from Google's Ads Transparency Center.</p>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Suggest other campaign</h2>
        <p className="mt-1 text-sm text-muted">
          Name another product. Blocked products stay off the campaign.
        </p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submitSuggestion();
          }}
        >
          <input
            value={suggestion}
            onChange={(event) => setSuggestion(event.target.value)}
            placeholder="Push the linen shirt instead"
            className="w-full rounded-full border border-line bg-background px-4 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={pending !== null}
            className="rounded-full border border-foreground px-4 py-2 text-sm disabled:opacity-50"
          >
            {pending === "suggest" ? "Asking…" : "Suggest"}
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Ads</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[meta, tiktok].map((campaign) => (
            <article key={campaign.platform} className="overflow-hidden rounded-2xl border border-line bg-card">
              <Photo src={previewImage} alt={campaign.headline} />
              <div className="space-y-2 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-lg font-semibold">
                    <PlatformLogo platform={campaign.platform} />
                    {campaign.platform === "meta" ? "Meta" : "TikTok"}
                  </h3>
                  <span className="rounded-full bg-background px-3 py-1 text-xs uppercase tracking-wide text-muted">
                    staged
                  </span>
                </div>
                <p className="text-sm font-medium">{campaign.headline}</p>
                <p className="text-sm text-muted">{campaign.primaryText}</p>
                <p className="text-sm">{gbp(rule.campaignPriceCents)}</p>
                <label className="flex items-center gap-2 text-sm text-muted">
                  £
                  <input
                    value={budgetDraft[campaign.platform]}
                    onChange={(event) =>
                      setBudgetDraft((current) => ({ ...current, [campaign.platform]: event.target.value }))
                    }
                    onBlur={() => void savePlatformBudget(campaign.platform)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void savePlatformBudget(campaign.platform);
                      }
                    }}
                    inputMode="decimal"
                    aria-label={`${campaign.platform === "meta" ? "Meta" : "TikTok"} budget per day`}
                    className="w-20 rounded-md border border-line bg-background px-2 py-1 text-foreground outline-none"
                  />
                  / day
                </label>
                <button
                  type="button"
                  onClick={() => setLiveNote("Staged. This does not send the ad yet.")}
                  className="rounded-full bg-foreground px-4 py-2 text-sm text-background"
                >
                  Go live
                </button>
              </div>
            </article>
          ))}
        </div>
        {liveNote ? <p className="text-sm text-muted">{liveNote}</p> : null}
      </section>
    </main>
    </>
  );
}

function BriefLoading({ stage }: { stage: BriefStage }) {
  const copy = {
    stock: "We're analysing your stock...",
    ads: "We're analysing competitor ads...",
    assets: "We're generating campaign assets...",
  }[stage];
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#f4f5f7]/92 backdrop-blur-md">
      <img src="/haggly.png" alt="" className="brief-logo h-44 w-44 object-contain" />
      <p className="mt-8 text-2xl font-semibold tracking-tight">{copy}</p>
    </div>
  );
}

function deliveryLine(body: {
  warning?: string | null;
  telegram?: { sent?: boolean; reason?: string };
  slack?: { sent?: boolean; reason?: string };
  grokbot?: { sent?: boolean; reason?: string };
}) {
  return [
    body.warning,
    body.telegram?.sent ? "Sent to Telegram." : body.telegram?.reason,
    body.slack?.sent ? "Sent to Slack." : body.slack?.reason,
    body.grokbot?.sent ? "Sent to Grok Bot." : body.grokbot?.reason,
  ]
    .filter(Boolean)
    .join(" ");
}

function variantsFor(brief: Brief, stockUrl: string): AdVariant[] {
  if (brief.chosen.variants?.length) return brief.chosen.variants;
  return [
    {
      id: "stock",
      label: "Stock",
      imageUrl: stockUrl,
      why: brief.chosen.adNote || "Run today's brief to make two stills from this photo.",
      sourceTitle: "",
      sourceUrl: "",
      prompt: brief.chosen.imagePrompt || "",
    },
  ];
}

function budgetOf(brief: Brief, platform: "meta" | "tiktok") {
  return (
    brief.campaigns.find((campaign) => campaign.platform === platform)?.dailyBudgetCents ??
    brief.policy.maxDailySpendCents
  );
}

function pounds(cents: number) {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

function platformCampaign(brief: Brief, platform: "meta" | "tiktok", imageUrl: string): CampaignDraft {
  const existing = brief.campaigns.find((campaign) => campaign.platform === platform);
  if (existing) return { ...existing, imageUrl };
  return {
    platform,
    name: `${brief.chosen.title} — ${platform}`,
    dailyBudgetCents: brief.policy.maxDailySpendCents,
    headline: brief.chosen.headline,
    primaryText: brief.chosen.primaryText,
    imageUrl,
    destinationUrl: brief.chosen.productUrl,
    status: "staged",
  };
}

function usefulLink(link: { title: string; url: string }) {
  return !/coinmarketcap|coingecko|binance|tokenised|crypto|forex/i.test(`${link.title} ${link.url}`);
}

function Photo({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <div className="bg-background">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} onError={() => setFailed(true)} className="h-auto w-full object-contain" />
    </div>
  );
}

function seconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold">{value}</dd>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
