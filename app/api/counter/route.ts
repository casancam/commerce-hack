import { checkCounter, parsePounds, productForCounter } from "@/lib/counter";
import { saveCounter } from "@/lib/store";
import { sendTelegram } from "@/lib/telegram";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { price?: string } | null;
  const pounds = parsePounds(String(body?.price ?? ""));
  if (pounds === null) {
    return Response.json(
      { error: "Reply with a price, like 70" },
      { status: 400 },
    );
  }

  const result = checkCounter(productForCounter(), pounds);
  await saveCounter(result);
  const telegram = await sendTelegram(result.reply);
  return Response.json({ result, telegram });
}
