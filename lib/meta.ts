import type { CompetitorAd } from "@/lib/types";

function adAccountId() {
  const raw = process.env.META_AD_ACCOUNT_ID ?? "";
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

export function metaAdsManagerUrl() {
  const raw = (process.env.META_AD_ACCOUNT_ID ?? "").replace(/^act_/, "");
  if (!raw) return null;
  return `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${raw}`;
}

export function metaToken() {
  return process.env.META_GRAPH_API_TOKEN || process.env.META_ACCESS_TOKEN || "";
}

export function metaConfigured() {
  return Boolean(metaToken() && process.env.META_AD_ACCOUNT_ID);
}

// Meta's Ad Library API only returns commercial ads delivered in the EU; elsewhere it is political ads only.
function libraryCountries() {
  const list = (process.env.META_AD_LIBRARY_COUNTRIES || "IE,NL,DE,FR")
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
  return JSON.stringify(list);
}

async function snapshotImage(snapshotUrl: string) {
  try {
    const response = await fetch(snapshotUrl, {
      signal: AbortSignal.timeout(6000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      },
    });
    if (!response.ok) return null;
    const html = (await response.text()).replace(/\\\//g, "/").replace(/&amp;/g, "&");
    const images = html.match(/https:\/\/(?:scontent|external)[^"'\s\\)]+?\.(?:jpg|jpeg|png)[^"'\s\\)]*/gi) ?? [];
    return images.find((src) => !/[ps]\d{2,3}x\d{2,3}/.test(src)) ?? null;
  } catch {
    return null;
  }
}

export async function metaLibraryAds(query: string): Promise<{ ads: CompetitorAd[]; warning: string | null }> {
  const token = metaToken();
  if (!token) return { ads: [], warning: null };

  const url = new URL("https://graph.facebook.com/v21.0/ads_archive");
  url.searchParams.set("search_terms", query);
  url.searchParams.set("ad_reached_countries", libraryCountries());
  url.searchParams.set("ad_type", "ALL");
  url.searchParams.set("ad_active_status", "ACTIVE");
  url.searchParams.set(
    "fields",
    [
      "id",
      "page_name",
      "ad_snapshot_url",
      "ad_creative_bodies",
      "ad_creative_link_titles",
      "ad_delivery_start_time",
      "ad_delivery_stop_time",
      "publisher_platforms",
      "eu_total_reach",
      "total_reach_by_location",
    ].join(","),
  );
  url.searchParams.set("limit", "8");
  url.searchParams.set("access_token", token);

  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const json = (await response.json()) as {
    data?: MetaArchiveAd[];
    error?: { message?: string; error_subcode?: number; error_user_msg?: string };
  };
  if (json.error?.error_subcode === 2332002) {
    return {
      ads: [],
      warning:
        "Meta accepted the token, but this app is not authorised for the Ad Library. Open facebook.com/ads/library/api and choose Access the API.",
    };
  }
  if (json.error) {
    url.searchParams.set("fields", "id,page_name,ad_snapshot_url,ad_creative_bodies,ad_creative_link_titles");
    const retry = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const again = (await retry.json()) as typeof json;
    if (again.error || !again.data) {
      return {
        ads: [],
        warning: again.error?.error_user_msg || again.error?.message || json.error.error_user_msg || json.error.message || "Meta Ad Library request failed",
      };
    }
    json.data = again.data;
  }

  const rows = (json.data ?? []).filter((row) => row.id && row.ad_snapshot_url).slice(0, 6);
  const images = await Promise.all(rows.map((row) => snapshotImage(row.ad_snapshot_url as string)));
  const ads: CompetitorAd[] = rows.map((row, index) => {
    const days = deliveryDays(row.ad_delivery_start_time, row.ad_delivery_stop_time);
    return {
      title: row.page_name || row.ad_creative_link_titles?.[0] || "Meta ad",
      url: `https://www.facebook.com/ads/library/?id=${row.id}`,
      imageUrl: images[index],
      snippet: [row.ad_creative_link_titles?.[0], row.ad_creative_bodies?.[0]]
        .filter(Boolean)
        .join(". ")
        .replace(/\s+/g, " ")
        .slice(0, 280) || `${row.page_name ?? "A page"} is running this ad on Meta.`,
      platform: "Meta",
      daysShown: days,
      active: !row.ad_delivery_stop_time,
      reach: reachLabel(row),
      placements: placementLabel(row.publisher_platforms),
    };
  });
  return { ads, warning: null };
}

type MetaArchiveAd = {
  id?: string;
  page_name?: string;
  ad_snapshot_url?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  publisher_platforms?: string[];
  eu_total_reach?: number;
  total_reach_by_location?: { key?: string; value?: number; location?: string; reach?: number }[] | Record<string, number>;
};

function deliveryDays(start?: string, stop?: string) {
  if (!start) return undefined;
  const from = Date.parse(start);
  const to = stop ? Date.parse(stop) : Date.now();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return undefined;
  return Math.max(1, Math.round((to - from) / 86_400_000));
}

function compactCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function reachLabel(row: MetaArchiveAd) {
  const parts: string[] = [];
  if (row.eu_total_reach && row.eu_total_reach > 0) parts.push(`EU reach ${compactCount(row.eu_total_reach)}`);
  const locations = row.total_reach_by_location;
  const rows: { key?: string; value?: number; location?: string; reach?: number }[] = Array.isArray(locations)
    ? locations
    : locations
      ? Object.entries(locations).map(([key, value]) => ({ key, value: Number(value) }))
      : [];
  for (const item of rows) {
    const place = item.key || item.location;
    const value = item.value ?? item.reach;
    if (!place || !value || place === "EU" || parts.length >= 2) continue;
    parts.push(`${place} reach ${compactCount(value)}`);
  }
  return parts.join(" · ") || undefined;
}

function placementLabel(platforms?: string[]) {
  if (!platforms?.length) return undefined;
  const names: Record<string, string> = {
    FACEBOOK: "Facebook",
    INSTAGRAM: "Instagram",
    AUDIENCE_NETWORK: "Audience Network",
    MESSENGER: "Messenger",
    THREADS: "Threads",
    WHATSAPP: "WhatsApp",
  };
  return platforms.map((item) => names[item] ?? item).slice(0, 3).join(", ");
}

type MetaPublishInput = {
  name: string;
  headline: string;
  primaryText: string;
  imageUrl: string;
  destinationUrl: string;
  dailyBudgetCents: number;
};

type GraphError = { message?: string; error_user_msg?: string };

async function graph<T>(path: string, token: string, body?: Record<string, unknown>, method = "POST") {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  const init: RequestInit = { method, signal: AbortSignal.timeout(30000) };
  if (method === "GET" || method === "DELETE") {
    url.searchParams.set("access_token", token);
    if (body) {
      for (const [key, value] of Object.entries(body)) url.searchParams.set(key, String(value));
    }
  } else {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify({ ...body, access_token: token });
  }
  const response = await fetch(url, init);
  const json = (await response.json()) as T & { error?: GraphError };
  if (!response.ok || json.error) {
    throw new Error(json.error?.error_user_msg || json.error?.message || "Meta request failed");
  }
  return json;
}

async function metaPage(token: string) {
  const url = new URL("https://graph.facebook.com/v21.0/me/accounts");
  url.searchParams.set("fields", "id,name,access_token");
  url.searchParams.set("access_token", token);
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const json = (await response.json()) as {
    data?: { id?: string; name?: string; access_token?: string }[];
    error?: GraphError;
  };
  if (json.error) throw new Error(json.error.error_user_msg || json.error.message || "Meta could not list Pages");
  const pages = json.data ?? [];
  const wanted = process.env.META_PAGE_ID;
  const page = wanted ? pages.find((item) => item.id === wanted) : pages[0];
  if (!page?.id || !page.access_token) {
    throw new Error(
      wanted
        ? "META_PAGE_ID is not a Page this token can advertise."
        : "This Meta login has no Facebook Page. Create one, or set META_PAGE_ID.",
    );
  }
  return { id: page.id, token: page.access_token };
}

async function imageHash(imageUrl: string, pageToken: string) {
  const image = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
  if (!image.ok) return null;
  const bytes = Buffer.from(await image.arrayBuffer()).toString("base64");
  const body = new URLSearchParams({ bytes, access_token: pageToken });
  const response = await fetch(`https://graph.facebook.com/v21.0/${adAccountId()}/adimages`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(30000),
  });
  const json = (await response.json()) as {
    images?: Record<string, { hash?: string }>;
    error?: GraphError;
  };
  if (!response.ok || json.error) return null;
  return Object.values(json.images ?? {})[0]?.hash ?? null;
}

export async function publishMetaCampaign(input: MetaPublishInput) {
  const token = metaToken();
  if (!token || !process.env.META_AD_ACCOUNT_ID) {
    throw new Error("Set META_GRAPH_API_TOKEN and META_AD_ACCOUNT_ID");
  }
  const link = input.destinationUrl.trim();
  if (!/^https:\/\//.test(link)) throw new Error("The product needs an https link before Meta can create the ad.");
  if (!Number.isFinite(input.dailyBudgetCents) || input.dailyBudgetCents < 100) {
    throw new Error("Set a Meta budget of at least £1 a day.");
  }

  const page = await metaPage(token);
  const account = adAccountId();
  let campaignId = "";
  try {
    const campaign = await graph<{ id: string }>(`${account}/campaigns`, token, {
      name: input.name.slice(0, 250),
      objective: "OUTCOME_TRAFFIC",
      status: "PAUSED",
      special_ad_categories: [],
      buying_type: "AUCTION",
      is_adset_budget_sharing_enabled: false,
    });
    campaignId = campaign.id;

    const adset = await graph<{ id: string }>(`${account}/adsets`, token, {
      name: `${input.name}`.slice(0, 250),
      campaign_id: campaignId,
      daily_budget: String(Math.round(input.dailyBudgetCents)),
      billing_event: "IMPRESSIONS",
      optimization_goal: "LINK_CLICKS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      destination_type: "WEBSITE",
      targeting: { geo_locations: { countries: ["GB"] } },
      status: "PAUSED",
    });

    const hash = await imageHash(input.imageUrl, page.token);
    const linkData: Record<string, unknown> = {
      link,
      message: input.primaryText.slice(0, 1000),
      name: input.headline.slice(0, 250),
      call_to_action: { type: "SHOP_NOW", value: { link } },
    };
    if (hash) linkData.image_hash = hash;
    else linkData.picture = input.imageUrl;

    const creative = await graph<{ id: string }>(`${account}/adcreatives`, page.token, {
      name: input.headline.slice(0, 250),
      object_story_spec: { page_id: page.id, link_data: linkData },
    });

    await graph<{ id: string }>(`${account}/ads`, page.token, {
      name: input.headline.slice(0, 250),
      adset_id: adset.id,
      creative: { creative_id: creative.id },
      status: "PAUSED",
    });

    const act = account.replace(/^act_/, "");
    return {
      campaignId,
      url: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${act}&selected_campaign_ids=${campaignId}`,
      message: "Paused campaign created in Ads Manager. Turn it on there when you want it to spend.",
    };
  } catch (error) {
    if (campaignId) await graph(campaignId, token, undefined, "DELETE").catch(() => undefined);
    const message = error instanceof Error ? error.message : "Meta did not create the campaign.";
    if (/development mode/i.test(message)) {
      throw new Error(
        "Meta blocked the ad because this app is still in Development mode. Open developers.facebook.com, switch the app to Live, then press Go live again.",
      );
    }
    throw error;
  }
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
