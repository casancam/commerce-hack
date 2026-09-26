import { PRODUCTS } from "@/lib/catalog";
import { shopifyContext, shopifyGraphql, type ShopifyAuth } from "@/lib/shopify";
import { readSession } from "@/lib/shopify-session";
import type { Product } from "@/lib/types";

export type Catalog = {
  products: Product[];
  source: "shopify" | "seed";
  shopName: string | null;
  shopDescription: string | null;
  sales: "loaded" | "unavailable";
};

const RICH_QUERY = `
  query CatalogProducts($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        handle
        title
        onlineStoreUrl
        featuredMedia {
          ... on MediaImage {
            image { url }
          }
        }
        variants(first: 25) {
          nodes {
            price
            inventoryQuantity
            inventoryItem { unitCost { amount } }
          }
        }
      }
    }
  }
`;

const LEAN_QUERY = `
  query CatalogProducts($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        handle
        title
        variants(first: 25) {
          nodes {
            price
            inventoryQuantity
            inventoryItem { unitCost { amount } }
          }
        }
      }
    }
  }
`;

const ORDERS_QUERY = `
  query RecentOrders($cursor: String, $query: String) {
    orders(first: 50, after: $cursor, query: $query) {
      pageInfo { hasNextPage endCursor }
      nodes {
        lineItems(first: 40) {
          nodes {
            quantity
            product { handle }
          }
        }
      }
    }
  }
`;

type ShopifyNode = {
  handle: string;
  title: string;
  onlineStoreUrl?: string | null;
  featuredMedia?: { image?: { url?: string | null } | null } | null;
  variants: {
    nodes: {
      price: string;
      inventoryQuantity: number | null;
      inventoryItem: { unitCost: { amount: string } | null } | null;
    }[];
  };
};

type ProductPage = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: ShopifyNode[];
  };
};

type OrderPage = {
  orders: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: {
      lineItems: { nodes: { quantity: number; product: { handle: string } | null }[] };
    }[];
  };
};

function seedCatalog(): Catalog {
  return { products: PRODUCTS, source: "seed", shopName: null, shopDescription: null, sales: "loaded" };
}

function emptyShopify(shop: string, profile?: { shopName: string | null; shopDescription: string | null }): Catalog {
  return {
    products: [],
    source: "shopify",
    shopName: profile?.shopName ?? shop,
    shopDescription: profile?.shopDescription ?? null,
    sales: "unavailable",
  };
}

function plainText(value: string | null | undefined) {
  if (!value) return null;
  const text = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.slice(0, 400) || null;
}

function toProduct(node: ShopifyNode, domain: string, blendSeed: boolean): Product | null {
  const variants = node.variants.nodes;
  if (variants.length === 0) return null;
  const seed = blendSeed ? PRODUCTS.find((product) => product.id === node.handle) : undefined;
  const costAmount = variants.map((variant) => variant.inventoryItem?.unitCost?.amount).find(Boolean);
  const priceCents = Math.round(Number(variants[0].price) * 100);
  const costCents = costAmount ? Math.round(Number(costAmount) * 100) : (seed?.costCents ?? 0);
  const tracked = variants.some((variant) => variant.inventoryQuantity != null);
  const stock = tracked
    ? variants.reduce((sum, variant) => sum + (variant.inventoryQuantity ?? 0), 0)
    : (seed?.stock ?? 0);
  return {
    id: node.handle,
    title: node.title,
    priceCents,
    costCents,
    stock: stock || seed?.stock || 0,
    unitsSold30d: seed?.unitsSold30d ?? 0,
    imageUrl: node.featuredMedia?.image?.url || seed?.imageUrl || "",
    productUrl: node.onlineStoreUrl || `https://${domain}/products/${node.handle}`,
  };
}

async function shopProfile() {
  const data = await shopifyGraphql<{ shop: { name: string; description: string | null } }>(
    "query { shop { name description } }",
  );
  return { shopName: data.shop.name, shopDescription: plainText(data.shop.description) };
}

async function pullProducts(query: string) {
  const nodes: ShopifyNode[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 8; page += 1) {
    const data: ProductPage = await shopifyGraphql<ProductPage>(query, { cursor });
    nodes.push(...data.products.nodes);
    if (!data.products.pageInfo.hasNextPage || !data.products.pageInfo.endCursor) break;
    cursor = data.products.pageInfo.endCursor;
  }
  return nodes;
}

async function unitsSold() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const sold = new Map<string, number>();
  let cursor: string | null = null;
  for (let page = 0; page < 8; page += 1) {
    const data: OrderPage = await shopifyGraphql<OrderPage>(ORDERS_QUERY, {
      cursor,
      query: `created_at:>=${since}`,
    });
    for (const order of data.orders.nodes) {
      for (const line of order.lineItems.nodes) {
        const handle = line.product?.handle;
        if (!handle) continue;
        sold.set(handle, (sold.get(handle) ?? 0) + line.quantity);
      }
    }
    if (!data.orders.pageInfo.hasNextPage || !data.orders.pageInfo.endCursor) break;
    cursor = data.orders.pageInfo.endCursor;
  }
  return sold;
}

async function fetchCatalog(auth: ShopifyAuth): Promise<Catalog> {
  const profile = await shopProfile().catch(() => ({
    shopName: auth.domain,
    shopDescription: null as string | null,
  }));
  let nodes: ShopifyNode[];
  try {
    nodes = await pullProducts(RICH_QUERY);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    try {
      nodes = await pullProducts(LEAN_QUERY);
    } catch (leanError) {
      console.error(leanError instanceof Error ? leanError.message : leanError);
      if (auth.fromSession) return emptyShopify(auth.domain, profile);
      return seedCatalog();
    }
  }

  const blendSeed = !auth.fromSession;
  const products = nodes
    .map((node) => toProduct(node, auth.domain, blendSeed))
    .filter((product): product is Product => product !== null);
  if (products.length === 0) {
    return auth.fromSession ? emptyShopify(auth.domain, profile) : seedCatalog();
  }

  const sold = await unitsSold().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    return null;
  });

  return {
    products: products.map((product) => ({
      ...product,
      unitsSold30d: sold
        ? blendSeed
          ? sold.get(product.id) || product.unitsSold30d
          : (sold.get(product.id) ?? 0)
        : product.unitsSold30d,
    })),
    source: "shopify",
    sales: sold ? "loaded" : "unavailable",
    ...profile,
  };
}

let cached: { key: string; at: number; catalog: Catalog } | null = null;

export async function loadCatalog(options?: { fresh?: boolean }): Promise<Catalog> {
  const auth = await shopifyContext();
  if (!auth) {
    const session = await readSession();
    if (session) return emptyShopify(session.shop);
    return seedCatalog();
  }

  const key = `${auth.domain}:${auth.fromSession ? "session" : "env"}`;
  if (!options?.fresh && cached && cached.key === key && Date.now() - cached.at < 60_000) {
    return cached.catalog;
  }

  const catalog = await fetchCatalog(auth);
  cached = { key, at: Date.now(), catalog };
  return catalog;
}
