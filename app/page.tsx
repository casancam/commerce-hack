import { Desk } from "@/components/Desk";
import { buildBundle } from "@/lib/decide";

export default function Home() {
  return <Desk initial={buildBundle()} />;
}
