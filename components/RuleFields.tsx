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
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Min campaign profit</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-md border border-line bg-background px-3 py-2">{gbp(shelfCents)}</span>
        <span className="text-muted">+</span>
        <span className="flex items-center rounded-md border border-line bg-background px-3">
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
            className="w-12 bg-transparent py-2 text-sm outline-none"
          />
          <span className="text-muted">%</span>
        </span>
        <span className="text-muted">=</span>
        <span className="font-semibold">{gbp(draft.minPriceCents)}</span>
      </div>
      <p className="mt-1 text-xs text-muted">Price is the shelf plus this profit.</p>
      <div className="mt-3 max-w-xs">
        <Field
          label="Campaign price"
          value={pounds(draft.campaignPriceCents)}
          onCommit={(input) => {
            const cents = money(input);
            if (cents === null) return;
            commit({ ...draft, campaignPriceCents: cents });
          }}
        />
      </div>
      <StopStock
        value={String(draft.minStock)}
        onCommit={(input) => {
          const stock = whole(input);
          if (stock === null) return;
          commit({ ...draft, minStock: stock });
        }}
      />
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

function StopStock({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="mt-3 flex items-center gap-2 text-sm">
      <span>Stop when stock is</span>
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
        className="w-16 rounded-md border border-line bg-background px-2 py-1.5 text-sm outline-none"
      />
      <span>or less</span>
    </label>
  );
}

function Field({
  label,
  value,
  suffix,
  onCommit,
}: {
  label: string;
  value: string;
  suffix?: string;
  onCommit: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="block text-xs">
      <span className="font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className="mt-1 flex items-center rounded-md border border-line bg-background px-3">
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
          className="w-full bg-transparent py-2 text-sm outline-none"
        />
        {suffix ? <span className="text-muted">{suffix}</span> : null}
      </span>
    </label>
  );
}
