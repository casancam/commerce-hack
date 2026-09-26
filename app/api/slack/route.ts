import { after } from "next/server";
import { sendVoiceToAgent } from "@/lib/grokbot";
import { loadCatalog } from "@/lib/live-catalog";
import { handleMerchantReply } from "@/lib/reply";
import { downloadSlackFile, replySlack, verifySlack } from "@/lib/slack";
import { instructionFromSpeech, transcribeAudio } from "@/lib/voice";

export const maxDuration = 120;

type SlackEvent = {
  type?: string;
  challenge?: string;
  event?: {
    type?: string;
    subtype?: string;
    bot_id?: string;
    channel?: string;
    text?: string;
    ts?: string;
    thread_ts?: string;
    user?: string;
    files?: { name?: string; mimetype?: string; url_private_download?: string }[];
  };
};

function audioFile(event: NonNullable<SlackEvent["event"]>) {
  return (event.files ?? []).find((file) => {
    const mime = file.mimetype ?? "";
    return file.url_private_download && (/^audio\//.test(mime) || /audio|mp4|webm|ogg|m4a/.test(mime));
  });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const payload = JSON.parse(raw) as SlackEvent;

  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge });
  }

  if (!verifySlack(request, raw)) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  if (request.headers.get("x-slack-retry-num")) return new Response("", { status: 200 });

  const event = payload.event;
  const channel = process.env.SLACK_CHANNEL_ID;
  const typed = event?.text?.replace(/<@[^>]+>/g, "").trim() ?? "";
  const clip = event ? audioFile(event) : undefined;
  const voice = Boolean(clip) && (!event?.subtype || event.subtype === "file_share");
  if (
    event?.type !== "message" ||
    (event.subtype && !voice) ||
    event.bot_id ||
    !event.channel ||
    (!typed && !clip) ||
    (channel && event.channel !== channel)
  ) {
    return new Response("", { status: 200 });
  }

  const thread = event.thread_ts || event.ts;
  const target = event.channel;
  after(async () => {
    try {
      let text = typed;
      let heard = "";
      if (clip?.url_private_download) {
        const file = await downloadSlackFile(clip.url_private_download);
        const catalog = await loadCatalog();
        const transcript = await transcribeAudio(
          file.bytes,
          clip.name || "voice.m4a",
          file.type || clip.mimetype || "audio/mp4",
          catalog.products.map((product) => product.title),
        );
        const instruction = await instructionFromSpeech(transcript);
        heard = transcript;
        text = instruction || transcript;
      }
      const outcome = await handleMerchantReply(text);
      const reply = heard ? `Heard: ${heard}\n${outcome.reply}` : outcome.reply;
      if (heard) await sendVoiceToAgent({ transcript: heard, instruction: text, result: outcome.reply });
      await replySlack(target, reply, thread, outcome.imageUrls[0]);
      for (const imageUrl of outcome.imageUrls.slice(1)) {
        await replySlack(target, "Updated still", thread, imageUrl);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not apply that.";
      await replySlack(target, message, thread);
    }
  });

  return new Response("", { status: 200 });
}
