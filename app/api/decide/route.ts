import { runBrief } from "@/lib/brief";
import { buildPreview } from "@/lib/decide";
import { loadCatalog } from "@/lib/live-catalog";

export const maxDuration = 45;
export const dynamic = "force-dynamic";

export async function POST() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        const line = JSON.stringify(data);
        // Dev proxies and gzip hold tiny writes until the stream closes, so the
        // desk never leaves the first stage. Pad each event past that buffer.
        const pad = " ".repeat(Math.max(0, 20_000 - line.length));
        controller.enqueue(encoder.encode(`${line}${pad}\n`));
      };
      try {
        const { brief, warning } = await runBrief((update) => send(update));
        send({ stage: "done", brief, warning });
      } catch (error) {
        send({
          stage: "error",
          error: error instanceof Error ? error.message : "Could not run today's brief.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function GET() {
  const catalog = await loadCatalog();
  return Response.json(buildPreview(catalog));
}
