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
  metaAdsUrl,
}: {
  initial: Brief;
  products: Product[];
  rules: Record<string, ProductRule>;
  metaAdsUrl?: string | null;
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
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-8 sm:px-8 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b-2 border-ink pb-8">
        <div>
          <p className="chip">
            <span className="h-2 w-2 rounded-full bg-good" />
            {brief.shopName ?? "Store"} · {brief.source === "shopify" ? "Shopify" : "Seed"}
          </p>
          <h1 className="display mt-4 text-[clamp(3rem,7vw,6rem)] uppercase">
            Today&apos;s <span className="serif normal-case">brief</span>
          </h1>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <button
            type="button"
            onClick={() => void runBrief()}
            disabled={pending !== null}
            className="studio-btn studio-btn-acid px-7 py-3.5 text-lg"
          >
            {pending === "brief" ? "Running…" : "Run brief ✺"}
          </button>
          {brief.timings ? (
            <p className="flex flex-wrap gap-1.5 font-mono text-[11px] text-muted">
              <span className="chip py-0.5">Research {seconds(brief.timings.researchMs)}</span>
              <span className="chip py-0.5">Analysis {seconds(brief.timings.analysisMs)}</span>
              <span className="chip py-0.5">Images {seconds(brief.timings.imagesMs)}</span>
              <span className="chip bg-ink py-0.5 text-accent">Total {seconds(brief.timings.totalMs)}</span>
            </p>
          ) : null}
        </div>
      </header>
      {notice ? (
        <p className="panel flex items-start gap-3 bg-lilac px-5 py-4 text-[15px] font-medium">
          <span className="display text-xl leading-none">✺</span>
          {notice}
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Shelf" value={gbp(chosen.priceCents)} tone="bg-card" />
        <Stat label="Campaign price" value={gbp(rule.campaignPriceCents)} tone="bg-accent" />
        <Stat label="Profit" value={gbp(profitCents)} hint="Campaign price minus cost" tone="bg-sky" />
        <Stat label="Margin" value={`${campaignMargin}%`} hint="Profit as a share of the campaign price" tone="bg-hot" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="panel p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <p className="kicker">(01) The pick</p>
            <span className={`sticker px-3 py-1 text-[11px] ${chosen.stock > rule.minStock ? "bg-accent" : "bg-hot"}`}>
              {chosen.stock} in stock
            </span>
          </div>
          <h2 className="display mt-4 text-[clamp(2.5rem,5vw,4rem)]">{chosen.title}</h2>
          <div className="mt-8 border-t-2 border-dashed border-ink/30 pt-6">
            <RuleFields shelfCents={chosen.priceCents} value={rule} onSave={(next) => void saveRules(chosen.id, next)} />
          </div>
          {chosen.priceSuggestion ? (
            <p className="serif mt-6 border-l-4 border-accent pl-4 text-xl leading-snug">
              {chosen.priceSuggestion.replace(
                /min(?:imum)? (?:campaign )?price of £[\d,.]+/i,
                `minimum price of ${gbp(rule.minPriceCents)}`,
              )}
            </p>
          ) : null}
          {priceLinks.length > 0 ? (
            <ul className="mt-5 flex flex-wrap gap-2">
              {priceLinks.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    className="chip max-w-xs truncate normal-case tracking-normal hover:bg-accent"
                    target="_blank"
                    rel="noreferrer"
                  >
                    ↗ <span className="truncate">{link.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
        <article className="panel relative overflow-hidden bg-well">
          <span className="sticker absolute top-4 left-4 z-10 -rotate-3 bg-card px-3 py-1 text-[11px]">Stock shot</span>
          <Photo src={stockUrl} alt={chosen.title} />
        </article>
      </section>

      <section>
        <SectionHead index="02" title="Creative" accent="variants" />
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {variants.map((variant) => {
            const active = variant.id === selected?.id;
            return (
              <article
                key={variant.id}
                className={`panel relative overflow-hidden ${active ? "shadow-[8px_8px_0_var(--accent),8px_8px_0_2px_var(--ink)]" : ""}`}
              >
                {active ? (
                  <span className="sticker absolute top-4 right-4 z-10 rotate-3 bg-accent px-3 py-1 text-[11px]">In use</span>
                ) : null}
                <div className="border-b-2 border-ink bg-well">
                  <Photo src={variant.imageUrl} alt={variant.label} />
                </div>
                <div className="space-y-4 p-6">
                  <p className="display text-2xl">{variant.label}</p>
                  <p className="text-[15px] leading-6 text-ink/75">{variant.why}</p>
                  {variant.sourceUrl ? (
                    <a href={variant.sourceUrl} className="chip normal-case tracking-normal hover:bg-accent" target="_blank" rel="noreferrer">
                      ↗ {variant.sourceTitle || "Source"}
                    </a>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {variants.length > 1 && !active ? (
                      <button
                        type="button"
                        onClick={() => void chooseVariant(variant.id)}
                        className="studio-btn studio-btn-acid studio-btn-sm"
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
                      className="studio-btn studio-btn-secondary studio-btn-sm"
                    >
                      Suggest changes
                    </button>
                    <button
                      type="button"
                      disabled={imageBusy !== null || pending !== null}
                      onClick={() => void editImage(variant.id)}
                      className="studio-btn studio-btn-secondary studio-btn-sm"
                    >
                      {imageBusy === variant.id ? "Working…" : "↻ Regenerate"}
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
                        className="studio-input rounded-full"
                        autoFocus
                      />
                      <button type="submit" disabled={imageBusy !== null} className="studio-btn studio-btn-primary">
                        Send
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHead index="03" title="Competitor" accent="ads" />
        {competitorAds.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {competitorAds.map((ad, index) => (
              <a
                key={ad.url}
                href={ad.url}
                target="_blank"
                rel="noreferrer"
                className={`panel panel-lift overflow-hidden ${index % 2 ? "rotate-1" : "-rotate-1"}`}
              >
                <div className="border-b-2 border-ink bg-well">
                  <Photo src={ad.imageUrl || ""} alt={ad.title} />
                </div>
                <div className="space-y-1.5 px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <PlatformLogo platform={ad.platform ?? "Google"} />
                    <span className="truncate">
                      {ad.platform ?? "Google"} · {ad.title}
                    </span>
                  </p>
                  <p className="line-clamp-3 text-xs leading-5 text-ink/70">
                    {ad.snippet.startsWith(`${ad.title}: `) ? ad.snippet.slice(ad.title.length + 2) : ad.snippet}
                  </p>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="stripes mt-6 rounded-[1.25rem] border-2 border-ink">
            <span className="m-6 inline-block rounded-lg border-2 border-ink bg-card px-4 py-3 text-[15px] font-medium">
              Run a brief to pull live creatives from Google and Meta.
            </span>
          </p>
        )}
        {brief.creativeAngles?.length ? (
          <div className="panel mt-6 bg-lilac p-6">
            <p className="kicker text-ink">Angles Grok took from these ads</p>
            <ol className="mt-4 grid gap-3 md:grid-cols-2">
              {brief.creativeAngles.map((angle, index) => (
                <li key={angle} className="flex gap-3 text-[15px] leading-6 font-medium">
                  <span className="display text-2xl leading-none">0{index + 1}</span>
                  {angle}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </section>

      <section className="panel relative overflow-hidden bg-ink p-6 text-card sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker text-accent">(04) Change of plan?</p>
            <h2 className="display mt-3 text-4xl sm:text-5xl">
              Suggest another <span className="serif text-accent">campaign.</span>
            </h2>
            <p className="mt-2 text-[15px] text-card/60">Name another product. Blocked products stay off the campaign.</p>
          </div>
        </div>
        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void submitSuggestion();
          }}
        >
          <input
            value={suggestion}
            onChange={(event) => setSuggestion(event.target.value)}
            placeholder="Push the linen shirt instead"
            className="studio-input rounded-full border-card px-5 py-3 text-base"
          />
          <button type="submit" disabled={pending !== null} className="studio-btn studio-btn-acid shrink-0 border-card px-7 py-3 text-base">
            {pending === "suggest" ? "Asking…" : "Suggest →"}
          </button>
        </form>
      </section>

      <section>
        <SectionHead index="05" title="Staged" accent="ads" />
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {[meta, tiktok].map((campaign) => (
            <article key={campaign.platform} className="panel overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b-2 border-ink px-5 py-3">
                <h3 className="display flex items-center gap-2 text-2xl">
                  <PlatformLogo platform={campaign.platform} />
                  {campaign.platform === "meta" ? "Meta" : "TikTok"}
                </h3>
                <span className="chip bg-accent">
                  <span className="blink h-1.5 w-1.5 rounded-full bg-ink" /> Staged
                </span>
              </div>
              <div className="border-b-2 border-ink bg-well">
                <Photo src={previewImage} alt={campaign.headline} />
              </div>
              <div className="space-y-3 p-6">
                <p className="display text-2xl leading-tight">{campaign.headline}</p>
                <p className="text-[15px] leading-6 text-ink/70">{campaign.primaryText}</p>
                <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-dashed border-ink/30 pt-4">
                  <p className="display text-3xl">{gbp(rule.campaignPriceCents)}</p>
                  <label className="studio-field gap-1 px-3 text-sm font-semibold">
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
                      className="num w-16 py-2"
                    />
                    <span className="font-mono text-xs text-muted">/ day</span>
                  </label>
                </div>
                {campaign.platform === "meta" && metaAdsUrl ? (
                  <a
                    href={metaAdsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="studio-btn studio-btn-primary w-full py-3 text-center text-base"
                  >
                    Go live ↗
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => setLiveNote("Staged. This does not send the ad yet.")}
                    className="studio-btn studio-btn-primary w-full py-3 text-base"
                  >
                    Go live ↗
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
        {liveNote ? <p className="kicker mt-4 text-ink">{liveNote}</p> : null}
      </section>
    </main>
    </>
  );
}

function SectionHead({ index, title, accent }: { index: string; title: string; accent: string }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b-2 border-ink pb-3">
      <h2 className="display text-4xl uppercase sm:text-5xl">
        {title} <span className="serif normal-case">{accent}</span>
      </h2>
      <span className="kicker">({index})</span>
    </div>
  );
}

function BriefLoading({ stage }: { stage: BriefStage }) {
  const steps: BriefStage[] = ["stock", "ads", "assets"];
  const copy = {
    stock: "Analysing your stock",
    ads: "Reading competitor ads",
    assets: "Generating campaign assets",
  };
  const current = steps.indexOf(stage);
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden bg-accent px-6">
      <div className="dotgrid absolute inset-0" aria-hidden="true" />
      <img src="/haggly.png" alt="" className="brief-logo relative h-48 w-48 object-contain" />
      <p className="display relative mt-8 text-center text-[clamp(2.5rem,6vw,5rem)] uppercase">
        {copy[stage]}
        <span className="blink">…</span>
      </p>
      <ol className="relative mt-8 flex flex-wrap justify-center gap-2">
        {steps.map((step, index) => (
          <li
            key={step}
            className={`chip ${index < current ? "bg-ink text-accent" : index === current ? "bg-card" : "bg-transparent opacity-50"}`}
          >
            {index < current ? "✓" : `0${index + 1}`} {step}
          </li>
        ))}
      </ol>
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
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={() => setFailed(true)} className="h-auto w-full object-contain" />
  );
}

function seconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone: string }) {
  return (
    <div className={`panel flex flex-col justify-between gap-4 p-5 ${tone}`}>
      <p className="kicker text-ink">{label}</p>
      <div>
        <p className="display num text-[clamp(2rem,4vw,3.25rem)]">{value}</p>
        {hint ? <p className="mt-2 text-xs font-medium text-ink/65">{hint}</p> : null}
      </div>
    </div>
  );
}
