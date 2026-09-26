export type Product = {
  id: string;
  title: string;
  priceCents: number;
  costCents: number;
  stock: number;
  unitsSold30d: number;
  imageUrl: string;
  productUrl: string;
};

export type Policy = {
  minMarginPct: number;
  maxDailySpendCents: number;
  minStock: number;
};

export type Rejection = {
  title: string;
  reason: string;
};

export type CampaignDraft = {
  platform: "meta" | "tiktok";
  name: string;
  dailyBudgetCents: number;
  headline: string;
  primaryText: string;
  imageUrl: string;
  destinationUrl: string;
  status: "staged";
};

export type Chosen = {
  id: string;
  title: string;
  priceCents: number;
  costCents: number;
  marginPct: number;
  stock: number;
  unitsSold30d: number;
  imageUrl: string;
  productUrl: string;
  headline: string;
  primaryText: string;
};

export type Bundle = {
  status: "ready";
  policy: Policy;
  rejected: Rejection[];
  chosen: Chosen;
  campaigns: CampaignDraft[];
};

export type CounterResult = {
  doable: boolean;
  proposedPriceCents: number;
  marginPct: number;
  stock: number;
  reply: string;
};
