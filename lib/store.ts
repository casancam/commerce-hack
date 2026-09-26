import { getSupabase } from "@/lib/supabase";
import type { Bundle, CounterResult } from "@/lib/types";

export async function saveDecision(bundle: Bundle) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("decisions").insert({ payload: bundle });
  if (error) console.error(error.message);
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
