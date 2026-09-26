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

export type ProductRule = {
  minPriceCents: number;
  campaignPriceCents: number;
  minMarginPct: number;
  minStock: number;
};

export type AdVariant = {
  id: string;
  label: string;
  imageUrl: string;
  why: string;
  sourceTitle: string;
  sourceUrl: string;
  prompt: string;
};

export type CompetitorAd = {
  title: string;
  url: string;
  imageUrl: string | null;
  snippet: string;
  platform: "Google" | "Meta" | "TikTok";
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

export type Opportunity = {
  id: string;
  title: string;
  priceCents: number;
  marginPct: number;
  stock: number;
  unitsSold30d: number;
  stance: "promote" | "hold";
  why: string;
};

export type ResearchLink = {
  query: string;
  title: string;
  url: string;
  kind: "price" | "ad";
  imageUrl?: string | null;
  snippet?: string;
};

export type Brief = {
  source: "shopify" | "seed";
  shopName: string | null;
  grok: boolean;
  generatedImage: boolean;
  policy: Policy;
  rejected: Rejection[];
  opportunities: Opportunity[];
  chosen: Chosen & {
    competitorNote: string;
    adNote: string;
    imagePrompt: string;
    variants: AdVariant[];
    selectedVariantId: string;
    campaignPriceCents: number;
    priceSuggestion: string;
  };
  campaigns: CampaignDraft[];
  research: ResearchLink[];
  competitorAd: CompetitorAd | null;
  competitorAds: CompetitorAd[];
  creativeAngles?: string[];
  timings?: {
    researchMs: number;
    analysisMs: number;
    imagesMs: number;
    totalMs: number;
  };
  telegram: string;
  slack?: { channel: string; ts: string };
};

export type CounterResult = {
  doable: boolean;
  proposedPriceCents: number;
  marginPct: number;
  stock: number;
  reply: string;
};
