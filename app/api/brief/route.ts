import { latestDecision } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const row = await latestDecision();
  if (!row) return Response.json({ createdAt: null, brief: null });
  return Response.json(row);
}
