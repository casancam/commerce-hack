import { readFileSync } from "node:fs";
import { loadEnv } from "./load-env.mjs";

loadEnv();

const catalog = JSON.parse(readFileSync(new URL("../data/products.json", import.meta.url), "utf8"));
const images = new Map(catalog.map((product) => [product.id, product.imageUrl]));
const domain = (process.env.SHOPIFY_STORE_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");

async function token() {
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
const listed = await graphql(
  accessToken,
  `query {
    products(first: 50) {
      nodes {
        id
        title
        handle
        status
        onlineStoreUrl
        totalInventory
        media(first: 1) { nodes { id } }
        variants(first: 1) { nodes { price title } }
      }
    }
  }`,
);

console.log("Before");
for (const product of listed.products.nodes) {
  console.log(
    `${product.handle}\t${product.title}\t${product.variants.nodes[0]?.price}\tstock ${product.totalInventory}\timage ${product.media.nodes.length}\turl ${product.onlineStoreUrl ?? "unpublished"}`,
  );
}

const withImage = `
  mutation WithImage($productId: ID!, $media: [CreateMediaInput!]!) {
    productCreateMedia(productId: $productId, media: $media) {
      media { alt status }
      mediaUserErrors { field message }
    }
  }
`;

for (const product of listed.products.nodes) {
  const imageUrl = images.get(product.handle);
  if (imageUrl && product.media.nodes.length === 0) {
    const imaged = await graphql(accessToken, withImage, {
      productId: product.id,
      media: [{ originalSource: imageUrl, alt: product.title, mediaContentType: "IMAGE" }],
    });
    const errors = imaged.productCreateMedia.mediaUserErrors;
    console.log(errors.length ? `image fail ${product.title}: ${errors.map((error) => error.message).join("; ")}` : `image ok ${product.title}`);
  }
}
