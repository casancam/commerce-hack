import { loadEnv } from "./load-env.mjs";

loadEnv();

function line(name, ok, detail) {
  console.log(`${ok ? "ok " : "no "}  ${name.padEnd(10)} ${detail}`);
}

async function checkSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    line("Supabase", false, "set NEXT_PUBLIC_SUPABASE_URL and a key");
    return;
  }
  const response = await fetch(`${url}/rest/v1/products?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await response.json().catch(() => ({}));
  if (response.ok) {
    line("Supabase", true, `products table ready (${body.length} row sample)`);
    return;
  }
  if (body.code === "PGRST205") {
    line("Supabase", false, "project is up. Run supabase/schema.sql in the SQL editor.");
    return;
  }
  line("Supabase", false, body.message ?? `HTTP ${response.status}`);
}

async function checkTavily() {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    line("Tavily", false, "set TAVILY_API_KEY from https://app.tavily.com");
    return;
  }
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: "wool overshirt price", search_depth: "ultra-fast", max_results: 1 }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    line("Tavily", false, body.detail?.error ?? body.error ?? `HTTP ${response.status}`);
    return;
  }
  line("Tavily", true, `key works, ${body.results?.length ?? 0} result (1 credit)`);
}

async function checkShopify() {
  const domain = (process.env.SHOPIFY_STORE_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!domain) {
    line("Shopify", false, "create a dev store, then set SHOPIFY_STORE_DOMAIN");
    return;
  }
  let token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!token && process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET) {
    const tokenResponse = await fetch(`https://${domain}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      }),
    });
    const tokenBody = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenBody.access_token) {
      line("Shopify", false, tokenBody.error_description ?? tokenBody.error ?? "token request failed");
      return;
    }
    token = tokenBody.access_token;
  }
  if (!token) {
    line("Shopify", false, "set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET, or SHOPIFY_ADMIN_TOKEN");
    return;
  }
  const response = await fetch(`https://${domain}/admin/api/2026-07/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query: "query { shop { name } }" }),
  });
  const body = await response.json();
  const name = body.data?.shop?.name;
  if (!name) {
    line("Shopify", false, body.errors?.[0]?.message ?? "shop query failed");
    return;
  }
  line("Shopify", true, name);
}

async function checkMeta() {
  if (!process.env.META_ACCESS_TOKEN || !process.env.META_AD_ACCOUNT_ID) {
    line("Meta", false, "set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID");
    return;
  }
  const id = process.env.META_AD_ACCOUNT_ID.startsWith("act_")
    ? process.env.META_AD_ACCOUNT_ID
    : `act_${process.env.META_AD_ACCOUNT_ID}`;
  const url = new URL(`https://graph.facebook.com/v21.0/${id}`);
  url.searchParams.set("fields", "name,currency");
  url.searchParams.set("access_token", process.env.META_ACCESS_TOKEN);
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok || body.error) {
    line("Meta", false, body.error?.message ?? `HTTP ${response.status}`);
    return;
  }
  line("Meta", true, `${body.name} (${body.currency})`);
}

async function checkTikTok() {
  if (!process.env.TIKTOK_ACCESS_TOKEN || !process.env.TIKTOK_ADVERTISER_ID) {
    line("TikTok", false, "set TIKTOK_ACCESS_TOKEN and TIKTOK_ADVERTISER_ID");
    return;
  }
  const url = new URL("https://business-api.tiktok.com/open_api/v1.3/advertiser/info/");
  url.searchParams.set("advertiser_ids", JSON.stringify([process.env.TIKTOK_ADVERTISER_ID]));
  const response = await fetch(url, { headers: { "Access-Token": process.env.TIKTOK_ACCESS_TOKEN } });
  const body = await response.json();
  if (body.code !== 0) {
    line("TikTok", false, body.message ?? `HTTP ${response.status}`);
    return;
  }
  line("TikTok", true, body.data?.list?.[0]?.name ?? process.env.TIKTOK_ADVERTISER_ID);
}

await checkSupabase();
await checkTavily();
await checkShopify();
await checkMeta();
await checkTikTok();
