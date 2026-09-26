import { proposalText } from "@/lib/proposal";
import { postSlackCampaign } from "@/lib/slack";
import { saveDecision } from "@/lib/store";
import type { Brief } from "@/lib/types";

export async function deliverProposal(brief: Brief, warning?: string | null) {
  const text = [proposalText(brief), warning].filter(Boolean).join("\n\n");
  const slack = await postSlackCampaign(brief, text);
  if (slack.channel && slack.ts) {
    brief.slack = { channel: slack.channel, ts: slack.ts };
    await saveDecision(brief);
  }
  return { slack, grokbot: { sent: false } };
}
