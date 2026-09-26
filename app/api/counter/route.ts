import { checkCounter, parsePounds } from "@/lib/counter";
import { buildPreview } from "@/lib/decide";
import { loadCatalog } from "@/lib/live-catalog";
import { saveCounter } from "@/lib/store";
import { sendTelegram } from "@/lib/telegram";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { price?: string; productId?: string } | null;
  const pounds = parsePounds(String(body?.price ?? ""));
  if (pounds === null) {
    return Response.json({ error: "Reply with a price, like 70" }, { status: 400 });
  }

  const catalog = await loadCatalog();
  const preview = buildPreview(catalog);
  const product =
    catalog.products.find((item) => item.id === body?.productId) ??
    catalog.products.find((item) => item.id === preview.chosen.id);
  if (!product) {
    return Response.json({ error: "No product clears the policy" }, { status: 400 });
  }

  const result = checkCounter(product, pounds);
  await saveCounter(result);
  const telegram = await sendTelegram(result.reply);
  return Response.json({ result, telegram });
}
