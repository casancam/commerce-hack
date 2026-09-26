import { POLICY, PRODUCTS } from "@/lib/catalog";
import { gbp, marginPct } from "@/lib/format";
import type { CounterResult, Product } from "@/lib/types";

export function parsePounds(input: string) {
  const match = input.trim().match(/^£?\s*(\d+(?:\.\d{1,2})?)$/);
  if (!match) return null;
  const pounds = Number(match[1]);
  if (!Number.isFinite(pounds) || pounds <= 0) return null;
  return pounds;
}

export function checkCounter(product: Product, pounds: number): CounterResult {
  const proposedPriceCents = Math.round(pounds * 100);
  const margin = marginPct(proposedPriceCents, product.costCents);
  const stockOk = product.stock >= POLICY.minStock;
  const marginOk = margin >= POLICY.minMarginPct;
  const priceLabel = gbp(proposedPriceCents);

  let reply: string;
  if (marginOk && stockOk) {
    reply = `Doable. At ${priceLabel} the margin is ${margin}%, with ${product.stock} in stock.`;
  } else if (!marginOk && !stockOk) {
    reply = `Not doable. At ${priceLabel} the margin is ${margin}%, under your ${POLICY.minMarginPct}% floor, and stock is ${product.stock}.`;
  } else if (!marginOk) {
    reply = `Not doable. At ${priceLabel} the margin is ${margin}%, under your ${POLICY.minMarginPct}% floor. Stock is ${product.stock}.`;
  } else {
    reply = `Not doable. Stock is ${product.stock}, under the floor of ${POLICY.minStock}. Margin at ${priceLabel} would be ${margin}%.`;
  }

  return {
    doable: marginOk && stockOk,
    proposedPriceCents,
    marginPct: margin,
    stock: product.stock,
    reply,
  };
}

export function productForCounter(productId?: string) {
  return PRODUCTS.find((product) => product.id === productId) ?? PRODUCTS.find((product) => product.id === "wool-overshirt")!;
}
