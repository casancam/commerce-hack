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
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-8 sm:px-8 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b-2 border-ink pb-8">
        <div>
          <p className="chip">
            {board.opportunities.length} go · {board.rejected.length} held
          </p>
          <h1 className="display mt-4 text-[clamp(3rem,7vw,6rem)] uppercase">
            The <span className="serif normal-case">decisions</span>
          </h1>
        </div>
        <p className="kicker max-w-xs">What clears each product&apos;s rules, and what is held back.</p>
      </header>
      <section className="grid gap-6 lg:grid-cols-2">
        <article className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b-2 border-ink bg-accent px-6 py-4">
            <h2 className="display text-3xl uppercase">Go</h2>
            <span className="display text-3xl">{board.opportunities.length}</span>
          </div>
          <ul className="divide-y-2 divide-dashed divide-ink/20">
            {board.opportunities.length === 0 ? (
              <li className="px-6 py-5 text-[15px] text-muted">Nothing clears its rules yet.</li>
            ) : (
              board.opportunities.map((item) => (
                <li key={item.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="display text-2xl">{item.title}</p>
                    <span className="chip bg-ink text-accent">{item.stance}</span>
                  </div>
                  <p className="mt-3 flex flex-wrap gap-2">
                    <span className="chip num">{gbp(item.priceCents)}</span>
                    <span className="chip num">{item.marginPct}% margin</span>
                    <span className="chip num">{item.stock} in stock</span>
                  </p>
                  <p className="mt-3 text-[15px] leading-6 text-ink/70">{item.why}</p>
                </li>
              ))
            )}
          </ul>
        </article>
        <article className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b-2 border-ink bg-hot px-6 py-4">
            <h2 className="display text-3xl uppercase">Held</h2>
            <span className="display text-3xl">{board.rejected.length}</span>
          </div>
          <ul className="divide-y-2 divide-dashed divide-ink/20">
            {board.rejected.length === 0 ? (
              <li className="px-6 py-5 text-[15px] text-muted">Nothing is blocked.</li>
            ) : (
              board.rejected.map((item) => (
                <li key={item.title} className="px-6 py-5">
                  <p className="display text-2xl">{item.title}</p>
                  <p className="mt-2 text-[15px] leading-6 text-ink/70">{item.reason}</p>
                </li>
              ))
            )}
          </ul>
        </article>
      </section>
    </main>
  );
}
