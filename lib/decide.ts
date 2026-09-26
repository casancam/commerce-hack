import { POLICY, PRODUCTS } from "@/lib/catalog";
import { marginPct } from "@/lib/format";
import type { Bundle, Product } from "@/lib/types";

function rejectionReason(product: Product, margin: number) {
  const reasons: string[] = [];
  if (product.stock < POLICY.minStock) {
    reasons.push(
      `Stock is ${product.stock}, under the floor of ${POLICY.minStock}`,
    );
  }
  if (margin < POLICY.minMarginPct) {
    reasons.push(
      `Margin is ${margin}%, under the floor of ${POLICY.minMarginPct}%`,
    );
  }
  return reasons.join(". ");
}

export function buildBundle(): Bundle {
  const evaluated = PRODUCTS.map((product) => {
    const margin = marginPct(product.priceCents, product.costCents);
    const reason = rejectionReason(product, margin);
    return { product, margin, reason };
  });

  const eligible = evaluated
    .filter((item) => item.reason === "")
    .sort((a, b) => a.product.unitsSold30d - b.product.unitsSold30d);

  const chosen = eligible[0];
  if (!chosen) {
    throw new Error("No product clears the policy");
  }

  const headline = `${chosen.product.title} that is sitting in stock`;
  const primaryText = `In stock. ${chosen.margin}% margin.`;

  const campaigns = (["meta", "tiktok"] as const).map((platform) => ({
    platform,
    name: `${chosen.product.title} — today`,
    dailyBudgetCents: POLICY.maxDailySpendCents,
    headline,
    primaryText,
    imageUrl: chosen.product.imageUrl,
    destinationUrl: chosen.product.productUrl,
    status: "staged" as const,
  }));

  return {
    status: "ready",
    policy: POLICY,
    rejected: evaluated
      .filter((item) => item.reason !== "")
      .map((item) => ({ title: item.product.title, reason: item.reason })),
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
    },
    campaigns,
  };
}

export function suggestionMessage(bundle: Bundle) {
  const { chosen, policy } = bundle;
  const pounds = (policy.maxDailySpendCents / 100).toFixed(0);
  return [
    `Today: ${chosen.title}`,
    `£${(chosen.priceCents / 100).toFixed(0)} · ${chosen.marginPct}% margin · ${chosen.stock} in stock`,
    `Sold ${chosen.unitsSold30d} in the last 30 days.`,
    "",
    `Campaign staged at £${pounds}/day on Meta and TikTok.`,
    "",
    "Reply with a price to counter.",
  ].join("\n");
}
