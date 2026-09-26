import { runBrief } from "@/lib/brief";
import { deliverProposal } from "@/lib/deliver";
import { buildPreview } from "@/lib/decide";
import { loadCatalog } from "@/lib/live-catalog";

export const maxDuration = 120;

export async function POST() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`));
      };
      try {
        const { brief, warning } = await runBrief((stage) => send({ stage }));
        const delivered = await deliverProposal(brief, warning);
        send({ stage: "done", brief, warning, ...delivered });
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
