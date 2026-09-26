const GENERIC_WORD = /^(the|and|with|for|from|men'?s?|women'?s?|kids?)$/i;

export function sameProduct(text: string, garment: string) {
  const words = garment
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/g, ""))
    .filter((word) => word.length > 2 && !GENERIC_WORD.test(word));
  const hay = text.toLowerCase();
  if (words.length === 0) return hay.includes(garment.toLowerCase());
  return words.every((word) => hay.includes(word));
}
