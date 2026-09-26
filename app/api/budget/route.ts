import { savePlatformBudget } from "@/lib/rules";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    platform?: string;
    dailyBudgetCents?: number;
  } | null;
  const platform = body?.platform === "tiktok" ? "tiktok" : body?.platform === "meta" ? "meta" : null;
  const dailyBudgetCents = Math.round(Number(body?.dailyBudgetCents));
  if (!platform || !Number.isFinite(dailyBudgetCents) || dailyBudgetCents <= 0) {
    return Response.json({ error: "Set a daily budget above zero." }, { status: 400 });
  }

  try {
    await savePlatformBudget(platform, dailyBudgetCents);
    return Response.json({ platform, dailyBudgetCents });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save the budget." },
      { status: 500 },
    );
  }
}
