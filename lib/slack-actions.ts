import { answerMerchant } from "@/lib/argue";
import { loadCatalog } from "@/lib/live-catalog";
import { reviseVariant } from "@/lib/revise";
import { latestBrief } from "@/lib/store";

export async function actOnSlack(text: string) {
  const note = text.trim();
  if (!note) return { reply: "Say what to change, or say push to go live." };

  if (/^(go live|push ads|push the ads|push it)\b/i.test(note) || note.toLowerCase() === "push") {
    const brief = await latestBrief();
    if (!brief) return { reply: "Run a brief on the desk first." };
    return {
      reply: "Staged. Meta and TikTok are not connected, so this does not send the ad yet.",
    };
  }

  const brief = await latestBrief();
  if (!brief?.chosen) return { reply: "Run a brief on the desk first." };

  const catalog = await loadCatalog();
  const hay = note.toLowerCase();
  const named = catalog.products.some((product) => {
    return hay.includes(product.title.toLowerCase()) || hay.includes(product.id.replaceAll("-", " "));
  });
  const switching = /\b(instead|switch|other campaign|suggest)\b/i.test(note) || /^(push|use|try)\s+/i.test(note);
  if (named && switching) {
    const outcome = await answerMerchant(note, brief.chosen.id, "suggest");
    return { reply: outcome.reply };
  }

  const selected =
    brief.chosen.variants?.find((variant) => variant.id === brief.chosen.selectedVariantId) ??
    brief.chosen.variants?.[0];
  if (!selected) return { reply: "This brief has no image to change yet." };

  const revised = await reviseVariant(selected.id, note);
  const image = revised.brief.chosen.variants?.find((variant) => variant.id === selected.id);
  return { reply: revised.reply, imageUrl: image?.imageUrl };
}
