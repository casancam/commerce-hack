import { gbp } from "@/lib/format";
import type { Brief } from "@/lib/types";

export function proposalText(brief: Brief) {
  const chosen = brief.chosen;
  const variants = chosen.variants ?? [];
  const lines = [
    `Haggly · ${chosen.title}`,
    "",
    `Campaign price ${gbp(chosen.campaignPriceCents)}`,
    chosen.priceSuggestion,
    `Shelf ${gbp(chosen.priceCents)} · margin ${chosen.marginPct}% · ${chosen.stock} in stock`,
    "",
    chosen.headline,
    chosen.primaryText,
    "",
    variants.length ? "Variants" : "No stills yet. Reply “another image” to make one.",
    ...variants.map((variant, index) => `${index + 1}. ${variant.label}${variant.why ? ` — ${variant.why}` : ""}`),
    "",
    "Reply with:",
    "• price 85 — change the campaign price",
    "• another image: on a wet street — add a still",
    "• change 1: darker studio — edit a variant",
    "• use 2 — put that still on the ads",
    "• push the linen shirt — switch product",
    "Or send a voice note in this Slack thread.",
  ];
  return lines.join("\n");
}
