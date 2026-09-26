import { loadEnv } from "./load-env.mjs";

loadEnv();

const { serpApiCompetitorAds } = await import("../lib/serpapi");
const { publicCompetitorAds } = await import("../lib/public-ads");
const { rankCompetitorAds } = await import("../lib/grok");
const garment = "leather belt";
let t = Date.now();
const serp = await serpApiCompetitorAds(garment);
console.log("serp", ((Date.now() - t) / 1000).toFixed(1), serp.warning, serp.ads.map((ad) => ad.snippet.slice(0, 70)));
t = Date.now();
const direct = await publicCompetitorAds([garment]);
console.log("public", ((Date.now() - t) / 1000).toFixed(1), direct.length);
t = Date.now();
const ranked = await rankCompetitorAds(
  "/products/leather-belt.png",
  garment,
  serp.ads.map((ad) => ({ title: ad.title, imageUrl: ad.imageUrl, text: ad.snippet })),
);
console.log("rank", ((Date.now() - t) / 1000).toFixed(1), ranked.verdicts.map((v) => [v.index, v.match, v.item]));
