import { readSession, refreshSession } from "@/lib/shopify-session";

const API_VERSION = "2026-07";

export type ShopifyAuth = {
  domain: string;
  token: string;
  fromSession: boolean;
};

export function shopifyConfigured() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  const client = process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET;
  return Boolean(domain && (token || client));
}

export function shopDomain() {
  return (process.env.SHOPIFY_STORE_DOMAIN ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

let tokenCache: { token: string; expiresAt: number } | null = null;

export async function shopifyToken() {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;

  const domain = shopDomain();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.SHOPIFY_CLIENT_ID ?? "",
    client_secret: process.env.SHOPIFY_CLIENT_SECRET ?? "",
  });
  const response = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error ?? "Shopify token request failed");
  }
  tokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 86_400) * 1000,
  };
  return json.access_token;
}

export async function shopifyContext(): Promise<ShopifyAuth | null> {
  const session = await readSession();
  if (session) {
    const fresh = await refreshSession(session);
    if (!fresh || fresh === "reauthorize") return null;
    return { domain: fresh.shop, token: fresh.accessToken, fromSession: true };
  }
  if (!shopifyConfigured()) return null;
  try {
    return { domain: shopDomain(), token: await shopifyToken(), fromSession: false };
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return null;
  }
}

export async function shopifyGraphql<T>(query: string, variables?: Record<string, unknown>) {
  const auth = await shopifyContext();
  if (!auth) throw new Error("Shopify is not connected");
  const response = await fetch(`https://${auth.domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": auth.token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (!response.ok || json.errors?.length) {
    throw new Error(json.errors?.map((error) => error.message).join("; ") ?? "Shopify GraphQL failed");
  }
  return json.data as T;
}

export async function shopifyShopName() {
  const data = await shopifyGraphql<{ shop: { name: string } }>("query { shop { name } }");
  return data.shop.name;
}
