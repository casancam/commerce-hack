import { loadCatalog } from "@/lib/live-catalog";
import { readSession } from "@/lib/shopify-session";
import { getSupabase } from "@/lib/supabase";
import type { Product } from "@/lib/types";
import { NextResponse } from "next/server";

export const maxDuration = 60;

async function persistProducts(products: Product[]) {
  const supabase = getSupabase();
  if (!supabase || products.length === 0) return;
  const { error } = await supabase.from("products").upsert(
    products.map((product) => ({
      id: product.id,
      title: product.title,
      price_cents: product.priceCents,
      cost_cents: product.costCents,
      stock: product.stock,
      units_sold_30d: product.unitsSold30d,
      image_url: product.imageUrl,
      product_url: product.productUrl,
      updated_at: new Date().toISOString(),
    })),
  );
  if (error) console.error(error.message);
}

export async function POST() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Connect Shopify first." }, { status: 401 });

  const catalog = await loadCatalog({ fresh: true });
  if (catalog.source !== "shopify" || catalog.products.length === 0) {
    return NextResponse.json({ error: "Shopify connected, but no products came back." }, { status: 502 });
  }

  await persistProducts(catalog.products);
  return NextResponse.json({
    shopName: catalog.shopName,
    products: catalog.products.length,
    stock: catalog.products.reduce((sum, product) => sum + product.stock, 0),
    sold: catalog.products.reduce((sum, product) => sum + product.unitsSold30d, 0),
    sales: catalog.sales,
  });
}
