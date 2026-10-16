import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles,
  Filter,
  Code2,
  PenLine,
  BarChart3,
  Globe,
  Zap,
  ArrowRight,
  Cpu,
} from "lucide-react";
import { ENGINES, TOKEN_PACKS } from "@/lib/engines";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EngineCore — The AI Engine Marketplace" },
      {
        name: "description",
        content:
          "Six specialized AI engines. One token economy. Buy tokens, fire any engine, get results instantly.",
      },
      { property: "og:title", content: "EngineCore — The AI Engine Marketplace" },
      {
        property: "og:description",
        content:
          "Six specialized AI engines. One token economy. Buy tokens, fire any engine, get results instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const ICONS = {
  sparkles: Sparkles,
  filter: Filter,
  code: Code2,
  pen: PenLine,
  chart: BarChart3,
  globe: Globe,
} as const;

const ACCENT_CLASSES = {
  neon: "text-neon border-neon/30 hover:glow-primary",
  volt: "text-volt border-volt/30 hover:glow-volt",
  ember: "text-ember border-ember/30",
} as const;

function Landing() {
  return (
    <div className="min-h-screen bg-background bg-grid">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-6 w-6 text-neon" />
            <span className="font-display text-lg font-bold tracking-tight">
              EngineCore
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              to="/auth"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105 glow-primary"
            >
              Launch Console
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-6 pb-24 pt-24 text-center">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 0%, oklch(0.85 0.18 195 / 12%), transparent), radial-gradient(ellipse 40% 40% at 80% 60%, oklch(0.62 0.22 295 / 10%), transparent)",
          }}
        />
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-neon/30 bg-neon/5 px-4 py-1.5 text-xs font-medium text-neon">
          <Zap className="h-3.5 w-3.5" />
          Six engines. One token economy.
        </div>
        <h1 className="font-display mx-auto max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
          Fire any engine.{" "}
          <span className="text-neon text-glow">Pay per spark.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          A marketplace of specialized AI engines — each one tuned to do a
          single thing brilliantly. Buy tokens, spend them on exactly the
          engine you need, nothing else.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-bold text-primary-foreground transition-transform hover:scale-105 glow-primary"
          >
            Start firing <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#engines"
            className="rounded-xl border border-border px-8 py-4 text-base font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Meet the engines
          </a>
        </div>
      </section>

      {/* Engine grid */}
      <section id="engines" className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="font-display mb-2 text-center text-3xl font-bold tracking-tight">
          The Engine Room
        </h2>
        <p className="mb-12 text-center text-muted-foreground">
          Each engine is a specialist. Each run costs a fixed number of tokens.
        </p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ENGINES.map((engine) => {
            const Icon = ICONS[engine.icon as keyof typeof ICONS];
            return (
              <div
                key={engine.id}
                className={`group rounded-2xl border bg-card p-6 transition-all hover:-translate-y-1 ${ACCENT_CLASSES[engine.accent]}`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <Icon className="h-8 w-8" />
                  <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {engine.tokenCost}{" "}
                    {engine.tokenCost === 1 ? "token" : "tokens"}/run
                  </span>
                </div>
                <h3 className="font-display text-xl font-bold text-foreground">
                  {engine.name}
                </h3>
                <p className="mt-1 text-sm font-medium">{engine.tagline}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {engine.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Token packs */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="font-display mb-2 text-center text-3xl font-bold tracking-tight">
          Fuel Up
        </h2>
        <p className="mb-12 text-center text-muted-foreground">
          Tokens never expire. Spend them on any engine, any time.
        </p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TOKEN_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={`rounded-2xl border p-6 text-center ${
                pack.featured
                  ? "border-neon/50 bg-neon/5 glow-primary"
                  : "border-border bg-card"
              }`}
            >
              {pack.featured && (
                <span className="mb-3 inline-block rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
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
              <p className="mt-1 text-sm text-muted-foreground">
                {pack.tagline}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-10 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <Cpu className="h-4 w-4 text-neon" />
          <span className="font-display font-semibold">EngineCore</span>
        </div>
        <p className="mt-2">The AI engine marketplace. Fire responsibly.</p>
      </footer>
    </div>
  );
}
