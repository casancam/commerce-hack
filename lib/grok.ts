import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const API = "https://api.x.ai/v1";

export function grokConfigured() {
  return Boolean(process.env.XAI_API_KEY);
}

function apiKey() {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("Set XAI_API_KEY from console.x.ai");
  return key;
}

type ChatResponse = {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string } | string;
};

function errorMessage(error: ChatResponse["error"], fallback: string) {
  if (typeof error === "string") return error;
  return error?.message ?? fallback;
}

export async function grokSee(imageUrl: string, instruction: string) {
  const image = referenceImage(imageUrl);
  if (!image) throw new Error("No image for Grok to read");
  const response = await fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: process.env.GROK_MODEL || "grok-4.6",
      temperature: 0,
      messages: [
        { role: "system", content: "Reply with JSON only." },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: image.url } },
            { type: "text", text: instruction },
          ],
        },
      ],
    }),
  });
  const json = (await response.json()) as ChatResponse;
  if (!response.ok) throw new Error(errorMessage(json.error, "Grok could not read the image"));
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Grok returned an empty image reading");
  return content;
}

export async function garmentFromPhoto(imageUrl: string, title: string) {
  const text = await grokSee(
    imageUrl,
    `This product is titled "${title}". Name the garment a shopper would search for, such as "wool overshirt" or "leather belt". Do not include a brand. Reply JSON {"garment":"wool overshirt","colour":"taupe"}.`,
  );
  return parseGrokJson<{ garment: string; colour: string }>(text);
}

export type AdCandidate = { title: string; imageUrl: string | null; text: string };

export type AdVerdict = { index: number; match: boolean; item: string; score: number; hook: string };

async function remoteImage(url: string) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { "User-Agent": "Mozilla/5.0" } });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !/image\/(jpeg|jpg|png)/i.test(type)) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 4_000_000) return null;
    return `data:${type.split(";")[0]};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function rankCompetitorAds(productImageUrl: string, garment: string, candidates: AdCandidate[]) {
  const product = referenceImage(productImageUrl);
  if (!product) throw new Error("No product photo for Grok to compare against");
  const images = await Promise.all(candidates.map((ad) => (ad.imageUrl ? remoteImage(ad.imageUrl) : null)));

  const content: unknown[] = [
    { type: "text", text: `Image 0 is the product we are promoting: a ${garment}.` },
    { type: "image_url", image_url: { url: product.url, detail: "low" } },
  ];
  const listed: number[] = [];
  candidates.forEach((ad, index) => {
    const image = images[index];
    if (!image && !ad.text) return;
    listed.push(index);
    content.push({ type: "text", text: `Ad ${index} from ${ad.title}. ${ad.text}`.slice(0, 400) });
    if (image) content.push({ type: "image_url", image_url: { url: image, detail: "low" } });
  });
  if (listed.length === 0) return { verdicts: [] as AdVerdict[], angles: [] as string[] };

  content.push({
    type: "text",
    text: [
      `Judge every ad against image 0.`,
      `match is true only when the main item advertised is the same kind of product as ours. A different garment, a sale banner, or a logo card is not a match.`,
      `score is 0 to 10 for how strong the ad is as creative: would it stop someone scrolling. A plain packshot on white is at most 3.`,
      `hook is one sentence on how the ad sells, such as "worn open over a tee on a wet city street, warm light, close crop on the fabric".`,
      `angles is two to four short creative directions for our own ad, taken from what the strongest matching ads do. Do not copy a brand.`,
      `Reply JSON {"ads":[{"index":0,"match":true,"item":"","score":0,"hook":""}],"angles":[""]}.`,
    ].join(" "),
  });

  const response = await fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: process.env.GROK_MODEL || "grok-4.6",
      temperature: 0,
      messages: [
        { role: "system", content: "You are a performance creative director. Reply with JSON only." },
        { role: "user", content },
      ],
    }),
  });
  const json = (await response.json()) as ChatResponse;
  if (!response.ok) throw new Error(errorMessage(json.error, "Grok could not rank the competitor ads"));
  const reply = json.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("Grok returned an empty ad ranking");
  const parsed = parseGrokJson<{ ads?: Partial<AdVerdict>[]; angles?: string[] }>(reply);
  const verdicts = (parsed.ads ?? [])
    .filter((row) => typeof row.index === "number" && listed.includes(row.index))
    .map((row) => ({
      index: row.index as number,
      match: Boolean(row.match),
      item: String(row.item ?? ""),
      score: Math.max(0, Math.min(10, Number(row.score) || 0)),
      hook: String(row.hook ?? "").slice(0, 240),
    }));
  const angles = (parsed.angles ?? []).map((angle) => String(angle).trim().slice(0, 200)).filter(Boolean).slice(0, 4);
  return { verdicts, angles };
}

export async function grokChat(system: string, user: string) {
  const response = await fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: process.env.GROK_MODEL || "grok-4.6",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const json = (await response.json()) as ChatResponse;
  if (!response.ok) throw new Error(errorMessage(json.error, "Grok request failed"));
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Grok returned an empty reply");
  return content;
}

export function parseGrokJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Grok did not return JSON");
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

type ImageResponse = {
  data?: { url?: string }[];
  error?: { message?: string } | string;
};

async function readImage(response: Response, fallback: string) {
  const json = (await response.json()) as ImageResponse;
  if (!response.ok) throw new Error(errorMessage(json.error, fallback));
  const url = json.data?.[0]?.url;
  if (!url) throw new Error(`${fallback}: no URL`);
  return url;
}

export async function grokImage(prompt: string) {
  const response = await fetch(`${API}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: process.env.GROK_IMAGE_MODEL || "grok-imagine-image",
      prompt,
      n: 1,
      aspect_ratio: "1:1",
      response_format: "url",
    }),
  });
  return readImage(response, "Grok image request failed");
}

const IDENTITY_LOCK =
  "Edit the attached photo. It is the exact product for sale. Keep its colour, cut, fabric, seams, and design identical. Do not replace it with a similar item. Change only the setting around it. No text, no letters, no logo, no price, no watermark.";

function jpegDataUrl(file: string) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "haggly-"));
  const out = path.join(dir, "ref.jpg");
  execFileSync(
    "sips",
    ["-s", "format", "jpeg", "-s", "formatOptions", "60", "-Z", "1024", file, "--out", out],
    { stdio: "ignore" },
  );
  return `data:image/jpeg;base64,${readFileSync(out).toString("base64")}`;
}

function referenceImage(referenceUrl: string) {
  if (referenceUrl.startsWith("https://")) {
    return { url: referenceUrl, type: "image_url" };
  }
  if (!referenceUrl.startsWith("/")) return null;
  const file = path.join(process.cwd(), "public", referenceUrl);
  try {
    return { url: jpegDataUrl(file), type: "image_url" };
  } catch {
    const data = readFileSync(file).toString("base64");
    return { url: `data:image/png;base64,${data}`, type: "image_url" };
  }
}

export async function grokAdImage(prompt: string, referenceUrl?: string) {
  const image = referenceUrl ? referenceImage(referenceUrl) : null;
  if (!image) throw new Error("No stock photo to edit");

  const response = await fetch(`${API}/images/edits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: "grok-imagine-image-2.0",
      prompt: `${IDENTITY_LOCK} ${prompt}`,
      aspect_ratio: "1:1",
      image,
    }),
  });
  return readImage(response, "Grok image edit failed");
}
