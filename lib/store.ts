import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Bundle, CounterResult } from "@/lib/types";

function client(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function saveDecision(bundle: Bundle) {
  const supabase = client();
  if (!supabase) return;
  const { error } = await supabase.from("decisions").insert({ payload: bundle });
  if (error) console.error(error.message);
}

export async function saveCounter(result: CounterResult) {
  const supabase = client();
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
