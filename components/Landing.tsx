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
    tone: "bg-accent",
  },
  {
    title: "Margin, protected",
    body: "A campaign only runs when the price still earns. If the deal is too thin, it stays off.",
    tone: "bg-card",
  },
  {
    title: "Inventory, watched",
    body: "Stock is part of the decision. When units run down, Haggly stops promoting that product.",
    tone: "bg-lilac",
  },
  {
    title: "Deals, found",
    body: "It checks what the market charges and sets a campaign price that still clears your floor.",
    tone: "bg-sky",
  },
  {
    title: "Competitors, read",
    body: "Rival ads and prices come in before the brief, so the creative is aimed at what is already working.",
    tone: "bg-hot",
  },
  {
    title: "Creatives, generated",
    body: "New images and copy are made from the product you already sell, ready to put in the ad.",
    tone: "bg-card",
  },
];

const TICKER = ["Meta ads", "TikTok ads", "Margin floor", "Stock watch", "Competitor intel", "Fresh creative", "Deal pricing"];

export function landingError(code?: string) {
  if (!code) return null;
  return ERRORS[code] ?? "Could not connect the store.";
}

export function Landing({
  ready,
  error,
}: {
  ready: boolean;
  error: string | null;
}) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b-2 border-ink bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <a href="#top" className="flex min-w-0 items-center gap-2">
            <img src="/haggly.png" alt="" className="h-9 w-9 shrink-0 object-contain" />
            <span className="display text-2xl">haggly</span>
            <span className="sticker ml-1 hidden bg-accent px-2 py-0.5 text-[10px] sm:inline-flex">Ad studio</span>
          </a>
          <nav className="flex items-center gap-2">
            <a href="#work" className="kicker hidden px-3 text-ink hover:underline sm:block">
              What it does
            </a>
            <a href="#steps" className="kicker hidden px-3 text-ink hover:underline sm:block">
              How
            </a>
            <a href="#connect" className="studio-btn studio-btn-primary studio-btn-sm">
              Connect ↗
            </a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="relative">
          <div className="dotgrid absolute inset-0 opacity-60" aria-hidden="true" />
          <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pt-14 pb-20 sm:px-8 lg:grid-cols-[1.25fr_0.75fr] lg:pt-20 lg:pb-28">
            <div>
              <p className="chip bg-card">
                <span className="blink h-2 w-2 rounded-full bg-hot" /> Ecommerce on autopilot
              </p>
              <h1 className="display mt-6 text-[clamp(3.5rem,10vw,9rem)] uppercase">
                Grow
                <br />
                the{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">store.</span>
                  <span className="absolute inset-x-[-0.1em] bottom-[0.08em] z-0 h-[0.32em] -rotate-1 bg-accent" />
                </span>
              </h1>
              <p className="serif mt-3 text-[clamp(2.25rem,5vw,4.5rem)] leading-none">
                Haggly runs the ads.
              </p>
              <p className="mt-8 max-w-xl text-lg leading-8 text-muted">
                Connect Shopify and let Haggly manage the advertising. It chooses what to promote, protects your margin,
                watches inventory, finds a price that still earns, reads the competition, and generates the creative.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a href="#connect" className="studio-btn studio-btn-acid px-6 py-3 text-base">
                  Connect Shopify →
                </a>
                <a href="#work" className="studio-btn studio-btn-secondary px-6 py-3 text-base">
                  See the work
                </a>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md">
              <div className="absolute -top-6 -right-2 z-10 flex h-28 w-28 items-center justify-center">
                <svg viewBox="0 0 100 100" className="spin-slow absolute inset-0 h-full w-full" aria-hidden="true">
                  <defs>
                    <path id="ring" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
                  </defs>
                  <circle cx="50" cy="50" r="48" fill="var(--hot)" stroke="var(--ink)" strokeWidth="2" />
                  <text fontFamily="var(--font-mono)" fontSize="9" fontWeight="600" letterSpacing="1.6" fill="var(--ink)">
                    <textPath href="#ring">MARGIN FIRST ✺ ALWAYS ON ✺ </textPath>
                  </text>
                </svg>
                <span className="display relative text-3xl">£</span>
              </div>
              <div className="panel rotate-2 overflow-hidden bg-accent p-6">
                <img src="/haggly.png" alt="Haggly mascot" className="brief-logo mx-auto h-72 w-72 object-contain" />
              </div>
              <div className="panel absolute -bottom-8 -left-6 -rotate-3 bg-card px-4 py-3">
                <p className="kicker">Margin floor</p>
                <p className="display mt-1 text-2xl">Held ✓</p>
              </div>
            </div>
          </div>
        </section>

        <Ticker items={TICKER} />

        <section id="work" className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="display text-[clamp(2.75rem,6vw,5.5rem)] uppercase">
              The work
              <br />
              <span className="serif normal-case">after you connect.</span>
            </h2>
            <p className="kicker max-w-xs">(01) Six jobs Haggly takes off your plate, every time it runs.</p>
          </div>
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <li
                key={feature.title}
                className={`panel panel-lift flex min-h-56 flex-col justify-between p-6 ${feature.tone} ${
                  index % 2 ? "lg:translate-y-6" : ""
                }`}
              >
                <p className="kicker text-ink">/0{index + 1}</p>
                <div>
                  <h3 className="display text-3xl">{feature.title}</h3>
                  <p className="mt-3 text-[15px] leading-6 text-ink/75">{feature.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section id="steps" className="border-y-2 border-ink bg-card">
          <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <h2 className="display text-[clamp(2.75rem,6vw,5.5rem)] uppercase">
                Three steps.
                <br />
                <span className="serif normal-case">Then it keeps going.</span>
              </h2>
              <p className="kicker max-w-xs">(02) From domain to live studio in a couple of minutes.</p>
            </div>
            <ol className="mt-12 grid gap-0 border-2 border-ink md:grid-cols-3">
              {[
                ["Approve Shopify", "Enter the store domain. Shopify asks you to approve access to products, stock, and orders."],
                ["Import the catalog", "Haggly pulls products, prices, cost, inventory, and the last 30 days of sales."],
                ["Open the studio", "A product, a price that still earns, and ads ready to stage."],
              ].map(([title, body], index) => (
                <li
                  key={title}
                  className={`group p-7 transition-colors hover:bg-accent ${
                    index > 0 ? "border-t-2 border-ink md:border-t-0 md:border-l-2" : ""
                  }`}
                >
                  <p className="display text-7xl text-transparent [-webkit-text-stroke:2px_var(--ink)] group-hover:text-ink">
                    0{index + 1}
                  </p>
                  <h3 className="display mt-6 text-2xl">{title}</h3>
                  <p className="mt-2 text-[15px] leading-6 text-muted group-hover:text-ink">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="relative overflow-hidden bg-ink text-card">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="kicker text-accent">(03) Ready when you are</p>
              <h2 className="display mt-4 text-[clamp(3rem,7vw,6.5rem)] uppercase">
                Connect.
                <br />
                <span className="text-accent">Let it earn.</span>
              </h2>
              <p className="mt-6 max-w-md text-lg leading-8 text-card/70">
                Haggly only promotes what clears your rules. Stock, margin, and the market price stay in the decision, every
                time it runs.
              </p>
              <img src="/haggly.png" alt="" className="brief-logo mt-8 h-24 w-24 rounded-full border-2 border-card bg-accent object-contain p-1" />
            </div>
            <ConnectCard id="connect" ready={ready} error={error} />
          </div>
          <p className="display pointer-events-none -mb-[0.2em] text-center text-[22vw] text-card/[0.06] select-none" aria-hidden="true">
            HAGGLY
          </p>
        </section>
      </main>
    </div>
  );
}

function Ticker({ items }: { items: string[] }) {
  const row = [...items, ...items];
  return (
    <div className="-rotate-1 border-y-2 border-ink bg-ink py-4 text-accent" aria-hidden="true">
      <div className="marquee">
        {[row, row].map((group, groupIndex) => (
          <div key={groupIndex} className="flex shrink-0 items-center">
            {group.map((item, index) => (
              <span key={`${item}-${index}`} className="display flex items-center text-3xl uppercase sm:text-4xl">
                <span className="px-6">{item}</span>
                <span className="text-hot">✺</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectCard({
  id,
  ready,
  error,
}: {
  id: string;
  ready: boolean;
  error: string | null;
}) {
  return (
    <form
      id={id}
      action="/api/shopify/auth"
      className="relative flex flex-col gap-3 rounded-[1.5rem] border-2 border-ink bg-card p-7 text-ink shadow-[8px_8px_0_var(--accent)] sm:p-8"
    >
      <span className="sticker absolute -top-4 right-6 rotate-3 bg-hot px-3 py-1 text-[11px]">Step 01</span>
      <p className="kicker text-ink">Shopify</p>
      <h2 className="display text-4xl">Connect your store</h2>
      <p className="text-[15px] leading-6 text-muted">
        Use the store’s myshopify.com domain. You’ll approve access, then Haggly imports the catalog.
      </p>
      <label className="kicker mt-3 text-ink" htmlFor={`${id}-shop`}>
        Store domain
      </label>
      <input
        id={`${id}-shop`}
        name="shop"
        className="studio-input text-base"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        required
      />
      {error ? <p className="rounded-lg border-2 border-ink bg-hot/20 px-3 py-2 text-sm font-medium">{error}</p> : null}
      <button type="submit" className="studio-btn studio-btn-primary mt-2 w-full py-3 text-base" disabled={!ready}>
        Connect Shopify →
      </button>
      {ready ? null : <p className="text-xs text-muted">Connect opens once the Shopify app is configured.</p>}
    </form>
  );
}
