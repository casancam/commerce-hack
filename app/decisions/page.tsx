import { decisionBoard } from "@/lib/decide";
import { gbp } from "@/lib/format";
import { loadCatalog } from "@/lib/live-catalog";
import { loadRules } from "@/lib/rules";
import { readSession } from "@/lib/shopify-session";
import { latestBrief } from "@/lib/store";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DecisionsPage() {
  if (!(await readSession())) redirect("/");
  const catalog = await loadCatalog();
  const { rules } = await loadRules(catalog.products);
  const brief = await latestBrief();
  const board = decisionBoard(catalog.products, rules, brief);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-8 py-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Decisions</h1>
        <p className="mt-1 text-sm text-muted">What clears each product&apos;s rules, and what is held back.</p>
      </header>
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-lg font-semibold">Opportunities</h2>
          <ul className="mt-3 space-y-3">
            {board.opportunities.length === 0 ? (
              <li className="text-sm text-muted">Nothing clears its rules yet.</li>
            ) : (
              board.opportunities.map((item) => (
                <li key={item.id} className="text-sm">
                  <span className="font-medium">{item.title}.</span>{" "}
                  <span className="uppercase tracking-wide text-muted">{item.stance}.</span>{" "}
                  <span className="text-muted">
                    {gbp(item.priceCents)} · {item.marginPct}% · {item.stock} in stock. {item.why}
                  </span>
                </li>
              ))
            )}
          </ul>
        </article>
        <article className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-lg font-semibold">Blocked</h2>
          <ul className="mt-3 space-y-3">
            {board.rejected.length === 0 ? (
              <li className="text-sm text-muted">Nothing is blocked.</li>
            ) : (
              board.rejected.map((item) => (
                <li key={item.title} className="text-sm">
                  <span className="font-medium">{item.title}.</span>{" "}
                  <span className="text-muted">{item.reason}</span>
                </li>
              ))
            )}
          </ul>
        </article>
      </section>
    </main>
  );
}
