import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Cpu, Coins, Loader2, ArrowLeft, Zap, Check } from "lucide-react";
import { toast } from "sonner";
import { TOKEN_PACKS } from "@/lib/engines";
import { getAccountOverview, purchasePack } from "@/lib/engines.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/tokens")({
  head: () => ({
    meta: [
      { title: "Buy Tokens — EngineCore" },
      { name: "description", content: "Fuel up: buy token packs to fire any EngineCore engine." },
      { property: "og:title", content: "Buy Tokens — EngineCore" },
      { property: "og:description", content: "Fuel up: buy token packs to fire any EngineCore engine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TokensPage,
});

function TokensPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const fetchOverview = useServerFn(getAccountOverview);
  const purchase = useServerFn(purchasePack);
  const [busyPack, setBusyPack] = useState<string | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["overview"],
    queryFn: () => fetchOverview(),
    enabled: !!session,
  });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  async function handleBuy(packId: string) {
    setBusyPack(packId);
    try {
      const res = await purchase({ data: { packId } });
      toast.success(`${res.tokens.toLocaleString()} tokens added to your balance.`);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setBusyPack(null);
    }
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Cpu className="h-8 w-8 animate-pulse text-neon" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-grid">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Console
          </Link>
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-neon" />
            <span className="font-display font-bold">Fuel Depot</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-neon/40 bg-neon/10 px-3 py-1.5 text-sm font-bold text-neon">
            <Coins className="h-4 w-4" />
            {(data?.balance ?? 0).toLocaleString()}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="font-display text-center text-4xl font-bold tracking-tight">
          Fuel up
        </h1>
        <p className="mx-auto mt-3 max-w-md text-center text-muted-foreground">
          Tokens never expire and work across every engine. Choose your charge.
        </p>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TOKEN_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={`flex flex-col rounded-2xl border p-6 text-center ${
                pack.featured
                  ? "border-neon/50 bg-neon/5 glow-primary"
                  : "border-border bg-card"
              }`}
            >
              {pack.featured && (
                <span className="mx-auto mb-3 inline-block rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
                  MOST POPULAR
                </span>
              )}
              <h3 className="font-display text-2xl font-bold">{pack.name}</h3>
              <p className="font-display mt-2 text-4xl font-bold text-neon">
                {pack.tokens.toLocaleString()}
              </p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                tokens
              </p>
              <p className="mt-4 text-2xl font-semibold">
                ${(pack.priceCents / 100).toFixed(0)}
              </p>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">
                {pack.tagline}
              </p>
              <button
                onClick={() => handleBuy(pack.id)}
                disabled={busyPack !== null}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.03] disabled:opacity-50 glow-primary"
              >
                {busyPack === pack.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Buy {pack.name}
              </button>
            </div>
          ))}
        </div>

        {data?.orders.length ? (
          <section className="panel-glass mt-12 rounded-2xl p-6">
            <h3 className="font-display mb-4 flex items-center gap-2 text-lg font-bold">
              <Check className="h-5 w-5 text-neon" /> Order history
            </h3>
            <ul className="space-y-2">
              {data.orders.map((order) => (
                <li
                  key={order.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  <span>
                    {order.pack_id} · {order.tokens.toLocaleString()} tokens
                  </span>
                  <span className="text-muted-foreground">
                    ${(order.amount_cents / 100).toFixed(2)} · {order.status} ·{" "}
                    {new Date(order.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
