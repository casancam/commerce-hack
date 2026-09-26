import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { getSupabase } from "@/lib/supabase";

export const SHOPIFY_SCOPES = [
  "read_products",
  "write_products",
  "read_inventory",
  "write_inventory",
  "read_locations",
  "read_orders",
].join(",");

const SESSION_COOKIE = "haggly_shop";
const STATE_COOKIE = "haggly_oauth_state";

export type ShopifySession = {
  shop: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
};

let memorySession: ShopifySession | null = null;

function secret() {
  const value = process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_ADMIN_TOKEN;
  if (!value) throw new Error("SHOPIFY_CLIENT_SECRET is not set");
  return value;
}

export function normalizeShop(input: string) {
  let shop = input.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? "";
  if (!shop) return null;
  if (!shop.includes(".")) shop = `${shop}.myshopify.com`;
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) return null;
  return shop;
}

function sign(payload: string) {
  const body = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function unsign(value: string) {
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const actual = Buffer.from(sig);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return null;
  return Buffer.from(body, "base64url").toString();
}

export function encodeSession(session: ShopifySession) {
  return sign(JSON.stringify(session));
}

export function decodeSession(value: string): ShopifySession | null {
  const raw = unsign(value);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ShopifySession;
    if (!parsed.shop || !parsed.accessToken || !normalizeShop(parsed.shop)) return null;
    return {
      shop: parsed.shop,
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken ?? null,
      expiresAt: parsed.expiresAt ?? null,
    };
  } catch {
    return null;
  }
}

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function stateCookie(state: string) {
  return { name: STATE_COOKIE, value: state, options: { ...cookieBase, maxAge: 60 * 10 } };
}

export function sessionCookie(session: ShopifySession) {
  return {
    name: SESSION_COOKIE,
    value: encodeSession(session),
    options: { ...cookieBase, maxAge: 60 * 60 * 24 * 30 },
  };
}

export function clearedSessionCookie() {
  return { name: SESSION_COOKIE, value: "", options: { ...cookieBase, maxAge: 0 } };
}

export async function currentOrigin() {
  const configured = process.env.APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) throw new Error("APP_URL is not set");
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = headerList.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}

export function verifyShopifyHmac(searchParams: URLSearchParams, clientSecret: string) {
  const hmac = searchParams.get("hmac");
  if (!hmac) return false;
  const message = [...searchParams.entries()]
    .filter(([key]) => key !== "hmac")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const digest = createHmac("sha256", clientSecret).update(message).digest("hex");
  const actual = Buffer.from(hmac);
  const wanted = Buffer.from(digest);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

async function readStoredSession(): Promise<ShopifySession | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("shopify_sessions")
    .select("shop, access_token, refresh_token, expires_at")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error || !data?.[0]) return null;
  const row = data[0] as {
    shop: string;
    access_token: string;
    refresh_token: string | null;
    expires_at: string | null;
  };
  if (!normalizeShop(row.shop) || !row.access_token) return null;
  return {
    shop: row.shop,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: row.expires_at ? Date.parse(row.expires_at) : null,
  };
}

export async function readSession(): Promise<ShopifySession | null> {
  let cookieSession: ShopifySession | null = null;
  try {
    const jar = await cookies();
    const raw = jar.get(SESSION_COOKIE)?.value;
    if (raw) cookieSession = decodeSession(raw);
  } catch {
    cookieSession = null;
  }

  if (
    cookieSession &&
    memorySession &&
    memorySession.shop === cookieSession.shop &&
    (memorySession.expiresAt ?? 0) > (cookieSession.expiresAt ?? 0)
  ) {
    return memorySession;
  }
  if (cookieSession) return cookieSession;
  if (memorySession) return memorySession;
  return readStoredSession();
}

export async function writeSession(session: ShopifySession) {
  memorySession = session;
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from("shopify_sessions").upsert({
      shop: session.shop,
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
      expires_at: session.expiresAt ? new Date(session.expiresAt).toISOString() : null,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error(error.message);
  }
  try {
    const jar = await cookies();
    jar.set(SESSION_COOKIE, encodeSession(session), { ...cookieBase, maxAge: 60 * 60 * 24 * 30 });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
}

export async function clearSession() {
  const current = await readSession();
  memorySession = null;
  try {
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
  const supabase = getSupabase();
  if (!supabase) return;
  const query = current
    ? supabase.from("shopify_sessions").delete().eq("shop", current.shop)
    : supabase.from("shopify_sessions").delete().neq("shop", "");
  const { error } = await query;
  if (error) console.error(error.message);
}

export function newOauthState() {
  return randomBytes(16).toString("hex");
}

export async function setOauthState(state: string) {
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, { ...cookieBase, maxAge: 60 * 10 });
}

export async function takeOauthState() {
  const jar = await cookies();
  const value = jar.get(STATE_COOKIE)?.value ?? null;
  jar.delete(STATE_COOKIE);
  return value;
}

export async function refreshSession(session: ShopifySession): Promise<ShopifySession | "reauthorize" | null> {
  if (!session.expiresAt || !session.refreshToken || session.expiresAt - 60_000 > Date.now()) return session;

  const response = await fetch(`https://${session.shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: process.env.SHOPIFY_CLIENT_ID ?? "",
      client_secret: process.env.SHOPIFY_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
    }),
  });
  if (response.status === 401) return "reauthorize";
  if (!response.ok) return null;
  const json = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) return null;
  const next: ShopifySession = {
    shop: session.shop,
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? session.refreshToken,
    expiresAt: json.expires_in ? Date.now() + json.expires_in * 1000 : null,
  };
  await writeSession(next);
  return next;
}
