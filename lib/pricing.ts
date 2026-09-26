import { gbp } from "@/lib/format";

export function priceForMargin(costCents: number, minMarginPct: number) {
  if (costCents <= 0) return 0;
  const margin = Math.min(95, Math.max(0, minMarginPct));
  return Math.ceil(costCents / (1 - margin / 100));
}

export function minPriceFromMargin(shelfCents: number, minMarginPct: number) {
  const margin = Math.min(95, Math.max(0, minMarginPct));
  return Math.round(shelfCents * (1 + margin / 100));
}

export function marginFromMinPrice(shelfCents: number, minPriceCents: number) {
  if (shelfCents <= 0) return 0;
  return Math.min(95, Math.max(0, Math.round((minPriceCents * 100) / shelfCents)));
}

export function extractGbpCents(texts: string[]) {
  return texts
    .flatMap((text) =>
      [...text.matchAll(/£\s?(\d+(?:\.\d{1,2})?)/g)].map((match) => Math.round(Number(match[1]) * 100)),
    )
    .filter((cents) => cents >= 500 && cents <= 50000);
}

export function plausibleCompetitorCents(cents: number[], sellingCents: number, costCents: number) {
  const low = Math.max(costCents, Math.round(sellingCents * 0.45));
  const high = Math.round(sellingCents * 2.5);
  return cents.filter((price) => price >= low && price <= high);
}

export function suggestCampaignPrice(input: {
  sellingCents: number;
  costCents: number;
  competitorCents: number[];
  minMarginPct: number;
  minPriceCents: number;
}) {
  const floor = Math.max(0, input.minPriceCents);
  if (input.competitorCents.length === 0) {
    const cents = Math.max(input.sellingCents, floor);
    return {
      cents,
      note: "No clear competitor prices yet, so the campaign price stays on the shelf price.",
    };
  }

  const cheapest = Math.min(...input.competitorCents);
  const undercut = Math.round(cheapest * 0.95);
  if (undercut >= floor) {
    return {
      cents: undercut,
      note: `${gbp(undercut)} is 5% under the cheapest competitor at ${gbp(cheapest)}, above the minimum price of ${gbp(floor)}.`,
    };
  }

  return {
    cents: floor,
    note: `5% under ${gbp(cheapest)} would sit under the minimum price, so the campaign price is held at ${gbp(floor)}.`,
  };
}
