import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  Filter,
  Code2,
  PenLine,
  BarChart3,
  Globe,
  Cpu,
  Zap,
  LogOut,
  Coins,
  History,
  ArrowRight,
} from "lucide-react";
import { ENGINES } from "@/lib/engines";
import { getAccountOverview } from "@/lib/engines.functions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Console — EngineCore" },
      { name: "description", content: "Your EngineCore console: token balance, engines, and run history." },
      { property: "og:title", content: "Console — EngineCore" },
      { property: "og:description", content: "Your EngineCore console: token balance, engines, and run history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const ICONS = {
  sparkles: Sparkles,
  filter: Filter,
  code: Code2,
  pen: PenLine,
  chart: BarChart3,
  globe: Globe,
} as const;

const ACCENT_TEXT = {
  neon: "text-neon",
  volt: "text-volt",
  ember: "text-ember",
} as const;

function Dashboard() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const fetchOverview = useServerFn(getAccountOverview);

  const { data, refetch } = useQuery({
    queryKey: ["overview"],
    queryFn: () => fetchOverview(),
    enabled: !!session,
  });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (session) refetch();
  }, [session, refetch]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Cpu className="h-8 w-8 animate-pulse text-neon" />
      </div>
    );
  }

  const balance = data?.balance ?? 0;

  return (
    <div className="min-h-screen bg-background bg-grid">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <Cpu className="h-6 w-6 text-neon" />
            <span className="font-display text-lg font-bold">EngineCore</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/tokens"
              className="flex items-center gap-2 rounded-lg border border-neon/40 bg-neon/10 px-4 py-2 text-sm font-bold text-neon transition-transform hover:scale-105"
            >
              <Coins className="h-4 w-4" />
              {balance.toLocaleString()} tokens
            </Link>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/" });
              }}
              className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Balance banner */}
        <div className="panel-glass mb-10 flex flex-wrap items-center justify-between gap-6 rounded-2xl p-8">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground">
              Token balance
            </p>
            <p className="font-display mt-1 text-5xl font-bold text-neon text-glow">
              {balance.toLocaleString()}
            </p>
          </div>
          <Link
            to="/tokens"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-105 glow-primary"
          >
            <Zap className="h-4 w-4" /> Buy tokens
          </Link>
        </div>

        {/* Engines */}
        <h2 className="font-display mb-6 text-2xl font-bold tracking-tight">
          Engine Room
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ENGINES.map((engine) => {
            const Icon = ICONS[engine.icon as keyof typeof ICONS];
            const affordable = balance >= engine.tokenCost;
            return (
              <Link
                key={engine.id}
                to="/engines/$engineId"
                params={{ engineId: engine.id }}
                className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-neon/40"
              >
                <div className="mb-4 flex items-center justify-between">
                  <Icon className={`h-8 w-8 ${ACCENT_TEXT[engine.accent]}`} />
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      affordable
                        ? "bg-neon/10 text-neon"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {engine.tokenCost}{" "}
                    {engine.tokenCost === 1 ? "token" : "tokens"}/run
                  </span>
                </div>
                <h3 className="font-display text-xl font-bold">
                  {engine.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {engine.tagline}
                </p>
                <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-neon opacity-0 transition-opacity group-hover:opacity-100">
                  Fire engine <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* History */}
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <section className="panel-glass rounded-2xl p-6">
            <h3 className="font-display mb-4 flex items-center gap-2 text-lg font-bold">
              <History className="h-5 w-5 text-volt" /> Recent runs
            </h3>
            {data?.runs.length ? (
              <ul className="space-y-3">
                {data.runs.map((run) => (
                  <li
                    key={run.id}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {ENGINES.find((e) => e.id === run.engine_id)?.name ??
                          run.engine_id}
                      </span>
                      <span>
                        {run.tokens_spent} tokens ·{" "}
                        {new Date(run.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {run.prompt}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No runs yet. Fire your first engine above.
              </p>
            )}
          </section>

          <section className="panel-glass rounded-2xl p-6">
            <h3 className="font-display mb-4 flex items-center gap-2 text-lg font-bold">
              <Coins className="h-5 w-5 text-ember" /> Token ledger
            </h3>
            {data?.transactions.length ? (
              <ul className="space-y-2">
                {data.transactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <span className="text-muted-foreground">
                      {tx.kind}
                      {tx.engine_id
                        ? ` · ${ENGINES.find((e) => e.id === tx.engine_id)?.name ?? tx.engine_id}`
                        : tx.note
                          ? ` · ${tx.note}`
                          : ""}
                    </span>
                    <span
                      className={`font-bold ${tx.amount > 0 ? "text-neon" : "text-destructive"}`}
                    >
                      {tx.amount > 0 ? "+" : ""}
                      {tx.amount}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No token activity yet.
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
