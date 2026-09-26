import type { CompetitorAd } from "@/lib/types";

const SKIP_HOST =
  /google\.|facebook\.|instagram\.|pinterest\.|reddit\.|wikipedia\.|youtube\.|tiktok\.|amazon\.|ebay\.|etsy\.|vinted\.|depop\.|lyst\.|idealo\.|pricerunner\.|medium\.|substack\./i;

type ListedCreative = {
  advertiser?: string;
  advertiser_id?: string;
  ad_creative_id?: string;
  details_link?: string;
  total_days_shown?: number;
  first_shown?: number;
  last_shown?: number;
};

type DetailedCreative = {
  image?: string;
  snippet?: string;
  headline?: string;
  call_to_action?: string;
};

export function serpApiConfigured() {
  return Boolean(process.env.SERPAPI_API_KEY);
}

function domainsFrom(urls: string[]) {
  const hosts: string[] = [];
  for (const url of urls) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      if (!host || SKIP_HOST.test(host)) continue;
      hosts.push(host);
    } catch {
      continue;
    }
  }
  return [...new Set(hosts)];
}

async function serp<T>(params: Record<string, string>) {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) throw new Error("Set SERPAPI_API_KEY");
  const url = new URL("https://serpapi.com/search.json");
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  url.searchParams.set("api_key", key);
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  const json = (await response.json()) as T & { error?: string };
  if (!response.ok || json.error) throw new Error(json.error || "SerpApi request failed");
  return json;
}

function visualImage(url: string | undefined) {
  if (!url) return null;
  if (url.includes("/archive/simgad/")) return null;
  if (/gstatic\.com\/shopping|sadbundle|ggpht\.com|ytimg\.com/i.test(url)) return url;
  return null;
}

// The Transparency Center only searches by advertiser domain or legal name, so find
// the shops that rank for the product first and look up their ads by domain.
async function sellerDomains(garment: string) {
  const search = await serp<{ organic_results?: { link?: string }[] }>({
    engine: "google",
    q: garment,
    gl: "uk",
    hl: "en",
    google_domain: "google.co.uk",
    num: "20",
  });
  return domainsFrom((search.organic_results ?? []).map((row) => row.link ?? ""));
}

async function imageAds(domain: string) {
  const listed = await serp<{ ad_creatives?: ListedCreative[] }>({
    engine: "google_ads_transparency_center",
    text: domain,
    region: "2826",
    creative_format: "image",
    num: "20",
  }).catch(() => ({ ad_creatives: [] as ListedCreative[] }));
  const rows = (listed.ad_creatives ?? []).filter((row) => row.advertiser_id && row.ad_creative_id).slice(0, 8);
  const ads = await Promise.all(
    rows.map(async (row): Promise<CompetitorAd | null> => {
      const details = await serp<{ ad_creatives?: DetailedCreative[] }>({
        engine: "google_ads_transparency_center_ad_details",
        advertiser_id: row.advertiser_id as string,
        creative_id: row.ad_creative_id as string,
        region: "2826",
      }).catch(() => null);
      const creative = (details?.ad_creatives ?? []).find((item) => visualImage(item.image));
      const imageUrl = visualImage(creative?.image);
      if (!creative || !imageUrl) return null;
      const name = row.advertiser || domain;
      const line = creative.headline || creative.snippet || creative.call_to_action;
      const days = daysShown(row);
      return {
        title: name,
        url: row.details_link || `https://adstransparency.google.com/?region=GB&domain=${encodeURIComponent(domain)}`,
        imageUrl,
        snippet: line ? `${name}: ${line.replace(/\s+/g, " ").slice(0, 180)}` : `${name} is running this Google ad.`,
        platform: "Google",
        daysShown: days,
        active: stillOn(row.last_shown),
      };
    }),
  );
  return ads.filter((ad): ad is CompetitorAd => Boolean(ad));
}

function daysShown(row: ListedCreative) {
  if (row.total_days_shown && row.total_days_shown > 0) return Math.round(row.total_days_shown);
  if (row.first_shown && row.last_shown && row.last_shown >= row.first_shown) {
    return Math.max(1, Math.round((row.last_shown - row.first_shown) / 86_400));
  }
  return undefined;
}

function stillOn(lastShown?: number) {
  if (!lastShown) return undefined;
  return Date.now() / 1000 - lastShown < 86_400 * 3;
}

function mentions(ad: CompetitorAd, garment: string) {
  const noun = garment.toLowerCase().split(/\s+/).filter(Boolean).pop() ?? "";
  return noun.length > 2 && ad.snippet.toLowerCase().includes(noun);
}

export async function serpApiCompetitorAds(garment: string, pageUrls: string[] = []) {
  if (!serpApiConfigured()) return { ads: [] as CompetitorAd[], warning: null as string | null };

  try {
    const domains = [...new Set([...(await sellerDomains(garment)), ...domainsFrom(pageUrls)])].slice(0, 4);
    const found = (await Promise.all(domains.map(imageAds))).flat();
    const seen = new Set<string>();
    const unique = found.filter((ad) => ad.imageUrl && !seen.has(ad.imageUrl) && seen.add(ad.imageUrl));
    const named = unique.filter((ad) => mentions(ad, garment));
    const ads = named.length >= 3 ? named : [...named, ...unique.filter((ad) => !mentions(ad, garment))];
    return { ads: ads.slice(0, 8), warning: null as string | null };
  } catch (error) {
    return { ads: [] as CompetitorAd[], warning: error instanceof Error ? error.message : "SerpApi request failed" };
  }
}
