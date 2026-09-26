import { grokChat, parseGrokJson } from "@/lib/grok";

export async function transcribeAudio(bytes: Buffer, filename: string, mime: string, keyterms: string[] = []) {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("Set XAI_API_KEY so a voice note can be transcribed.");

  const form = new FormData();
  form.append("format", "true");
  form.append("language", "en");
  for (const term of keyterms.filter(Boolean).slice(0, 20)) form.append("keyterm", term.slice(0, 50));
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mime || "application/octet-stream" }), filename);

  const response = await fetch("https://api.x.ai/v1/stt", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  const json = (await response.json().catch(() => null)) as { text?: string; error?: { message?: string } | string } | null;
  if (!response.ok) {
    const message = typeof json?.error === "string" ? json.error : json?.error?.message;
    throw new Error(message || "Could not transcribe that voice note.");
  }
  const text = json?.text?.trim();
  if (!text) throw new Error("The voice note had no speech.");
  return text;
}

export async function instructionFromSpeech(transcript: string) {
  const parsed = parseGrokJson<{ instruction?: string }>(
    await grokChat(
      [
        "Turn one spoken Slack reply into a single instruction for an ads studio.",
        'Reply with JSON only: {"instruction":""}',
        "Use one of these shapes when it fits:",
        "price 190",
        "another image: on a wet street",
        "change 1: darker studio",
        "use 2",
        "push the linen shirt",
        "regenerate",
        "If they are not asking for a change, leave instruction empty.",
      ].join(" "),
      transcript,
    ),
  );
  return parsed.instruction?.trim() || "";
}
