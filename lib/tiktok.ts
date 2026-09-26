export function tiktokConfigured() {
  return Boolean(process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_ADVERTISER_ID);
}

export async function tiktokAdvertiser() {
  const token = process.env.TIKTOK_ACCESS_TOKEN;
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID;
  if (!token || !advertiserId) {
    throw new Error("Set TIKTOK_ACCESS_TOKEN and TIKTOK_ADVERTISER_ID");
  }
  const url = new URL("https://business-api.tiktok.com/open_api/v1.3/advertiser/info/");
  url.searchParams.set("advertiser_ids", JSON.stringify([advertiserId]));
  const response = await fetch(url, { headers: { "Access-Token": token } });
  const json = (await response.json()) as {
    code?: number;
    message?: string;
    data?: { list?: { name?: string; advertiser_id?: string }[] };
  };
  if (!response.ok || json.code !== 0) {
    throw new Error(json.message ?? "TikTok advertiser request failed");
  }
  const advertiser = json.data?.list?.[0];
  return { name: advertiser?.name ?? "TikTok advertiser", id: advertiser?.advertiser_id ?? advertiserId };
}
