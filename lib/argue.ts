import { checkCounter, parsePounds } from "@/lib/counter";
import { buildPreview, carryBudgets, eligibleProducts, evaluate, gbpFacts } from "@/lib/decide";
import { grokChat, grokConfigured } from "@/lib/grok";
import { loadCatalog } from "@/lib/live-catalog";
import { loadRules } from "@/lib/rules";
import { latestBrief, saveDecision } from "@/lib/store";
import { runBrief } from "@/lib/brief";
import type { Brief, Product } from "@/lib/types";

function productFrom(products: Product[], id?: string) {
  return products.find((product) => product.id === id);
}

function mentionedProducts(products: Product[], text: string) {
  const hay = text.toLowerCase();
  return products.filter((product) => {
    const title = product.title.toLowerCase();
    const words = product.id.replaceAll("-", " ");
    return hay.includes(title) || hay.includes(words);
  });
}

export async function answerMerchant(message: string, productId?: string, intent?: string) {
  const text = message.trim();
  if (!text) {
    return { reply: "Say which product the next campaign should push.", brief: null as Brief | null, result: null };
  }

  if (intent !== "suggest" && /\bcampaigns?\b/i.test(text)) {
    const { brief, warning } = await runBrief();
    const reply = warning ? `${brief.telegram}\n\n${warning}` : brief.telegram;
    return { reply, brief, result: null };
  }

  const catalog = await loadCatalog();
  const { rules } = await loadRules(catalog.products);
  const saved = await latestBrief();
  const board = evaluate(catalog.products, rules);
  const blocked = board.filter((item) => item.reason);
  const mentioned = mentionedProducts(catalog.products, text);
  const mentionedBlocked = mentioned.filter((product) => blocked.some((item) => item.product.id === product.id));
  const mentionedOpen = mentioned.filter((product) => !mentionedBlocked.some((item) => item.id === product.id));

  if (intent === "suggest" && mentioned.length > 0 && mentionedOpen.length === 0) {
    const lines = mentionedBlocked.map((product) => {
      const reason = blocked.find((item) => item.product.id === product.id)?.reason;
      return `${product.title} stays off the campaign. ${reason}`;
    });
    return { reply: lines.join(" "), brief: null, result: null };
  }

  if (intent === "suggest" && mentionedOpen.length === 1) {
    const next = mentionedOpen[0];
    const brief = carryBudgets(buildPreview(catalog, next.id, rules), saved);
    const held = mentionedBlocked
      .map((product) => {
        const reason = blocked.find((item) => item.product.id === product.id)?.reason;
        return `${product.title} stays off. ${reason}`;
      })
      .join(" ");
    const reply = [`Switched the campaign to ${next.title}. It clears its rules.`, held].filter(Boolean).join(" ");
    brief.telegram = reply;
    brief.chosen.competitorNote = "Switched after your note. Run today's brief to redraw the ad.";
    await saveDecision(brief);
    return { reply, brief, result: null };
  }

  const preview = buildPreview(catalog, productId ?? saved?.chosen.id, rules);
  const product = productFrom(catalog.products, productId) ?? productFrom(catalog.products, preview.chosen.id);
  if (!product) throw new Error("No product clears its rules");

  const pounds = parsePounds(text);
  if (intent !== "suggest" && pounds !== null) {
    const result = checkCounter(product, pounds, rules[product.id]);
    return { reply: result.reply, brief: null, result };
  }

  if (!grokConfigured()) {
    return {
      reply:
        intent === "suggest"
          ? "Add XAI_API_KEY from console.x.ai so Grok can switch the campaign."
          : "Add XAI_API_KEY from console.x.ai so Grok can argue the pick. A price like 70 still checks margin without it.",
      brief: null,
      result: null,
    };
  }

  const system = [
    "You are Haggly. Each product's margin, minimum price, and stock floors are absolute.",
    "You may switch the pick only to an eligible product. Never switch to a blocked product.",
    `Blocked, and off limits: ${blocked.map((item) => `${item.product.id} (${item.reason})`).join("; ") || "none"}.`,
    `Eligible ids: ${board
      .filter((item) => !item.reason)
      .map((item) => item.product.id)
      .join(", ")}.`,
    "If you switch, the first line must be SWITCH <id>. Otherwise the first line must be KEEP.",
    "Then write a short reply the merchant will read.",
    "Do not invent prices or stock. Do not agree to break the floor.",
  ].join(" ");
  const user = JSON.stringify({
    currentPick: preview.chosen.id,
    merchant: text,
    catalog: gbpFacts(catalog.products, rules),
  });
  const raw = await grokChat(system, user);
  const switchId = raw.match(/^\s*SWITCH\s+([a-z0-9-]+)/im)?.[1];
  const reply = raw.replace(/^\s*(SWITCH\s+\S+|KEEP)\s*$/gim, "").trim() || raw.trim();

  if (!switchId || switchId === preview.chosen.id) {
    return { reply, brief: null, result: null };
  }

  const next = eligibleProducts(catalog.products, rules).find((item) => item.product.id === switchId);
  if (!next) {
    const blocked = evaluate(catalog.products, rules).find((item) => item.product.id === switchId);
    const reason = blocked?.reason || "It is not in the catalog.";
    return {
      reply: `${blocked?.product.title ?? switchId} stays off the list. ${reason}`,
      brief: null,
      result: null,
    };
  }

  const brief = carryBudgets(buildPreview(catalog, switchId, rules), saved);
  brief.telegram = reply;
  brief.chosen.competitorNote = "Switched after your note. Run today's brief to redraw the ad.";
  await saveDecision(brief);
  return { reply, brief, result: null };
}
