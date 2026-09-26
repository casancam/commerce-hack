import { buildBundle, suggestionMessage } from "@/lib/decide";
import { saveDecision } from "@/lib/store";
import { sendTelegram } from "@/lib/telegram";

export async function POST() {
  const bundle = buildBundle();
  await saveDecision(bundle);
  const telegram = await sendTelegram(suggestionMessage(bundle));
  return Response.json({ bundle, telegram });
}

export async function GET() {
  return Response.json(buildBundle());
}
