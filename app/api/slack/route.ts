import { after } from "next/server";
import { actOnSlack } from "@/lib/slack-actions";
import { replySlack, verifySlack } from "@/lib/slack";

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
  };
};

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
  const text = event?.text?.replace(/<@[^>]+>/g, "").trim() ?? "";
  if (
    event?.type !== "message" ||
    event.subtype ||
    event.bot_id ||
    !event.channel ||
    !text ||
    (channel && event.channel !== channel)
  ) {
    return new Response("", { status: 200 });
  }

  const thread = event.thread_ts || event.ts;
  const target = event.channel;
  after(async () => {
    try {
      const outcome = await actOnSlack(text);
      await replySlack(target, outcome.reply, thread, outcome.imageUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not apply that.";
      await replySlack(target, message, thread);
    }
  });

  return new Response("", { status: 200 });
}
