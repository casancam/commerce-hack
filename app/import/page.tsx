import { ImportScreen } from "@/components/ImportScreen";
import { readSession } from "@/lib/shopify-session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const session = await readSession();
  if (!session) redirect("/");
  return <ImportScreen shop={session.shop} />;
}
