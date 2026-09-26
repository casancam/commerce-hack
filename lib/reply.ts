import { answerMerchant, generateSuggestedBrief } from "@/lib/argue";
import { POLICY } from "@/lib/catalog";
import { gbp, marginPct } from "@/lib/format";
import { loadCatalog } from "@/lib/live-catalog";
import { loadRules, saveRule } from "@/lib/rules";
import { addVariant, reviseVariant, selectVariant } from "@/lib/revise";
import { latestBrief, saveDecision } from "@/lib/store";
import type { AdVariant, Brief } from "@/lib/types";

export type MerchantReply = {
  reply: string;
  brief: Brief | null;
  imageUrls: string[];
};

const ORDINALS: Record<string, number> = { first: 1, "1st": 1, second: 2, "2nd": 2, third: 3, "3rd": 3 };

function variantNumber(text: string) {
  const digit = text.match(/\b(?:variant|image|still|number|#)?\s*(\d)\b/i)?.[1];
  if (digit) return Number(digit);
  const word = text.toLowerCase().match(/\b(first|1st|second|2nd|third|3rd)\b/)?.[1];
  return word ? ORDINALS[word] : null;
}

function pickVariant(variants: AdVariant[], text: string, brief: Brief) {
  const number = variantNumber(text);
  if (number && variants[number - 1]) return variants[number - 1];
  return variants.find((variant) => variant.id === brief.chosen.selectedVariantId) ?? variants[0];
}

function pricePounds(text: string) {
  const explicit = text.match(
    /\b(?:price|priced|charge|charging|sell(?:ing)?)\b[^£\d]{0,40}£?\s*(\d+(?:\.\d{1,2})?)/i,
  );
  if (explicit) return Number(explicit[1]);
  if (/\b(?:price|priced|charge|charging)\b/i.test(text)) {
    const any = text.match(/£\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)/);
    const amount = any?.[1] || any?.[2];
    if (amount) return Number(amount);
  }
  const bare = text.trim().match(/^£?\s*(\d+(?:\.\d{1,2})?)$/);
  if (bare) return Number(bare[1]);
  return null;
}

function moreImageNote(text: string) {
  const asks =
    /\b(?:another|more|extra|new)\b[\s\S]{0,40}\b(?:image|images|still|stills|variant|variants|creative|creatives)\b/i.test(
      text,
    ) || /\b(?:create|make|generate|add)\b[\s\S]{0,40}\b(?:image|images|still|stills|variant|variants)\b/i.test(text);
  if (!asks) return null;
  const note = text
    .replace(/^.*?\b(?:image|images|still|stills|variant|variants|creative|creatives)\b\s*[:\-–]?\s*/i, "")
    .trim();
  return note || "A new scene, different from the stills we already have.";
}

function editNote(text: string) {
  if (/^(re-?generate|redo)(?:\s+.*)?$/i.test(text.trim())) return "";
  if (!/\b(?:change|edit|tweak|update|redo|regenerate)\b/i.test(text)) return null;
  if (/\b(?:price|product|campaign)\b/i.test(text) && !/\b(?:image|still|variant)\b/i.test(text)) return null;
  return text
    .replace(/^.*?\b(?:change|edit|tweak|update|redo|regenerate)\b\s*(?:variant|image|still)?\s*\d?\s*[:\-–]?\s*/i, "")
    .trim();
}

export async function handleMerchantReply(message: string): Promise<MerchantReply> {
  const text = message.trim();
  if (!text) {
    return { reply: "Say what to change: a price, another image, or another product.", brief: null, imageUrls: [] };
  }

  if (/^(go live|push ads|push the ads|push it)$/i.test(text) || text.toLowerCase() === "push") {
    const brief = await latestBrief();
    if (!brief) return { reply: "Run a brief first.", brief: null, imageUrls: [] };
    return {
      reply: "Staged. Meta and TikTok are not connected, so this does not send the ad yet.",
      brief,
      imageUrls: [],
    };
  }

  const pounds = pricePounds(text);
  if (pounds !== null && pounds > 0) {
    return setCampaignPrice(pounds);
  }

  const extra = moreImageNote(text);
  if (extra) {
    const added = await addVariant(extra);
    return { reply: added.reply, brief: added.brief, imageUrls: added.imageUrl ? [added.imageUrl] : [] };
  }

  const brief = await latestBrief();
  const variants = brief?.chosen.variants ?? [];
  const edit = variants.length ? editNote(text) : null;
  if (brief && edit !== null) {
    const variant = pickVariant(variants, text, brief);
    const revised = await reviseVariant(variant.id, edit || undefined);
    const image = revised.brief.chosen.variants?.find((item) => item.id === variant.id)?.imageUrl;
    return { reply: revised.reply, brief: revised.brief, imageUrls: image ? [image] : [] };
  }

  if (brief && /^(use|pick|select)\b/i.test(text)) {
    const variant = pickVariant(variants, text, brief);
    if (!variantNumber(text) && variants.length > 1) {
      return { reply: "Say which still, for example “use 2”.", brief, imageUrls: [] };
    }
    const next = await selectVariant(variant.id);
    return { reply: `Using “${variant.label}” on the ads.`, brief: next, imageUrls: [variant.imageUrl] };
  }

  const catalog = await loadCatalog();
  const hay = text.toLowerCase();
  const named = catalog.products.some(
    (product) => hay.includes(product.title.toLowerCase()) || hay.includes(product.id.replaceAll("-", " ")),
  );
  if (named && /\b(instead|switch|other|suggest|push|use|try|promote)\b/i.test(text)) {
    const outcome = await generateSuggestedBrief(text, brief?.chosen.id);
    const images = (outcome.brief?.chosen.variants ?? [])
      .map((variant) => variant.imageUrl)
      .filter((url) => url.startsWith("https://"));
    return { reply: outcome.reply, brief: outcome.brief, imageUrls: images };
  }

  const outcome = await answerMerchant(text, brief?.chosen.id);
  return { reply: outcome.reply, brief: outcome.brief, imageUrls: [] };
}

async function setCampaignPrice(pounds: number): Promise<MerchantReply> {
  const brief = await latestBrief();
  if (!brief?.chosen) return { reply: "Run a brief first, then send the price.", brief: null, imageUrls: [] };
  const catalog = await loadCatalog();
  const product = catalog.products.find((item) => item.id === brief.chosen.id);
  if (!product) return { reply: "That product is no longer in the catalog.", brief: null, imageUrls: [] };

  const { rules } = await loadRules(catalog.products);
  const rule = rules[product.id];
  const cents = Math.round(pounds * 100);
  const minStock = rule?.minStock ?? POLICY.minStock;
  const floor = rule?.minPriceCents ?? 0;
  if (product.stock <= minStock) {
    return {
      reply: `Not doable. Stock is ${product.stock}. Stop when stock is ${minStock} or less.`,
      brief: null,
      imageUrls: [],
    };
  }
  if (floor > 0 && cents < floor) {
    return {
      reply: `Not doable. ${gbp(cents)} is under the floor of ${gbp(floor)}.`,
      brief: null,
      imageUrls: [],
    };
  }

  const next: Brief = {
    ...brief,
    chosen: {
      ...brief.chosen,
      campaignPriceCents: cents,
      marginPct: marginPct(cents, product.costCents),
      priceSuggestion: `Campaign price set to ${gbp(cents)} from your reply.`,
    },
  };
  await saveDecision(next);
  if (rule) await saveRule(product.id, { ...rule, campaignPriceCents: cents });
  return {
    reply: `Doable. Campaign price is now ${gbp(cents)}, margin ${marginPct(cents, product.costCents)}%, ${product.stock} in stock.`,
    brief: next,
    imageUrls: [],
  };
}
