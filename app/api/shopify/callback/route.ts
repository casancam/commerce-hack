import { NextResponse } from "next/server";
import {
  currentOrigin,
  normalizeShop,
  takeOauthState,
  verifyShopifyHmac,
  sessionCookie,
  writeSession,
} from "@/lib/shopify-session";

export async function GET(request: Request) {
  const origin = await currentOrigin();
  const params = new URL(request.url).searchParams;
  if (params.get("error")) return NextResponse.redirect(new URL("/?error=denied", origin));

  const secret = process.env.SHOPIFY_CLIENT_SECRET ?? "";
  if (!secret || !verifyShopifyHmac(params, secret)) {
    return NextResponse.redirect(new URL("/?error=hmac", origin));
  }

  const state = params.get("state");
  const expected = await takeOauthState();
  if (!state || state !== expected) return NextResponse.redirect(new URL("/?error=state", origin));

  const shop = normalizeShop(params.get("shop") ?? "");
  const code = params.get("code");
  if (!shop || !code) return NextResponse.redirect(new URL("/?error=shop", origin));

  const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: process.env.SHOPIFY_CLIENT_ID ?? "",
      client_secret: secret,
      code,
      expiring: "1",
    }),
  });
  const json = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenResponse.ok || !json.access_token) {
    console.error("Shopify token exchange failed", tokenResponse.status, json.error ?? json.error_description ?? "");
    return NextResponse.redirect(new URL("/?error=token", origin));
  }

  const granted = (json.scope ?? "").split(",").map((scope) => scope.trim()).filter(Boolean);
  const canReadProducts = granted.length === 0 || granted.includes("read_products") || granted.includes("write_products");
  if (!canReadProducts) return NextResponse.redirect(new URL("/?error=scope", origin));

  const session = {
    shop,
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: json.expires_in ? Date.now() + json.expires_in * 1000 : null,
  };
  await writeSession(session);
  const response = NextResponse.redirect(new URL("/import", origin));
  const cookie = sessionCookie(session);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
