import type { CompetitorAd } from "@/lib/types";

const SKIP_HOST =
  /google\.|facebook\.|instagram\.|pinterest\.|reddit\.|wikipedia\.|youtube\.|tiktok\.|amazon\.|ebay\.|medium\.|substack\./i;

type Creative = {
  advertiser?: string;
  format?: string;
  image?: string;
  width?: number;
  height?: number;
  details_link?: string;
  target_domain?: string;
  total_days_shown?: number;
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

async function search(text: string) {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return [] as Creative[];
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_ads_transparency_center");
  url.searchParams.set("text", text);
  url.searchParams.set("region", "2826");
  url.searchParams.set("num", "10");
  url.searchParams.set("api_key", key);

  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const json = (await response.json()) as { ad_creatives?: Creative[]; error?: string };
  if (!response.ok || json.error) {
    throw new Error(json.error || "SerpApi request failed");
  }
  return json.ad_creatives ?? [];
}

function toAd(row: Creative, query: string): CompetitorAd | null {
  if (!row.image) return null;
  if ((row.width && row.width < 48) || (row.height && row.height < 48)) return null;
  const name = row.advertiser || row.target_domain || query;
  const days = row.total_days_shown ? `, shown for ${row.total_days_shown} days` : "";
  return {
    title: name,
    url: row.details_link || `https://adstransparency.google.com/?region=GB&domain=${encodeURIComponent(query)}`,
    imageUrl: row.image,
    snippet: `${name} is running this ${row.format ?? "image"} ad${days}. It is public in Google's Ads Transparency Center.`,
    platform: "Google",
  };
}

export async function serpApiCompetitorAds(brands: string[], pageUrls: string[]) {
  if (!serpApiConfigured()) return { ads: [] as CompetitorAd[], warning: null as string | null };

  const queries = [...domainsFrom(pageUrls).slice(0, 2)];
  if (queries.length === 0 && brands[0]) queries.push(brands[0]);

  const ads: CompetitorAd[] = [];
  const seen = new Set<string>();
  try {
    for (const query of queries) {
      if (ads.length >= 4) break;
      for (const row of await search(query)) {
        const ad = toAd(row, query);
        if (!ad?.imageUrl || seen.has(ad.imageUrl)) continue;
        seen.add(ad.imageUrl);
        ads.push(ad);
        if (ads.length >= 4) break;
      }
    }
  } catch (error) {
    return {
      ads,
      warning: error instanceof Error ? error.message : "SerpApi request failed",
    };
  }
  return { ads, warning: null };
}
