import { POLICY } from "@/lib/catalog";
import { gbp, marginPct } from "@/lib/format";
import type { Catalog } from "@/lib/live-catalog";
import { defaultRule } from "@/lib/rules";
import type {
  Brief,
  CampaignDraft,
  CompetitorAd,
  Opportunity,
  Product,
  ProductRule,
  ResearchLink,
} from "@/lib/types";

export type Evaluated = {
  product: Product;
  margin: number;
  reason: string;
};

function ruleFor(product: Product, rules?: Record<string, ProductRule>) {
  return rules?.[product.id] ?? defaultRule(product);
}

export function evaluate(products: Product[], rules?: Record<string, ProductRule>): Evaluated[] {
  return products.map((product) => {
    const rule = ruleFor(product, rules);
    const margin = marginPct(product.priceCents, product.costCents);
    const reasons: string[] = [];
    if (product.costCents <= 0) {
      reasons.push("Cost is missing, so margin cannot be checked");
    } else if (margin < rule.minMarginPct) {
      reasons.push(`Margin is ${margin}%, under the min campaign profit of ${rule.minMarginPct}%`);
    }
    if (product.stock <= rule.minStock) {
      reasons.push(`Stock is ${product.stock}. Stop when stock is ${rule.minStock} or less`);
    }
    return { product, margin, reason: reasons.join(". ") };
  });
}

export function eligibleProducts(products: Product[], rules?: Record<string, ProductRule>) {
  return evaluate(products, rules)
    .filter((item) => item.reason === "")
    .sort((a, b) => a.product.unitsSold30d - b.product.unitsSold30d || b.margin - a.margin);
}

export function stageCampaigns(
  product: Product,
  creative: { headline: string; primaryText: string },
  imageUrl: string,
  budgets: { meta: number; tiktok: number } = {
    meta: POLICY.maxDailySpendCents,
    tiktok: POLICY.maxDailySpendCents,
  },
): CampaignDraft[] {
  return (["meta", "tiktok"] as const).map((platform) => ({
    platform,
    name: `${product.title} — ${platform}`,
    dailyBudgetCents: budgets[platform],
    headline: creative.headline,
    primaryText: creative.primaryText,
    imageUrl,
    destinationUrl: product.productUrl,
    status: "staged" as const,
  }));
}

export function suggestionMessage(
  title: string,
  priceCents: number,
  margin: number,
  stock: number,
  unitsSold30d: number,
  budgets: { meta: number; tiktok: number } = {
    meta: POLICY.maxDailySpendCents,
    tiktok: POLICY.maxDailySpendCents,
  },
) {
  const meta = (budgets.meta / 100).toFixed(0);
  const tiktok = (budgets.tiktok / 100).toFixed(0);
  const spend = meta === tiktok ? `£${meta}/day on Meta and TikTok` : `Meta £${meta}/day · TikTok £${tiktok}/day`;
  return [
    `Haggly: ${title}`,
    `Campaign price £${(priceCents / 100).toFixed(0)} · ${margin}% margin · ${stock} in stock`,
    `Sold ${unitsSold30d} in the last 30 days.`,
    "",
    `Campaigns staged at ${spend}. Nothing is sent yet.`,
  ].join("\n");
}

export function carryBudgets(next: Brief, previous: Brief | null): Brief {
  if (!previous) return next;
  return {
    ...next,
    campaigns: next.campaigns.map((campaign) => {
      const saved = previous.campaigns.find((item) => item.platform === campaign.platform);
      return saved ? { ...campaign, dailyBudgetCents: saved.dailyBudgetCents } : campaign;
    }),
  };
}

export function buildPreview(catalog: Catalog, preferredId?: string, rules?: Record<string, ProductRule>): Brief {
  const evaluated = evaluate(catalog.products, rules);
  const eligible = eligibleProducts(catalog.products, rules);
  const chosen = eligible.find((item) => item.product.id === preferredId) ?? eligible[0];
  if (!chosen) throw new Error("No product clears its rules");

  const rule = ruleFor(chosen.product, rules);
  const headline = `${chosen.product.title} that is sitting in stock`;
  const primaryText = `In stock. ${chosen.margin}% margin.`;
  const imagePrompt = `Keep the attached ${chosen.product.title} identical. Place it in natural daylight.`;
  const opportunities: Opportunity[] = eligible.map((item) => ({
    id: item.product.id,
    title: item.product.title,
    priceCents: item.product.priceCents,
    marginPct: item.margin,
    stock: item.product.stock,
    unitsSold30d: item.product.unitsSold30d,
    stance: item.product.id === chosen.product.id ? "promote" : "hold",
    why:
      item.product.id === chosen.product.id
        ? "Clears this product's margin, minimum price, and stock, and it is the slowest seller that does."
        : "Clears its own floors, but other stock is moving slower.",
  }));

  return {
    source: catalog.source,
    shopName: catalog.shopName,
    grok: false,
    generatedImage: false,
    policy: POLICY,
    rejected: evaluated
      .filter((item) => item.reason !== "")
      .map((item) => ({ title: item.product.title, reason: item.reason })),
    opportunities,
    chosen: {
      id: chosen.product.id,
      title: chosen.product.title,
      priceCents: chosen.product.priceCents,
      costCents: chosen.product.costCents,
      marginPct: chosen.margin,
      stock: chosen.product.stock,
      unitsSold30d: chosen.product.unitsSold30d,
      imageUrl: chosen.product.imageUrl,
      productUrl: chosen.product.productUrl,
      headline,
      primaryText,
      competitorNote: "Run today's brief to compare competitor prices.",
      adNote: "Run today's brief to see which ads are working for this product.",
      imagePrompt,
      variants: [],
      selectedVariantId: "",
      campaignPriceCents: rule.campaignPriceCents,
      priceSuggestion: "",
    },
    campaigns: stageCampaigns(chosen.product, { headline, primaryText }, chosen.product.imageUrl),
    research: [],
    competitorAd: null,
    competitorAds: [],
    telegram: suggestionMessage(
      chosen.product.title,
      rule.campaignPriceCents,
      chosen.margin,
      chosen.product.stock,
      chosen.product.unitsSold30d,
    ),
  };
}

export function decisionBoard(
  products: Product[],
  rules: Record<string, ProductRule>,
  brief: Brief | null,
) {
  const evaluated = evaluate(products, rules);
  const eligible = eligibleProducts(products, rules);
  const chosenId = brief?.chosen.id ?? eligible[0]?.product.id;
  const why = new Map((brief?.opportunities ?? []).map((item) => [item.id, item.why]));
  const opportunities: Opportunity[] = eligible.map((item) => ({
    id: item.product.id,
    title: item.product.title,
    priceCents: item.product.priceCents,
    marginPct: item.margin,
    stock: item.product.stock,
    unitsSold30d: item.product.unitsSold30d,
    stance: item.product.id === chosenId ? "promote" : "hold",
    why:
      why.get(item.product.id) ??
      (item.product.id === chosenId
        ? "Clears this product's margin, minimum price, and stock."
        : "Clears its own floors."),
  }));
  return {
    opportunities,
    rejected: evaluated
      .filter((item) => item.reason !== "")
      .map((item) => ({ title: item.product.title, reason: item.reason })),
  };
}

export function applyResearch(
  brief: Brief,
  note: string,
  research: ResearchLink[],
  competitorAd: CompetitorAd | null = null,
): Brief {
  return {
    ...brief,
    chosen: {
      ...brief.chosen,
      competitorNote: note,
    },
    research,
    competitorAd,
  };
}

export function gbpFacts(products: Product[], rules?: Record<string, ProductRule>) {
  return evaluate(products, rules).map((item) => {
    const rule = ruleFor(item.product, rules);
    return {
      id: item.product.id,
      title: item.product.title,
      price: gbp(item.product.priceCents),
      cost: gbp(item.product.costCents),
      priceCents: item.product.priceCents,
      costCents: item.product.costCents,
      marginPct: item.margin,
      stock: item.product.stock,
      unitsSold30d: item.product.unitsSold30d,
      minMarginPct: rule.minMarginPct,
      minStock: rule.minStock,
      minPrice: gbp(rule.minPriceCents),
      eligible: item.reason === "",
      blocked: item.reason,
    };
  });
}
