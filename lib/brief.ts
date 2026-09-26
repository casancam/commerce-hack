import { applyResearch, buildPreview, carryBudgets, gbpFacts, stageCampaigns, suggestionMessage } from "@/lib/decide";
import { grokAdImage, grokChat, grokConfigured, parseGrokJson } from "@/lib/grok";
import { loadCatalog, type Catalog } from "@/lib/live-catalog";
import { suggestCampaignPrice } from "@/lib/pricing";
import { adEvidence, competitorNote, competitorPrices, researchOpportunity, type ResearchHit } from "@/lib/research";
import { loadRules, saveRule } from "@/lib/rules";
import { stockReference } from "@/lib/stock";
import { latestBrief, saveDecision } from "@/lib/store";
import type { AdVariant, Brief, Product, ProductRule } from "@/lib/types";

type GrokPick = {
  chosenId?: string;
  opportunities?: { id?: string; why?: string }[];
};

type GrokVariant = {
  label?: string;
  why?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  imagePrompt?: string;
};

type GrokCreative = {
  headline?: string;
  primaryText?: string;
  adNote?: string;
  variants?: GrokVariant[];
  telegram?: string;
};

function clip(value: string | undefined, max: number, fallback: string) {
  const text = value?.trim();
  if (!text) return fallback;
  return text.slice(0, max);
}

function slug(label: string, index: number) {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "variant"}-${index + 1}`;
}

function whyMap(items: { id?: string; why?: string }[] | undefined) {
  return new Map(
    (items ?? []).filter((item) => item.id && item.why).map((item) => [item.id as string, item.why as string]),
  );
}

function draftVariants(parsed: GrokCreative, hits: ResearchHit[], title: string) {
  const ads = hits.filter((hit) => hit.kind === "ad");
  const fallbacks = [
    {
      label: "On a model",
      why: ads[0]
        ? `Borrows the worn-in format from ${ads[0].title}.`
        : "A model wearing the product, because worn shots are the usual clothing format.",
      sourceTitle: ads[0]?.title ?? "",
      sourceUrl: ads[0]?.url ?? "",
      imagePrompt: `A person wearing this exact ${title}, photographed on a street in daylight.`,
    },
    {
      label: "Styled set",
      why: ads[1]
        ? `Borrows the clean studio format from ${ads[1].title}.`
        : "A styled studio shot, the other format that keeps showing up for this kind of product.",
      sourceTitle: ads[1]?.title ?? ads[0]?.title ?? "",
      sourceUrl: ads[1]?.url ?? ads[0]?.url ?? "",
      imagePrompt: `This exact ${title} styled in a quiet studio, soft daylight, nothing else competing with it.`,
    },
  ];
  return fallbacks.map((fallback, index) => {
    const draft = parsed.variants?.[index];
    return {
      label: clip(draft?.label, 40, fallback.label),
      why: clip(draft?.why, 400, fallback.why),
      sourceTitle: clip(draft?.sourceTitle, 160, fallback.sourceTitle),
      sourceUrl: draft?.sourceUrl?.startsWith("http") ? draft.sourceUrl : fallback.sourceUrl,
      imagePrompt: clip(draft?.imagePrompt, 700, fallback.imagePrompt),
    };
  });
}

async function pickWithGrok(catalog: Catalog, rules: Record<string, ProductRule>) {
  const system = [
    "You are Haggly.",
    "Each product has its own minMarginPct, minStock, and minPrice. Never promote a blocked product.",
    "Choose the eligible product with the best mix of unsold stock, healthy margin, and a price that can carry an ad.",
    "Do not invent prices, stock, or margins.",
    'Reply with JSON only: {"chosenId":"","opportunities":[{"id":"","why":""}]}',
    "why is one sentence a merchant can read. Include every eligible id.",
  ].join(" ");
  const parsed = parseGrokJson<GrokPick>(
    await grokChat(
      system,
      JSON.stringify({
        shop: catalog.shopName,
        description: catalog.shopDescription,
        catalog: gbpFacts(catalog.products, rules),
      }),
    ),
  );
  const brief = buildPreview(catalog, parsed.chosenId, rules);
  const reasons = whyMap(parsed.opportunities);
  brief.grok = true;
  brief.opportunities = brief.opportunities.map((item) => ({
    ...item,
    why: reasons.get(item.id) ?? item.why,
  }));
  return brief;
}

async function editVariants(
  drafts: ReturnType<typeof draftVariants>,
  stock: string,
  onImage?: (index: number, total: number, label: string) => void,
): Promise<{ variants: AdVariant[]; imagesMs: number }> {
  const started = Date.now();
  const variants: AdVariant[] = [];
  for (const [index, draft] of drafts.entries()) {
    onImage?.(index, drafts.length, draft.label);
    let imageUrl = stock;
    try {
      imageUrl = await grokAdImage(draft.imagePrompt, stock);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
    }
    variants.push({
      id: slug(draft.label, index),
      label: draft.label,
      imageUrl,
      why: draft.why,
      sourceTitle: draft.sourceTitle,
      sourceUrl: draft.sourceUrl,
      prompt: draft.imagePrompt,
    });
  }
  return { variants, imagesMs: Date.now() - started };
}

async function creativeWithGrok(
  brief: Brief,
  catalog: Catalog,
  hits: ResearchHit[],
  angles: string[],
  priceNote: string,
  campaignPriceCents: number,
  budgets: { meta: number; tiktok: number },
  onProgress?: (update: BriefUpdate) => void,
) {
  const product = catalog.products.find((item) => item.id === brief.chosen.id);
  const system = [
    "You are Haggly. Write today's ad for the product already chosen.",
    "The campaign price is already decided. Do not invent a different price.",
    "Use the ads that are already running. Each variant must name one of those sources and the format it borrows.",
    "angles are creative directions taken from the strongest competitor ads for this product. Build each variant's scene on one of them, pushed further so ours stands out. Never copy a brand.",
    "Two image variants of the same stock photo: one with a person wearing the exact product, one in a styled setting.",
    "imagePrompt describes only the scene. The attached photo stays the product. No text, letters, logo, or price in the image.",
    "Reply with JSON only.",
    '{"headline":"","primaryText":"","adNote":"","variants":[{"label":"","why":"","sourceTitle":"","sourceUrl":"","imagePrompt":""},{"label":"","why":"","sourceTitle":"","sourceUrl":"","imagePrompt":""}],"telegram":""}',
    "telegram is the short daily message and starts with Haggly.",
  ].join(" ");
  const copyStarted = Date.now();
  onProgress?.({ stage: "copy", detail: "Writing the headline and the two scenes", step: 5, total: BRIEF_STEPS });
  const parsed = parseGrokJson<GrokCreative>(
    await grokChat(
      system,
      JSON.stringify({
        shop: catalog.shopName,
        description: catalog.shopDescription,
        product: product
          ? {
              title: product.title,
              campaignPriceCents,
              marginPct: brief.chosen.marginPct,
              stock: product.stock,
              unitsSold30d: product.unitsSold30d,
            }
          : brief.chosen,
        priceNote,
        ads: adEvidence(hits),
        angles,
      }),
    ),
  );
  const copyMs = Date.now() - copyStarted;

  const headline = clip(parsed.headline, 80, brief.chosen.headline);
  const primaryText = clip(parsed.primaryText, 280, brief.chosen.primaryText);
  const drafts = draftVariants(parsed, hits, brief.chosen.title);
  const stock = product ? stockReference(product) : brief.chosen.imageUrl;
  const edited = await editVariants(drafts, stock, (index, total, label) => {
    onProgress?.({
      stage: "image",
      detail: `Editing still ${index + 1} of ${total}: ${label}. Each still usually takes about a minute.`,
      step: 6 + index,
      total: BRIEF_STEPS,
    });
  });
  const variants = edited.variants;
  const selected = variants.find((variant) => !variant.imageUrl.startsWith("/products/")) ?? variants[0];
  const generatedImage = variants.some((variant) => variant.imageUrl.startsWith("http"));

  const chosenProduct: Product = product ?? {
    id: brief.chosen.id,
    title: brief.chosen.title,
    priceCents: brief.chosen.priceCents,
    costCents: brief.chosen.costCents,
    stock: brief.chosen.stock,
    unitsSold30d: brief.chosen.unitsSold30d,
    imageUrl: stock,
    productUrl: brief.chosen.productUrl,
  };

  return {
    brief: {
    ...brief,
    grok: true,
    generatedImage,
    chosen: {
      ...brief.chosen,
      imageUrl: selected?.imageUrl || stock,
      headline,
      primaryText,
      adNote: clip(parsed.adNote, 400, drafts.map((draft) => draft.why).join(" ")),
      imagePrompt: selected?.prompt || drafts[0].imagePrompt,
      variants,
      selectedVariantId: selected?.id || variants[0]?.id || "",
      campaignPriceCents,
    },
    campaigns: stageCampaigns(
      chosenProduct,
      { headline, primaryText },
      selected?.imageUrl || stock,
      budgets,
    ),
    telegram: clip(
      parsed.telegram,
      900,
      suggestionMessage(
        brief.chosen.title,
        campaignPriceCents,
        brief.chosen.marginPct,
        brief.chosen.stock,
        brief.chosen.unitsSold30d,
        budgets,
      ),
    ),
  } satisfies Brief,
    copyMs,
    imagesMs: edited.imagesMs,
  };
}

export type BriefStage = "stock" | "photo" | "ads" | "rank" | "copy" | "image";

export type BriefUpdate = {
  stage: BriefStage;
  detail: string;
  step: number;
  total: number;
};

const BRIEF_STEPS = 7;

export async function runBrief(onProgress?: (update: BriefUpdate) => void) {
  const totalStarted = Date.now();
  onProgress?.({ stage: "stock", detail: "Choosing which product to promote", step: 1, total: BRIEF_STEPS });
  const catalog = await loadCatalog();
  const { rules } = await loadRules(catalog.products);
  const previous = await latestBrief();
  const budgets = {
    meta: previous?.campaigns.find((campaign) => campaign.platform === "meta")?.dailyBudgetCents ?? 15000,
    tiktok: previous?.campaigns.find((campaign) => campaign.platform === "tiktok")?.dailyBudgetCents ?? 15000,
  };
  const warnings: string[] = [];
  let analysisMs = 0;
  let imagesMs = 0;
  let preview = buildPreview(catalog, undefined, rules);

  if (!grokConfigured()) {
    warnings.push("Set XAI_API_KEY from console.x.ai so Haggly can choose the product and generate the ad.");
  } else {
    const pickStarted = Date.now();
    try {
      preview = await pickWithGrok(catalog, rules);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Grok could not choose a product");
    }
    analysisMs += Date.now() - pickStarted;
  }

  const researchStarted = Date.now();
  const research = await researchOpportunity(preview.chosen.title, preview.chosen.imageUrl, (stage) => {
    if (stage === "photo") {
      onProgress?.({ stage, detail: `Reading the photo of ${preview.chosen.title}`, step: 2, total: BRIEF_STEPS });
    }
    if (stage === "ads") {
      onProgress?.({ stage, detail: "Looking up prices and competitor ads", step: 3, total: BRIEF_STEPS });
    }
    if (stage === "rank") {
      onProgress?.({ stage, detail: "Comparing those ads with your product", step: 4, total: BRIEF_STEPS });
    }
  });
  const researchMs = Date.now() - researchStarted;
  if (research.warning) warnings.push(research.warning);
  const priceNote = competitorNote(research.hits, preview.chosen.priceCents, preview.chosen.costCents);
  let brief = applyResearch(preview, priceNote, research.links, research.competitorAd);

  const rule = rules[brief.chosen.id];
  const suggestion = suggestCampaignPrice({
    sellingCents: brief.chosen.priceCents,
    costCents: brief.chosen.costCents,
    competitorCents: competitorPrices(research.hits, brief.chosen.priceCents, brief.chosen.costCents),
    minMarginPct: rule?.minMarginPct ?? 40,
    minPriceCents: rule?.minPriceCents ?? 0,
  });
  brief = {
    ...brief,
    chosen: {
      ...brief.chosen,
      campaignPriceCents: suggestion.cents,
      priceSuggestion: suggestion.note,
    },
  };

  brief.competitorAds = research.competitorAds;
  brief.creativeAngles = research.angles;
  if (grokConfigured()) {
    try {
      const created = await creativeWithGrok(
        brief,
        catalog,
        research.hits,
        research.angles,
        priceNote,
        suggestion.cents,
        budgets,
        onProgress,
      );
      brief = created.brief;
      analysisMs += created.copyMs;
      imagesMs = created.imagesMs;
      brief.research = research.links;
      brief.competitorAd = research.competitorAd;
      brief.competitorAds = research.competitorAds;
      brief.creativeAngles = research.angles;
      brief.chosen.priceSuggestion = suggestion.note;
      brief.chosen.campaignPriceCents = suggestion.cents;
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Grok could not write the ad");
    }
  }

  brief.timings = {
    researchMs,
    analysisMs,
    imagesMs,
    totalMs: Date.now() - totalStarted,
  };

  if (brief.grok && !brief.generatedImage) {
    warnings.push("The product was chosen. The ad stills could not be edited, so both variants use the stock photo.");
  }

  if (rule) {
    try {
      await saveRule(brief.chosen.id, { ...rule, campaignPriceCents: brief.chosen.campaignPriceCents });
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Could not save the campaign price");
    }
  }

  brief = carryBudgets(brief, previous);
  await saveDecision(brief);
  return { brief, warning: warnings.filter(Boolean).join(" ") || null };
}
