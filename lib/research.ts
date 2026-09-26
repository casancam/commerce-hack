import { garmentFromPhoto, grokConfigured, rankCompetitorAds } from "@/lib/grok";
import { sameProduct } from "@/lib/product-match";
import { metaLibraryAds } from "@/lib/meta";
import { extractGbpCents, plausibleCompetitorCents } from "@/lib/pricing";
import { publicCompetitorAds } from "@/lib/public-ads";
import { serpApiCompetitorAds, serpApiConfigured } from "@/lib/serpapi";
import { tavilyConfigured, tavilySearch, type TavilyHit } from "@/lib/tavily";
import type { CompetitorAd, ResearchLink } from "@/lib/types";

export type ResearchHit = TavilyHit & { kind: "price" | "ad"; imageUrl: string | null };

function absoluteImage(pageUrl: string, image: string) {
  if (image.startsWith("http")) return image;
  try {
    return new URL(image, pageUrl).toString();
  } catch {
    return null;
  }
}

async function ogImage(pageUrl: string) {
  try {
    const response = await fetch(pageUrl, {
      signal: AbortSignal.timeout(4000),
      headers: { "User-Agent": "Haggly" },
      redirect: "follow",
    });
    if (!response.ok) return null;
    const html = await response.text();
    const match =
      html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ??
      html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    return match?.[1] ? absoluteImage(pageUrl, match[1]) : null;
  } catch {
    return null;
  }
}

export async function researchOpportunity(
  title: string,
  imageUrl?: string,
  onProgress?: (stage: "photo" | "ads" | "rank") => void,
  options?: { quick?: boolean },
) {
  if (!tavilyConfigured()) {
    return {
      links: [] as ResearchLink[],
      hits: [] as ResearchHit[],
      competitorAd: null as CompetitorAd | null,
      competitorAds: [] as CompetitorAd[],
      angles: [] as string[],
      warning: "Set TAVILY_API_KEY to look up competitor prices and ads.",
    };
  }

  const links: ResearchLink[] = [];
  const hits: ResearchHit[] = [];
  const seen = new Set<string>();
  const problems: string[] = [];
  const looseImages: string[] = [];

  let garment = title;
  if (!options?.quick && imageUrl && grokConfigured()) {
    onProgress?.("photo");
    try {
      garment = (await garmentFromPhoto(imageUrl, title)).garment || title;
    } catch (error) {
      problems.push(error instanceof Error ? error.message : "Grok could not read the product photo");
    }
  }

  onProgress?.("ads");
  const priceSearch = (async () => {
    try {
      const search = await tavilySearch(`${garment} buy price GBP UK`, 4, false);
      looseImages.push(...search.images);
      for (const hit of search.results) {
        if (seen.has(hit.url)) continue;
        if (/coinmarketcap|coingecko|binance|tokenised|crypto|forex/i.test(`${hit.title} ${hit.url}`)) continue;
        seen.add(hit.url);
        hits.push({ ...hit, kind: "price", imageUrl: null });
        links.push({
          query: `${garment} buy price GBP UK`,
          title: hit.title,
          url: hit.url,
          kind: "price",
          imageUrl: null,
          snippet: hit.content.replace(/\s+/g, " ").slice(0, 280),
        });
      }
    } catch (error) {
      problems.push(error instanceof Error ? error.message : "Tavily search failed");
    }
  })();

  const adSearch = findCompetitorAds({
    garment,
    productImageUrl: imageUrl,
    pageUrls: [],
    brands: [title],
    onProgress,
    rank: !options?.quick,
    allowPublic: !options?.quick,
  });

  const emptyAds = {
    competitorAds: [] as CompetitorAd[],
    angles: [] as string[],
    ranked: false,
    problems: [] as string[],
  };
  const [, found] = await Promise.all([
    within(priceSearch, options?.quick ? 8_000 : 20_000, undefined),
    within(adSearch, options?.quick ? 15_000 : 45_000, emptyAds),
  ]);
  problems.push(...found.problems);
  const { competitorAds, angles } = found;
  if (!serpApiConfigured() && competitorAds.every((ad) => !ad.imageUrl)) {
    problems.push("Set SERPAPI_API_KEY to load competitor creatives from Google Ads Transparency.");
  }
  for (const ad of competitorAds) {
    if (seen.has(ad.url)) continue;
    seen.add(ad.url);
    hits.push({ title: ad.title, url: ad.url, content: ad.snippet, kind: "ad", imageUrl: ad.imageUrl });
    links.push({
      query: ad.platform === "Meta" ? "Meta Ad Library" : "Google Ads Transparency",
      title: ad.title,
      url: ad.url,
      kind: "ad",
      imageUrl: ad.imageUrl,
      snippet: ad.snippet,
    });
  }

  const competitorAd =
    competitorAds[0] ?? (options?.quick || found.ranked ? null : await bestCompetitorAd(hits, looseImages));
  return { links, hits, competitorAd, competitorAds, angles, warning: problems[0] ?? null };
}

export async function findCompetitorAds({
  garment,
  productImageUrl,
  pageUrls = [],
  brands = [],
  onProgress,
  rank = true,
  allowPublic = true,
}: {
  garment: string;
  productImageUrl?: string;
  pageUrls?: string[];
  brands?: string[];
  onProgress?: (stage: "rank") => void;
  rank?: boolean;
  allowPublic?: boolean;
}) {
  const problems: string[] = [];
  const [serp, meta] = await Promise.all([serpApiCompetitorAds(garment, pageUrls), metaLibraryAds(garment)]);
  if (serp.warning) problems.push(serp.warning);
  if (meta.warning) console.error(meta.warning);
  const direct =
    allowPublic && serp.ads.length + meta.ads.length < 3 ? await publicCompetitorAds(brands, pageUrls) : [];
  const relevant = [...meta.ads, ...serp.ads, ...direct].filter((ad) =>
    sameProduct(`${ad.title} ${ad.snippet} ${ad.hook ?? ""}`, garment),
  );
  if (relevant.length === 0 && serp.ads.length + meta.ads.length + direct.length > 0) {
    problems.push(`Found live ads, but none were for a ${garment}.`);
  }
  const candidates = dedupeAds(relevant, 12);

  if (!rank || !productImageUrl || !grokConfigured() || candidates.length === 0) {
    return { competitorAds: candidates.slice(0, 8), angles: [] as string[], ranked: false, problems };
  }

  try {
    onProgress?.("rank");
    const { verdicts, angles } = await rankCompetitorAds(
      productImageUrl,
      garment,
      candidates.map((ad) => ({ title: ad.title, imageUrl: ad.imageUrl, text: ad.snippet })),
    );
    const competitorAds = verdicts
      .filter((verdict) => verdict.match)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((verdict) => {
        const ad = candidates[verdict.index];
        return verdict.hook ? { ...ad, hook: verdict.hook } : ad;
      });
    return { competitorAds, angles: competitorAds.length > 0 ? angles : [], ranked: true, problems };
  } catch (error) {
    problems.push(error instanceof Error ? error.message : "Grok could not rank the competitor ads");
    return { competitorAds: candidates.slice(0, 8), angles: [] as string[], ranked: false, problems };
  }
}

function within<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

function dedupeAds(ads: CompetitorAd[], limit: number) {
  const seen = new Set<string>();
  const perBrand = new Map<string, number>();
  const unique: CompetitorAd[] = [];
  const overflow: CompetitorAd[] = [];
  for (const ad of ads) {
    const key = ad.imageUrl || ad.url;
    if (seen.has(key)) continue;
    seen.add(key);
    const brand = ad.title.toLowerCase();
    const count = perBrand.get(brand) ?? 0;
    if (count >= 2) {
      overflow.push(ad);
      continue;
    }
    perBrand.set(brand, count + 1);
    unique.push(ad);
    if (unique.length >= limit) return unique;
  }
  for (const ad of overflow) {
    if (unique.length >= limit) break;
    unique.push(ad);
  }
  return unique;
}

function isArticle(url: string) {
  return /\/blog\/|medium\.com|substack\.com/i.test(url);
}

async function bestCompetitorAd(hits: ResearchHit[], looseImages: string[]): Promise<CompetitorAd | null> {
  const ads = hits.filter((hit) => hit.kind === "ad");
  const first = ads.find((hit) => !isArticle(hit.url)) ?? ads[0];
  if (!first) return null;
  const article = isArticle(first.url);
  const imageUrl = article ? null : first.imageUrl || looseImages[0] || (await ogImage(first.url));
  const platform = /adstransparency\.google|googlesyndication/i.test(first.url)
    ? "Google"
    : /facebook\.com\/ads|instagram\.com/i.test(first.url)
      ? "Meta"
      : /tiktok\.com/i.test(first.url)
        ? "TikTok"
        : null;
  if (!platform || !imageUrl) return null;
  return {
    title: first.title,
    url: first.url,
    imageUrl,
    snippet: first.content.replace(/\s+/g, " ").slice(0, 280),
    platform,
  };
}

export function competitorPrices(hits: ResearchHit[], sellingCents = 0, costCents = 0) {
  const prices = extractGbpCents(
    hits.filter((hit) => hit.kind === "price").map((hit) => `${hit.title} ${hit.content}`),
  );
  if (sellingCents <= 0) return prices;
  return plausibleCompetitorCents(prices, sellingCents, costCents);
}

export function competitorNote(hits: ResearchHit[], ourPriceCents: number, costCents = 0) {
  const prices = competitorPrices(hits, ourPriceCents, costCents);
  if (prices.length === 0) {
    return hits.some((hit) => hit.kind === "price")
      ? "Tavily found listings, but no clear £ prices to compare."
      : "No competitor prices yet.";
  }

  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const ours = (ourPriceCents / 100).toFixed(0);
  const lowLabel = (low / 100).toFixed(0);
  const highLabel = (high / 100).toFixed(0);
  const range = low === high ? `£${lowLabel}` : `£${lowLabel}–£${highLabel}`;
  if (ourPriceCents > high) return `Competitor listings sit around ${range}. Ours is £${ours}, above that range.`;
  if (ourPriceCents < low) return `Competitor listings sit around ${range}. Ours is £${ours}, below that range.`;
  return `Competitor listings sit around ${range}. Ours is £${ours}, inside that range.`;
}

export function adEvidence(hits: ResearchHit[]) {
  return hits
    .filter((hit) => hit.kind === "ad")
    .slice(0, 6)
    .map((hit) => `${hit.title} ${hit.url}. ${hit.content}`.replace(/\s+/g, " ").slice(0, 360))
    .join("\n");
}
