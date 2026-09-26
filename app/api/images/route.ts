import { reviseVariant } from "@/lib/revise";

export const maxDuration = 120;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { variantId?: string; message?: string; regenerate?: boolean }
    | null;
  const variantId = body?.variantId?.trim() ?? "";
  const message = body?.message?.trim() ?? "";
  if (!variantId || (!message && !body?.regenerate)) {
    return Response.json({ error: "Say which image to change." }, { status: 400 });
  }

  try {
    const outcome = await reviseVariant(variantId, body?.regenerate ? undefined : message);
    return Response.json(outcome);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not edit that image." },
      { status: 500 },
    );
  }
}
