"use client";

import { useEffect, useState } from "react";
import { gbp } from "@/lib/format";
import { minPriceFromMargin } from "@/lib/pricing";
import type { ProductRule } from "@/lib/types";

function pounds(cents: number) {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

function money(input: string) {
  const number = Number(input.replace(/£/g, "").trim());
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100);
}

function whole(input: string) {
  const number = Number(input.trim());
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number);
}

export function RuleFields({
  shelfCents,
  value,
  onSave,
}: {
  shelfCents: number;
  value: ProductRule;
  onSave: (next: ProductRule) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [note, setNote] = useState<string | null>(null);
  const [marginText, setMarginText] = useState(String(value.minMarginPct));

  useEffect(() => {
    setDraft(value);
    setMarginText(String(value.minMarginPct));
  }, [value.minPriceCents, value.campaignPriceCents, value.minMarginPct, value.minStock]);

  function commitMargin(input: string) {
    const margin = whole(input);
    if (margin === null || margin > 95) return;
    commit({
      ...draft,
      minMarginPct: margin,
      minPriceCents: minPriceFromMargin(shelfCents, margin),
    });
  }

  function commit(next: ProductRule) {
    if (next.campaignPriceCents < next.minPriceCents) {
      next = { ...next, campaignPriceCents: next.minPriceCents };
      setNote(`Campaign price held at ${gbp(next.minPriceCents)}, the shelf plus the min campaign profit.`);
    } else {
      setNote(null);
    }
    setDraft(next);
    onSave(next);
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="kicker text-ink">Min campaign profit</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold">
          <span className="num rounded-[0.85rem] border-2 border-ink bg-well px-3 py-2">{gbp(shelfCents)}</span>
          <span className="display text-xl">+</span>
          <span className="studio-field px-3">
            <input
              value={marginText}
              onChange={(event) => setMarginText(event.target.value)}
              onBlur={() => commitMargin(marginText)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitMargin(marginText);
                }
              }}
              inputMode="numeric"
              aria-label="Min campaign profit"
              className="num w-10 py-2 text-sm"
            />
            <span className="text-muted">%</span>
          </span>
          <span className="display text-xl">=</span>
          <span className="num rounded-[0.85rem] border-2 border-ink bg-accent px-3 py-2">{gbp(draft.minPriceCents)}</span>
        </div>
        <p className="mt-2 text-xs text-muted">Price is the shelf plus this profit.</p>
      </div>
      <div className="flex flex-wrap items-end gap-5">
        <Field
          label="Campaign price"
          value={pounds(draft.campaignPriceCents)}
          prefix="£"
          onCommit={(input) => {
            const cents = money(input);
            if (cents === null) return;
            commit({ ...draft, campaignPriceCents: cents });
          }}
        />
        <StopStock
          value={String(draft.minStock)}
          onCommit={(input) => {
            const stock = whole(input);
            if (stock === null) return;
            commit({ ...draft, minStock: stock });
          }}
        />
      </div>
      {note ? <p className="rounded-lg border-2 border-ink bg-hot/20 px-3 py-2 text-xs font-medium">{note}</p> : null}
    </div>
  );
}

function StopStock({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="block">
      <span className="kicker text-ink">Stop when stock is</span>
      <span className="mt-2 flex items-center gap-2 text-sm font-medium">
        <span className="studio-field px-3">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={() => onCommit(text)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCommit(text);
              }
            }}
            inputMode="numeric"
            className="num w-12 py-2 text-sm font-semibold"
          />
        </span>
        <span className="text-muted">or less</span>
      </span>
    </label>
  );
}

function Field({
  label,
  value,
  prefix,
  onCommit,
}: {
  label: string;
  value: string;
  prefix?: string;
  onCommit: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="block">
      <span className="kicker text-ink">{label}</span>
      <span className="studio-field mt-2 w-40 gap-1 px-3 text-sm font-semibold">
        {prefix ? <span className="text-muted">{prefix}</span> : null}
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => onCommit(text)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onCommit(text);
            }
          }}
          inputMode="decimal"
          className="num w-full py-2 text-sm"
        />
      </span>
    </label>
  );
}
