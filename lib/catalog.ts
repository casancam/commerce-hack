import products from "@/data/products.json";
import type { Policy, Product } from "@/lib/types";

export const POLICY: Policy = {
  minMarginPct: 40,
  maxDailySpendCents: 15000,
  minStock: 5,
};

export const PRODUCTS = products as Product[];
