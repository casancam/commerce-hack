import { readFileSync, statSync } from "node:fs";
import { loadEnv } from "./load-env.mjs";

loadEnv();

const domain = (process.env.SHOPIFY_STORE_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const products = JSON.parse(readFileSync(new URL("../data/products.json", import.meta.url), "utf8"));

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

const stage = `
  mutation Stage($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }
`;

const attach = `
  mutation Attach($productId: ID!, $media: [CreateMediaInput!]!) {
    productCreateMedia(productId: $productId, media: $media) {
      media { alt status }
      mediaUserErrors { field message }
    }
  }
`;

const accessToken = await token();
const listed = await graphql(
  accessToken,
  `query { products(first: 50) { nodes { id handle title media(first: 1) { nodes { id } } } } }`,
);
const byHandle = new Map(listed.products.nodes.map((product) => [product.handle, product]));

for (const product of products) {
  const shop = byHandle.get(product.id);
  if (!shop) {
    console.log(`missing ${product.id}`);
    continue;
  }
  if (shop.media.nodes.length > 0) {
    console.log(`already has image ${product.title}`);
    continue;
  }

  const filePath = new URL(`../public/products/${product.id}.png`, import.meta.url);
  const bytes = readFileSync(filePath);
  const staged = await graphql(accessToken, stage, {
    input: [{
      filename: `${product.id}.png`,
      mimeType: "image/png",
      resource: "PRODUCT_IMAGE",
      fileSize: String(statSync(filePath).size),
      httpMethod: "POST",
    }],
  });
  const target = staged.stagedUploadsCreate.stagedTargets?.[0];
  const stageErrors = staged.stagedUploadsCreate.userErrors;
  if (!target || stageErrors?.length) {
    console.log(`stage fail ${product.title}: ${stageErrors?.map((error) => error.message).join("; ") || "no target"}`);
    continue;
  }

  const form = new FormData();
  for (const parameter of target.parameters) form.append(parameter.name, parameter.value);
  form.append("file", new Blob([bytes], { type: "image/png" }), `${product.id}.png`);
  const uploaded = await fetch(target.url, { method: "POST", body: form });
  if (!uploaded.ok) {
    console.log(`upload fail ${product.title}: ${uploaded.status}`);
    continue;
  }

  const imaged = await graphql(accessToken, attach, {
    productId: shop.id,
    media: [{ originalSource: target.resourceUrl, alt: product.title, mediaContentType: "IMAGE" }],
  });
  const errors = imaged.productCreateMedia.mediaUserErrors;
  console.log(errors.length ? `image fail ${product.title}: ${errors.map((error) => error.message).join("; ")}` : `image ok ${product.title}`);
}
