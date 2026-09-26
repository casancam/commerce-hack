function adAccountId() {
  const raw = process.env.META_AD_ACCOUNT_ID ?? "";
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

export function metaConfigured() {
  return Boolean(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

export async function metaAccount() {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token || !process.env.META_AD_ACCOUNT_ID) throw new Error("Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID");
  const url = new URL(`https://graph.facebook.com/v21.0/${adAccountId()}`);
  url.searchParams.set("fields", "name,account_status,currency");
  url.searchParams.set("access_token", token);
  const response = await fetch(url);
  const json = (await response.json()) as { name?: string; currency?: string; error?: { message: string } };
  if (!response.ok || json.error) throw new Error(json.error?.message ?? "Meta ad account request failed");
  return { name: json.name ?? "Meta ad account", currency: json.currency ?? "" };
}
