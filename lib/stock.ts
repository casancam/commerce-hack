import { existsSync } from "node:fs";
import path from "node:path";

export function stockReference(product: { id: string; imageUrl: string }) {
  const local = path.join(process.cwd(), "public", "products", `${product.id}.png`);
  if (existsSync(local)) return `/products/${product.id}.png`;
  return product.imageUrl;
}
