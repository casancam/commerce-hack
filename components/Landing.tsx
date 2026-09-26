const ERRORS: Record<string, string> = {
  config: "Add the app client id and secret before connecting a store.",
  shop: "Use the store's myshopify.com domain.",
  state: "That sign-in expired. Connect again.",
  hmac: "Shopify's signature did not match. Connect again.",
  denied: "Shopify access was declined.",
  token: "Shopify did not return a token. Check the redirect URL on the app, then connect again.",
  scope: "The app needs access to products.",
};

const FEATURES = [
  {
    title: "Ads, managed",
    body: "Haggly picks the product that should move and stages the Meta and TikTok campaigns for you.",
  },
  {
    title: "Margin, protected",
    body: "A campaign only runs when the price still earns. If the deal is too thin, it stays off.",
  },
  {
    title: "Inventory, watched",
    body: "Stock is part of the decision. When units run down, Haggly stops promoting that product.",
  },
  {
    title: "Deals, found",
    body: "It checks what the market charges and sets a campaign price that still clears your floor.",
  },
  {
    title: "Competitors, read",
    body: "Rival ads and prices come in before the brief, so the creative is aimed at what is already working.",
  },
  {
    title: "Creatives, generated",
    body: "New images and copy are made from the product you already sell, ready to put in the ad.",
  },
];

export function landingError(code?: string) {
  if (!code) return null;
  return ERRORS[code] ?? "Could not connect the store.";
}

export function Landing({
  defaultShop,
  ready,
  error,
}: {
  defaultShop: string;
  ready: boolean;
  error: string | null;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-line/80 bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-6">
          <a href="#top" className="flex min-w-0 items-center gap-2">
            <img src="/haggly.png" alt="" className="h-8 w-8 shrink-0 object-contain" />
            <span className="truncate text-sm font-semibold tracking-tight">Haggly</span>
          </a>
          <a href="#connect" className="studio-btn studio-btn-primary shrink-0 px-3 py-2 text-xs sm:text-sm">
            Connect
          </a>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
          <div>
            <p className="kicker">Ecommerce on autopilot</p>
            <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Grow the store. Haggly runs the ads.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted">
              Connect Shopify and let Haggly manage the advertising. It chooses what to promote, protects your margin, watches inventory, finds a price that still earns, reads the competition, and generates the creative.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2 text-xs text-muted">
              <li className="rounded-full border border-line bg-card px-3 py-1">Meta and TikTok</li>
              <li className="rounded-full border border-line bg-card px-3 py-1">Margin floor</li>
              <li className="rounded-full border border-line bg-card px-3 py-1">Stock</li>
              <li className="rounded-full border border-line bg-card px-3 py-1">Competitor ads</li>
            </ul>
          </div>
          <ConnectCard id="connect" defaultShop={defaultShop} ready={ready} error={error} />
        </section>

        <section className="border-t border-line bg-card">
          <div className="mx-auto w-full max-w-6xl px-6 py-16">
            <p className="kicker">What it runs</p>
            <h2 className="mt-2 max-w-lg text-3xl font-semibold tracking-tight">The work after the store is connected.</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="panel p-5">
                  <h3 className="text-base font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{feature.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <p className="kicker">How it starts</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Three steps, then it keeps going.</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ["Approve Shopify", "Enter the store domain. Shopify asks you to approve access to products, stock, and orders."],
              ["Import the catalog", "Haggly pulls products, prices, cost, inventory, and the last 30 days of sales."],
              ["Open the studio", "A product, a price that still earns, and ads ready to stage."],
            ].map(([title, body], index) => (
              <li key={title} className="panel p-5">
                <p className="font-mono text-xs text-accent">0{index + 1}</p>
                <h3 className="mt-3 text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-sidebar text-white">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-6 py-16 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <img src="/haggly.png" alt="" className="brief-logo h-16 w-16 rounded-xl bg-[#f6f3ee] object-contain p-1" />
              <h2 className="mt-5 max-w-md text-3xl font-semibold tracking-tight">Connect the store. Let it earn.</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-[#b7b1a8]">
                Haggly only promotes what clears your rules. Stock, margin, and the market price stay in the decision, every time it runs.
              </p>
            </div>
            <ConnectCard id="connect-again" defaultShop={defaultShop} ready={ready} error={error} light />
          </div>
        </section>
      </main>
    </div>
  );
}

function ConnectCard({
  id,
  defaultShop,
  ready,
  error,
  light,
}: {
  id: string;
  defaultShop: string;
  ready: boolean;
  error: string | null;
  light?: boolean;
}) {
  const quiet = light ? "text-muted" : "text-[#c9c2b6]";
  return (
    <form
      id={id}
      action="/api/shopify/auth"
      className={`flex flex-col gap-3 rounded-2xl p-6 sm:p-7 ${
        light ? "bg-[#f6f3ee] text-foreground" : "bg-ink text-[#f6f3ee] shadow-[0_20px_50px_rgba(22,20,17,0.16)]"
      }`}
    >
      <div>
        <p className={`text-[11px] font-semibold tracking-[0.14em] uppercase ${light ? "text-accent" : "text-[#c8b48a]"}`}>
          Shopify
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Connect your store</h2>
        <p className={`mt-2 text-sm leading-6 ${quiet}`}>
          Use the store’s myshopify.com domain. You’ll approve access, then Haggly imports the catalog.
        </p>
      </div>
      <label className="mt-2 text-sm font-medium" htmlFor={`${id}-shop`}>
        Store domain
      </label>
      <input
        id={`${id}-shop`}
        name="shop"
        defaultValue={defaultShop}
        placeholder="your-store.myshopify.com"
        className="studio-input text-foreground"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        required
      />
      {error ? <p className={`text-sm ${light ? "text-bad" : "text-[#f0b4ae]"}`}>{error}</p> : null}
      <button
        type="submit"
        className={
          light
            ? "studio-btn studio-btn-primary"
            : "mt-1 w-full rounded-md bg-[#f6f3ee] px-4 py-2.5 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-45"
        }
        disabled={!ready}
      >
        Connect Shopify
      </button>
      {ready ? null : <p className={`text-xs ${quiet}`}>Connect opens once the Shopify app is configured.</p>}
    </form>
  );
}
