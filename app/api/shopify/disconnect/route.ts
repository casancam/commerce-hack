import { NextResponse } from "next/server";
import { clearedSessionCookie, clearSession, currentOrigin } from "@/lib/shopify-session";

export async function GET() {
  await clearSession();
  const response = NextResponse.redirect(new URL("/", await currentOrigin()));
  const cookie = clearedSessionCookie();
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
