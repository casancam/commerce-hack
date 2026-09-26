import { selectVariant } from "@/lib/revise";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { variantId?: string } | null;
  const variantId = body?.variantId?.trim();
  if (!variantId) return Response.json({ error: "Pick a variant." }, { status: 400 });

  try {
    const brief = await selectVariant(variantId);
    return Response.json({ brief });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not select that still." },
      { status: 500 },
    );
  }
}
