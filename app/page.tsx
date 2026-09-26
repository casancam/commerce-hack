import { Desk } from "@/components/Desk";
import { Landing, landingError } from "@/components/Landing";
import { buildPreview } from "@/lib/decide";
import { loadCatalog } from "@/lib/live-catalog";
import { metaAdsManagerUrl } from "@/lib/meta";
import { loadRules } from "@/lib/rules";
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
        ready={Boolean(process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET)}
        error={landingError(params.error)}
      />
    );
  }

  const catalog = await loadCatalog();
  if (catalog.products.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-16">
        <p className="chip w-fit bg-hot">Empty shelf</p>
        <h1 className="display mt-4 text-6xl uppercase">
          Nothing <span className="serif normal-case">imported</span>
        </h1>
        <p className="mt-4 text-lg text-muted">
          {catalog.shopName ?? session.shop} is connected, but no products came back.
        </p>
        <a href="/api/shopify/disconnect" className="studio-btn studio-btn-primary mt-8 w-fit">
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
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-16 sm:px-8">
        <p className="chip w-fit bg-accent">{catalog.shopName ?? "Store"} is connected</p>
        <h1 className="display text-[clamp(3rem,7vw,6rem)] uppercase">
          Nothing <span className="serif normal-case">clears yet.</span>
        </h1>
        <p className="max-w-xl text-lg text-muted">No product clears its rules yet. Loosen a floor on Products, then come back.</p>
        <Link href="/products" className="studio-btn studio-btn-acid mt-4 w-fit px-6 py-3 text-base">
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
  return <Desk initial={initial} products={catalog.products} rules={rules} metaAdsUrl={metaAdsManagerUrl()} />;
}
