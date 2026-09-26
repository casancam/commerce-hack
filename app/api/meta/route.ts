import { publishMetaCampaign } from "@/lib/meta";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    headline?: string;
    primaryText?: string;
    imageUrl?: string;
    destinationUrl?: string;
    dailyBudgetCents?: number;
  } | null;
  const name = body?.name?.trim() ?? "";
  const headline = body?.headline?.trim() ?? "";
  const primaryText = body?.primaryText?.trim() ?? "";
  const imageUrl = body?.imageUrl?.trim() ?? "";
  const destinationUrl = body?.destinationUrl?.trim() ?? "";
  const dailyBudgetCents = Math.round(Number(body?.dailyBudgetCents));
  if (!name || !headline || !primaryText || !imageUrl || !destinationUrl) {
    return Response.json({ error: "The staged Meta ad is missing copy, an image, or a link." }, { status: 400 });
  }

  try {
    const created = await publishMetaCampaign({
      name,
      headline,
      primaryText,
      imageUrl,
      destinationUrl,
      dailyBudgetCents,
    });
    return Response.json(created);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Meta did not create the campaign." },
      { status: 502 },
    );
  }
}
