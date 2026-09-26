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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-8 py-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
        <p className="mt-1 text-sm text-muted">Shelf price, stock, and the rules for each product.</p>
      </header>
      {notice ? <p className="text-sm">{notice}</p> : null}
      <ul className="grid gap-4 sm:grid-cols-2">
        {products.map((product) => {
          const rule = rulesState[product.id];
          return (
            <li key={product.id} className="overflow-hidden rounded-2xl border border-line bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={product.imageUrl} alt={product.title} className="h-auto w-full object-contain" />
              <div className="space-y-4 p-5">
                <div>
                  <h2 className="text-lg font-semibold">{product.title}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {gbp(product.priceCents)} · {product.stock} in stock
                  </p>
                </div>
                {rule ? (
                  <RuleFields
                    shelfCents={product.priceCents}
                    value={rule}
                    onSave={(next) => void saveRules(product.id, next)}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
