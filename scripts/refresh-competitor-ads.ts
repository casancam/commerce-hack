import { loadEnv } from "./load-env.mjs";

loadEnv();

const { garmentFromPhoto } = await import("../lib/grok");
const { findCompetitorAds } = await import("../lib/research");
const { latestBrief, saveDecision } = await import("../lib/store");

const brief = await latestBrief();
if (!brief) throw new Error("No brief");
const garment = await garmentFromPhoto(brief.chosen.imageUrl, brief.chosen.title);
console.log("garment", garment.garment, garment.colour);
const { competitorAds: ads, angles, problems } = await findCompetitorAds({
  garment: garment.garment,
  productImageUrl: brief.chosen.imageUrl,
});
const warning = problems[0] ?? null;
console.log("warning", warning);
for (const ad of ads) console.log(ad.platform, ad.title, ad.snippet);
console.log("angles", angles);
if (ads.length === 0) throw new Error(warning || "No matching image ads");
brief.competitorAds = ads;
brief.competitorAd = ads[0];
brief.creativeAngles = angles;
brief.research = [
  ...(brief.research ?? []).filter((link) => link.kind !== "ad"),
  ...ads.map((ad) => ({
    query: ad.platform === "Meta" ? "Meta Ad Library" : "Google Ads Transparency",
    title: ad.title,
    url: ad.url,
    kind: "ad" as const,
    imageUrl: ad.imageUrl,
    snippet: ad.snippet,
  })),
];
await saveDecision(brief);
console.log("saved", ads.length);
