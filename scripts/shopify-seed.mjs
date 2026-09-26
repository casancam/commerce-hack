import { readFileSync } from "node:fs";
import { loadEnv } from "./load-env.mjs";

loadEnv();

const products = JSON.parse(readFileSync(new URL("../data/products.json", import.meta.url), "utf8"));
const domain = (process.env.SHOPIFY_STORE_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");

if (!domain) {
  console.error("Set SHOPIFY_STORE_DOMAIN in .env");
  process.exit(1);
}

async function token() {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;
  const response = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SHOPIFY_CLIENT_ID ?? "",
      client_secret: process.env.SHOPIFY_CLIENT_SECRET ?? "",
    }),
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description ?? body.error ?? "Could not get a Shopify token");
  }
  return body.access_token;
}

async function graphql(accessToken, query, variables) {
  const response = await fetch(`https://${domain}/admin/api/2026-07/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();
  if (body.errors?.length) throw new Error(body.errors.map((error) => error.message).join("; "));
  return body.data;
}

const accessToken = await token();
const shop = await graphql(accessToken, "query { shop { name } locations(first: 1) { nodes { id name } } }");
const locationId = shop.locations.nodes[0]?.id;
if (!locationId) throw new Error("The store has no location");
console.log(`Seeding ${shop.shop.name}`);

const upsert = `
  mutation Seed($synchronous: Boolean!, $input: ProductSetInput!) {
    productSet(synchronous: $synchronous, input: $input) {
      product { id handle }
      userErrors { field message }
    }
  }
`;
const existingQuery = `
  query Existing($handle: String!) {
    productByIdentifier(identifier: { handle: $handle }) { id }
  }
`;

for (const product of products) {
  const existing = await graphql(accessToken, existingQuery, { handle: product.id });
  const input = {
    ...(existing.productByIdentifier ? { id: existing.productByIdentifier.id } : {}),
    title: product.title,
    handle: product.id,
    status: "ACTIVE",
    productOptions: [{ name: "Title", values: [{ name: "Default Title" }] }],
    variants: [
      {
        optionValues: [{ optionName: "Title", name: "Default Title" }],
        price: (product.priceCents / 100).toFixed(2),
        sku: product.id,
        inventoryItem: {
          tracked: true,
          sku: product.id,
          cost: (product.costCents / 100).toFixed(2),
        },
        inventoryQuantities: [{ locationId, name: "available", quantity: product.stock }],
      },
    ],
  };
  const result = await graphql(accessToken, upsert, { synchronous: true, input });
  const errors = result.productSet.userErrors;
  if (errors.length) {
    console.log(`fail  ${product.title}: ${errors.map((error) => error.message).join("; ")}`);
    continue;
  }
  console.log(`ok    ${product.title}  ${result.productSet.product.id}`);
}
