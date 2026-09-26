"use client";

import { useState } from "react";
import { RuleFields } from "@/components/RuleFields";
import { gbp } from "@/lib/format";
import type { Product, ProductRule } from "@/lib/types";

export function ProductsBoard({
  products,
  rules,
}: {
  products: Product[];
  rules: Record<string, ProductRule>;
}) {
  const [rulesState, setRulesState] = useState(rules);
  const [notice, setNotice] = useState<string | null>(null);

  async function saveRules(productId: string, next: ProductRule) {
    setRulesState((current) => ({ ...current, [productId]: next }));
    const response = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, ...next }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setNotice(body?.error ?? "Could not save those rules.");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-8 sm:px-8 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b-2 border-ink pb-8">
        <div>
          <p className="chip">{products.length} in the catalog</p>
          <h1 className="display mt-4 text-[clamp(3rem,7vw,6rem)] uppercase">
            The <span className="serif normal-case">products</span>
          </h1>
        </div>
        <p className="kicker max-w-xs">Shelf price, stock, and the rules for each product.</p>
      </header>
      {notice ? <p className="panel bg-hot px-5 py-4 text-[15px] font-medium">{notice}</p> : null}
      <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((product, index) => {
          const rule = rulesState[product.id];
          const low = rule ? product.stock <= rule.minStock : false;
          return (
            <li key={product.id} className="panel flex flex-col overflow-hidden">
              <div className="relative border-b-2 border-ink bg-well">
                <span className="kicker absolute top-4 left-4 z-10 text-ink">/{String(index + 1).padStart(2, "0")}</span>
                <span
                  className={`sticker absolute top-3 right-3 z-10 rotate-3 px-3 py-1 text-[11px] ${low ? "bg-hot" : "bg-accent"}`}
                >
                  {product.stock} in stock
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.imageUrl} alt={product.title} className="h-auto w-full object-contain" />
              </div>
              <div className="flex flex-1 flex-col gap-6 p-6">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="display text-3xl">{product.title}</h2>
                  <p className="display num shrink-0 text-2xl">{gbp(product.priceCents)}</p>
                </div>
                {rule ? (
                  <div className="border-t-2 border-dashed border-ink/30 pt-5">
                    <RuleFields
                      shelfCents={product.priceCents}
                      value={rule}
                      onSave={(next) => void saveRules(product.id, next)}
                    />
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
