const FILLER = /^(the|and|with|for|from|men'?s?|women'?s?|kids?|bag|bags)$/i;

/** The product kind: "Canvas tote" → tote, "Leather belt" → belt. */
export function productType(garment: string) {
  const words = garment
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/g, ""))
    .filter((word) => word.length > 2 && !FILLER.test(word));
  return words.at(-1) ?? "";
}

export function sameProduct(text: string, garment: string) {
  const type = productType(garment);
  if (!type) return false;
  const hay = text.toLowerCase();
  if (type === "belt" && /\b(fan|timing|seat|drive|conveyor)\s+belts?\b/.test(hay)) return false;
  if (type === "belt" && /\bbelt\s+bags?\b/.test(hay)) return false;
  return new RegExp(`\\b${type}s?\\b`).test(hay);
}
