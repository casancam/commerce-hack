import { ProductsBoard } from "@/components/ProductsBoard";
import { loadCatalog } from "@/lib/live-catalog";
import { loadRules } from "@/lib/rules";
import { readSession } from "@/lib/shopify-session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  if (!(await readSession())) redirect("/");
  const catalog = await loadCatalog();
  const { rules } = await loadRules(catalog.products);
  return <ProductsBoard products={catalog.products} rules={rules} />;
}
