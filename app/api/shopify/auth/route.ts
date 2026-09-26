import { NextResponse } from "next/server";
import { currentOrigin, newOauthState, normalizeShop, SHOPIFY_SCOPES, stateCookie } from "@/lib/shopify-session";

export async function GET(request: Request) {
  const origin = await currentOrigin();
  const shop = normalizeShop(new URL(request.url).searchParams.get("shop") ?? "");
  if (!process.env.SHOPIFY_CLIENT_ID || !process.env.SHOPIFY_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/?error=config", origin));
  }
  if (!shop) return NextResponse.redirect(new URL("/?error=shop", origin));

  const state = newOauthState();
  const redirectUri = `${origin}/api/shopify/callback`;
  const auth = new URL(`https://${shop}/admin/oauth/authorize`);
  auth.searchParams.set("client_id", process.env.SHOPIFY_CLIENT_ID);
  auth.searchParams.set("scope", SHOPIFY_SCOPES);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("state", state);
  const response = NextResponse.redirect(auth);
  const cookie = stateCookie(state);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
