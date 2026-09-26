import { getSupabase } from "@/lib/supabase";

export function tavilyConfigured() {
  return Boolean(process.env.TAVILY_API_KEY);
}

export type TavilyHit = { title: string; url: string; content: string };

export async function tavilySearch(query: string, maxResults = 5, withImages = false) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("Set TAVILY_API_KEY");

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: maxResults,
      include_images: withImages,
    }),
  });
  const json = (await response.json()) as {
    results?: TavilyHit[];
    images?: string[];
    detail?: { error?: string };
    error?: string;
  };
  if (!response.ok) {
    throw new Error(json.detail?.error ?? json.error ?? "Tavily search failed");
  }

  const results = json.results ?? [];
  const images = (json.images ?? []).filter((url) => url.startsWith("http"));
  const supabase = getSupabase();
  if (supabase) {
    await supabase.from("research").insert({ query, payload: { results, images } });
  }
  return { results, images };
}
