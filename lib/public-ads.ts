import type { CompetitorAd } from "@/lib/types";

const RPC = "https://adstransparency.google.com/anji/_/rpc/";
const SKIP_HOST =
  /google\.|facebook\.|instagram\.|pinterest\.|reddit\.|wikipedia\.|youtube\.|tiktok\.|amazon\.|ebay\.|medium\.|substack\./i;

type Advertiser = { 1?: string; 2?: string; 3?: string };
type Creative = { 1?: string; 2?: string; 4?: number; 12?: string };

async function rpc(method: string, payload: unknown) {
  const response = await fetch(`${RPC}${method}?authuser=`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
    },
    body: new URLSearchParams({ "f.req": JSON.stringify(payload) }),
    signal: AbortSignal.timeout(12000),
  });
  const text = await response.text();
  if (!response.ok || text.startsWith("<")) {
    if (response.status === 429) throw new Error("Ads Transparency is rate limited");
    return {};
  }
  return JSON.parse(text) as Record<string, unknown>;
}

async function rpcOnce(method: string, payload: unknown) {
  try {
    return await rpc(method, payload);
  } catch (error) {
    if (!(error instanceof Error) || !/rate limited/i.test(error.message)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 2500));
    return rpc(method, payload);
  }
}

function advertisers(body: Record<string, unknown>) {
  const rows = Array.isArray(body["1"]) ? body["1"] : [];
  return rows
    .map((row) => (row as { 1?: Advertiser })["1"])
    .filter((row): row is Advertiser => Boolean(row?.["1"] && row?.["2"]));
}

function pickAdvertiser(rows: Advertiser[], brand: string) {
  const needle = brand.toLowerCase().split(" ")[0];
  return (
    rows.find((row) => row["3"] === "GB" && row["1"]?.toLowerCase().includes(needle)) ??
    rows.find((row) => row["1"]?.toLowerCase().includes(needle)) ??
    rows[0]
  );
}

function imageAds(body: Record<string, unknown>) {
  const rows = (Array.isArray(body["1"]) ? body["1"] : []) as Creative[];
  const ads: CompetitorAd[] = [];
  for (const row of rows) {
    if (row["4"] !== 1) continue;
    const imageUrl = JSON.stringify(row).match(/https:\/\/tpc\.googlesyndication\.com\/archive\/simgad\/\d+/)?.[0];
    if (!imageUrl || !row["1"] || !row["2"]) continue;
    const name = row["12"] || "Competitor";
    ads.push({
      title: name,
      url: `https://adstransparency.google.com/advertiser/${row["1"]}/creative/${row["2"]}?region=GB`,
      imageUrl,
      snippet: `${name} is running this image ad. It is public in Google's Ads Transparency Center.`,
      platform: "Google",
    });
  }
  return ads;
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
  return [...new Set(hosts)].slice(0, 3);
}

function take(ads: CompetitorAd[], seen: Set<string>, incoming: CompetitorAd[]) {
  for (const ad of incoming) {
    if (!ad.imageUrl || seen.has(ad.imageUrl) || ads.length >= 4) continue;
    seen.add(ad.imageUrl);
    ads.push(ad);
  }
}

export function brandNames(titles: string[]) {
  const names: string[] = [];
  for (const title of titles) {
    const parts = title
      .split(/\||–|—/)
      .map((part) => part.trim())
      .filter((part) => part.length > 1 && part.length < 40);
    const candidate = parts[parts.length - 1];
    if (!candidate || candidate.split(/\s+/).length > 4) continue;
    if (/wool|overshirt|recycled|shop|men'?s|women'?s|premium|british/i.test(candidate)) continue;
    names.push(candidate.replace(/\s+\.\.\.$/, ""));
  }
  return [...new Set(names)].slice(0, 3);
}

export async function publicCompetitorAds(brands: string[], pageUrls: string[] = []) {
  const ads: CompetitorAd[] = [];
  const seen = new Set<string>();

  for (const domain of domainsFrom(pageUrls)) {
    if (ads.length >= 4) break;
    try {
      const body = await rpcOnce("SearchService/SearchCreatives", {
        2: 8,
        3: { 12: { 1: domain, 2: true } },
        7: { 1: 1 },
      });
      take(ads, seen, imageAds(body));
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      if (error instanceof Error && /rate limited/i.test(error.message)) break;
    }
  }

  if (ads.length >= 2) return ads;

  for (const brand of brands) {
    if (ads.length >= 4) break;
    try {
      const suggestions = advertisers(await rpcOnce("SearchService/SearchSuggestions", { 1: brand, 2: 8, 3: 8 }));
      const advertiser = pickAdvertiser(suggestions, brand);
      if (!advertiser?.["2"]) continue;
      const creatives = imageAds(
        await rpcOnce("SearchService/SearchCreatives", {
          2: 8,
          3: { 13: { 1: [advertiser["2"]] }, 8: [2826] },
          7: { 1: 1, 2: 0, 3: 2826 },
        }),
      );
      take(ads, seen, creatives);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      if (error instanceof Error && /rate limited/i.test(error.message)) break;
    }
  }

  return ads;
}
