import { saveRule } from "@/lib/rules";
import type { ProductRule } from "@/lib/types";

function whole(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | (ProductRule & { productId?: string })
    | null;
  const productId = body?.productId?.trim();
  const minPriceCents = whole(body?.minPriceCents);
  const campaignPriceCents = whole(body?.campaignPriceCents);
  const minMarginPct = whole(body?.minMarginPct);
  const minStock = whole(body?.minStock);
  if (!productId || minPriceCents === null || campaignPriceCents === null || minMarginPct === null || minStock === null) {
    return Response.json({ error: "Those rules are incomplete." }, { status: 400 });
  }
  if (minMarginPct > 95) {
    return Response.json({ error: "Min campaign margin has to stay under 95%." }, { status: 400 });
  }

  try {
    const rule = { minPriceCents, campaignPriceCents, minMarginPct, minStock };
    await saveRule(productId, rule);
    return Response.json({ rule });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save those rules." },
      { status: 500 },
    );
  }
}
