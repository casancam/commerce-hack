import { proposalText } from "@/lib/proposal";
import { handleMerchantReply } from "@/lib/reply";

export const maxDuration = 120;

function authorized(request: Request) {
  const key = process.env.GROK_BOT_WEBHOOK_KEY;
  if (!key) return false;
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.replace(/^Bearer\s+/i, "");
  const automation = request.headers.get("x-automation-key") ?? "";
  return bearer === key || automation === key;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { text?: string; message?: string } | null;
  const text = (body?.text || body?.message || "").trim();
  if (!text) return Response.json({ error: "Say what to change." }, { status: 400 });

  try {
    const outcome = await handleMerchantReply(text);
    return Response.json({
      reply: outcome.reply,
      imageUrls: outcome.imageUrls.filter((url) => url.startsWith("https://")),
      message: outcome.brief && /\bcampaigns?\b/i.test(text) ? proposalText(outcome.brief) : null,
    });
  } catch (error) {
    return Response.json(
      { reply: error instanceof Error ? error.message : "Could not apply that.", imageUrls: [] },
      { status: 500 },
    );
  }
}
