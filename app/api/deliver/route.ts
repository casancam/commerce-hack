import { deliverProposal } from "@/lib/deliver";
import { latestBrief } from "@/lib/store";

export const maxDuration = 30;

export async function POST() {
  const brief = await latestBrief();
  if (!brief) return Response.json({ error: "Run a brief first." }, { status: 404 });
  try {
    const delivered = await deliverProposal(brief);
    return Response.json(delivered);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not post to Slack.";
    return Response.json({ error: message }, { status: 502 });
  }
}
