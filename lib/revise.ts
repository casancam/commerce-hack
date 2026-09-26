import { grokAdImage, grokChat, parseGrokJson } from "@/lib/grok";
import { loadCatalog } from "@/lib/live-catalog";
import { stockReference } from "@/lib/stock";
import { latestBrief, saveDecision } from "@/lib/store";
import type { AdVariant, Brief } from "@/lib/types";

type GrokRevise = {
  reply?: string;
  label?: string;
  why?: string;
  imagePrompt?: string;
};

function clip(value: string | undefined, max: number, fallback: string) {
  const text = value?.trim();
  if (!text) return fallback;
  return text.slice(0, max);
}

function variantsOf(brief: Brief, productTitle: string, stock: string) {
  if (brief.chosen.variants?.length) return brief.chosen.variants;
  return [
    {
      id: "on-a-model-1",
      label: "On a model",
      imageUrl: stock,
      why: "",
      sourceTitle: "",
      sourceUrl: "",
      prompt: `A person wearing this exact ${productTitle}.`,
    },
    {
      id: "styled-set-2",
      label: "Styled set",
      imageUrl: stock,
      why: "",
      sourceTitle: "",
      sourceUrl: "",
      prompt: `This exact ${productTitle} in a styled studio.`,
    },
  ];
}

export async function reviseVariant(variantId: string, message?: string) {
  const brief = await latestBrief();
  if (!brief?.chosen) throw new Error("Run today's brief first.");
  const catalog = await loadCatalog();
  const product = catalog.products.find((item) => item.id === brief.chosen.id);
  if (!product) throw new Error("That product is not in the catalog.");

  const stock = stockReference(product);
  const current = variantsOf(brief, product.title, stock);
  const variant = current.find((item) => item.id === variantId);
  if (!variant) throw new Error("That image is not on this brief.");

  let prompt = variant.prompt;
  let why = variant.why;
  let label = variant.label;
  let reply = "Regenerated from the stock photo.";

  if (message?.trim()) {
    const parsed = parseGrokJson<GrokRevise>(
      await grokChat(
        [
          "You revise one square ad still. A photo of the exact product will be attached to the image model.",
          "Keep that product identical. Apply the merchant's note to the scene only.",
          'Reply with JSON only: {"reply":"","label":"","why":"","imagePrompt":""}',
          "reply is one sentence. imagePrompt has no text, logo, or price.",
        ].join(" "),
        JSON.stringify({
          product: product.title,
          note: message,
          label: variant.label,
          prompt: variant.prompt,
        }),
      ),
    );
    prompt = clip(parsed.imagePrompt, 700, `${variant.prompt} ${message}`);
    why = clip(parsed.why, 400, variant.why);
    label = clip(parsed.label, 40, variant.label);
    reply = clip(parsed.reply, 400, "Updated that still from the stock photo.");
  }

  const imageUrl = await grokAdImage(prompt, stock);
  const variants: AdVariant[] = current.map((item) =>
    item.id === variantId ? { ...item, label, why, imageUrl, prompt } : item,
  );
  const selected = variants.find((item) => item.id === brief.chosen.selectedVariantId) ?? variants[0];
  const next: Brief = {
    ...brief,
    generatedImage: variants.some((item) => item.imageUrl.startsWith("http")),
    chosen: {
      ...brief.chosen,
      variants,
      selectedVariantId: selected?.id || "",
      imageUrl: selected?.imageUrl || stock,
      imagePrompt: selected?.prompt || brief.chosen.imagePrompt,
    },
    campaigns: brief.campaigns.map((campaign) => ({
      ...campaign,
      imageUrl: selected?.imageUrl || campaign.imageUrl,
    })),
  };
  await saveDecision(next);
  return { brief: next, reply };
}

export async function selectVariant(variantId: string) {
  const brief = await latestBrief();
  if (!brief) throw new Error("Run today's brief first.");
  const variant = brief.chosen.variants?.find((item) => item.id === variantId);
  if (!variant) throw new Error("That variant is not on this brief.");
  const next: Brief = {
    ...brief,
    chosen: {
      ...brief.chosen,
      selectedVariantId: variantId,
      imageUrl: variant.imageUrl,
    },
    campaigns: brief.campaigns.map((campaign) => ({ ...campaign, imageUrl: variant.imageUrl })),
  };
  await saveDecision(next);
  return next;
}
