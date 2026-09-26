import type { CompetitorAd } from "@/lib/types";

function adAccountId() {
  const raw = process.env.META_AD_ACCOUNT_ID ?? "";
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

export function metaToken() {
  return process.env.META_GRAPH_API_TOKEN || process.env.META_ACCESS_TOKEN || "";
}

export function metaConfigured() {
  return Boolean(metaToken() && process.env.META_AD_ACCOUNT_ID);
}

export async function metaLibraryAds(query: string): Promise<{ ads: CompetitorAd[]; warning: string | null }> {
  const token = metaToken();
  if (!token) return { ads: [], warning: null };

  const url = new URL("https://graph.facebook.com/v21.0/ads_archive");
  url.searchParams.set("search_terms", query);
  url.searchParams.set("ad_reached_countries", '["GB"]');
  url.searchParams.set("ad_type", "ALL");
  url.searchParams.set("ad_active_status", "ACTIVE");
  url.searchParams.set("fields", "id,page_name,ad_snapshot_url,ad_creative_bodies,ad_creative_link_titles");
  url.searchParams.set("limit", "6");
  url.searchParams.set("access_token", token);

  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const json = (await response.json()) as {
    data?: {
      page_name?: string;
      ad_snapshot_url?: string;
      ad_creative_bodies?: string[];
      ad_creative_link_titles?: string[];
    }[];
    error?: { message?: string; error_subcode?: number; error_user_msg?: string };
  };
  if (json.error) {
    const message =
      json.error.error_subcode === 2332002
        ? "Meta accepted the token, but this app is not authorised for the Ad Library. Open facebook.com/ads/library/api and choose Access the API."
        : json.error.error_user_msg || json.error.message || "Meta Ad Library request failed";
    return { ads: [], warning: message };
  }

  const ads: CompetitorAd[] = [];
  for (const row of json.data ?? []) {
    if (!row.ad_snapshot_url) continue;
    const title = row.ad_creative_link_titles?.[0] || row.page_name || "Meta ad";
    ads.push({
      title,
      url: row.ad_snapshot_url,
      imageUrl: null,
      snippet: row.ad_creative_bodies?.[0]?.slice(0, 280) || `${row.page_name ?? "A page"} is running this ad on Meta.`,
      platform: "Meta",
    });
    if (ads.length >= 4) break;
  }
  return { ads, warning: null };
}

export async function metaAccount() {
  const token = metaToken();
  if (!token || !process.env.META_AD_ACCOUNT_ID) throw new Error("Set META_GRAPH_API_TOKEN and META_AD_ACCOUNT_ID");
  const url = new URL(`https://graph.facebook.com/v21.0/${adAccountId()}`);
  url.searchParams.set("fields", "name,account_status,currency");
  url.searchParams.set("access_token", token);
  const response = await fetch(url);
  const json = (await response.json()) as { name?: string; currency?: string; error?: { message: string } };
  if (!response.ok || json.error) throw new Error(json.error?.message ?? "Meta ad account request failed");
  return { name: json.name ?? "Meta ad account", currency: json.currency ?? "" };
}
