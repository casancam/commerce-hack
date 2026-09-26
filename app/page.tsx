import { Desk } from "@/components/Desk";
import { Landing, landingError } from "@/components/Landing";
import { buildPreview } from "@/lib/decide";
import { loadCatalog } from "@/lib/live-catalog";
import { loadRules } from "@/lib/rules";
import { shopDomain } from "@/lib/shopify";
import { readSession } from "@/lib/shopify-session";
import { latestBrief } from "@/lib/store";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await readSession();
  if (!session) {
    const params = await searchParams;
    return (
      <Landing
        defaultShop={shopDomain()}
        ready={Boolean(process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET)}
        error={landingError(params.error)}
      />
    );
  }

  const catalog = await loadCatalog();
  if (catalog.products.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Nothing imported</h1>
        <p className="mt-2 text-sm text-muted">
          {catalog.shopName ?? session.shop} is connected, but no products came back.
        </p>
        <a href="/api/shopify/disconnect" className="studio-btn studio-btn-secondary mt-6 w-fit">
          Connect again
        </a>
      </main>
    );
  }

  const { rules, savedIds } = await loadRules(catalog.products);
  const saved = await latestBrief();
  const reusable = Boolean(saved?.chosen?.adNote && catalog.products.some((product) => product.id === saved.chosen.id));
  let initial;
  try {
    initial = reusable && saved ? saved : buildPreview(catalog, undefined, rules);
  } catch {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-8 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">{catalog.shopName ?? "Store"} is connected</h1>
        <p className="text-sm text-muted">No product clears its rules yet. Loosen a floor on Products, then come back.</p>
        <Link href="/products" className="studio-btn studio-btn-primary w-fit">
          Products
        </Link>
      </main>
    );
  }
  if (initial.chosen.campaignPriceCents && !savedIds.includes(initial.chosen.id)) {
    rules[initial.chosen.id] = {
      ...rules[initial.chosen.id],
      campaignPriceCents: initial.chosen.campaignPriceCents,
    };
  }
  return <Desk initial={initial} products={catalog.products} rules={rules} />;
}
