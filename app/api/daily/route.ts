import { runBrief } from "@/lib/brief";
import { deliverProposal } from "@/lib/deliver";

export const maxDuration = 120;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { brief, warning } = await runBrief();
  const delivered = await deliverProposal(brief, warning);
  return Response.json({ brief, warning, ...delivered });
}
