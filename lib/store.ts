import { getSupabase } from "@/lib/supabase";
import type { Brief, CounterResult } from "@/lib/types";

export async function saveDecision(brief: Brief) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("decisions").insert({ payload: brief });
  if (error) console.error(error.message);
}

export async function latestBrief() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("decisions")
    .select("payload")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data?.[0]) return null;
  return data[0].payload as Brief;
}

export async function saveCounter(result: CounterResult) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("counters").insert({
    proposed_price_cents: result.proposedPriceCents,
    margin_pct: result.marginPct,
    stock: result.stock,
    doable: result.doable,
    reason: result.reply,
  });
  if (error) console.error(error.message);
}
