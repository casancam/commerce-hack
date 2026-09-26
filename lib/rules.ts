import { POLICY } from "@/lib/catalog";
import { minPriceFromMargin } from "@/lib/pricing";
import { getSupabase } from "@/lib/supabase";
import type { Product, ProductRule } from "@/lib/types";

type RuleRow = {
  product_id: string;
  min_price_cents: number;
  campaign_price_cents: number | null;
  min_margin_pct: number;
  min_stock: number;
};

export function defaultRule(product: Product): ProductRule {
  const minPriceCents = minPriceFromMargin(product.priceCents, POLICY.minMarginPct);
  return {
    minPriceCents,
    campaignPriceCents: Math.max(product.priceCents, minPriceCents),
    minMarginPct: POLICY.minMarginPct,
    minStock: POLICY.minStock,
  };
}

export async function loadRules(products: Product[]) {
  const saved = new Map<string, ProductRule>();
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.from("product_rules").select("*");
    if (error) console.error(error.message);
    for (const row of (data ?? []) as RuleRow[]) {
      saved.set(row.product_id, {
        minPriceCents: row.min_price_cents,
        campaignPriceCents: row.campaign_price_cents ?? 0,
        minMarginPct: row.min_margin_pct,
        minStock: row.min_stock,
      });
    }
  }

  const rules: Record<string, ProductRule> = {};
  const savedIds: string[] = [];
  for (const product of products) {
    const row = saved.get(product.id);
    if (row) {
      rules[product.id] = {
        ...row,
        minPriceCents: minPriceFromMargin(product.priceCents, row.minMarginPct),
        campaignPriceCents: row.campaignPriceCents || product.priceCents,
      };
      savedIds.push(product.id);
    } else {
      rules[product.id] = defaultRule(product);
    }
  }
  return { rules, savedIds };
}

export async function saveRule(productId: string, rule: ProductRule) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("product_rules").upsert({
    product_id: productId,
    min_price_cents: rule.minPriceCents,
    campaign_price_cents: rule.campaignPriceCents,
    min_margin_pct: rule.minMarginPct,
    min_stock: rule.minStock,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function loadBudget(fallback: number) {
  const supabase = getSupabase();
  if (!supabase) return fallback;
  const { data, error } = await supabase
    .from("policies")
    .select("max_daily_spend_cents")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return fallback;
  return data.max_daily_spend_cents as number;
}

export async function savePlatformBudget(platform: "meta" | "tiktok", dailyBudgetCents: number) {
  const { latestBrief, saveDecision } = await import("@/lib/store");
  const brief = await latestBrief();
  if (!brief) return;
  const campaigns = brief.campaigns.map((campaign) =>
    campaign.platform === platform ? { ...campaign, dailyBudgetCents } : campaign,
  );
  await saveDecision({ ...brief, campaigns });
}
