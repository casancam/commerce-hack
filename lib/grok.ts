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
