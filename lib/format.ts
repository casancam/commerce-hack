export function gbp(cents: number) {
  const pounds = cents / 100;
  const hasPence = cents % 100 !== 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: hasPence ? 2 : 0,
    maximumFractionDigits: hasPence ? 2 : 0,
  }).format(pounds);
}

export function marginPct(priceCents: number, costCents: number) {
  if (priceCents <= 0) return 0;
  return Math.round(((priceCents - costCents) * 100) / priceCents);
}
