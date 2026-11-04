import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Cpu, Coins, Loader2, ArrowLeft, Zap } from "lucide-react";
import { toast } from "sonner";
import { ENGINE_MAP, type EngineId } from "@/lib/engines";
import { runEngine } from "@/lib/engines.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/engines/$engineId")({
  head: ({ params }) => {
    const engine = ENGINE_MAP.get(params.engineId as EngineId);
    const title = engine ? `${engine.name} — EngineCore` : "Engine — EngineCore";
    const desc = engine?.description ?? "Run an AI engine on EngineCore.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: EnginePage,
});

function EnginePage() {
  const { engineId } = Route.useParams();
  const engine = ENGINE_MAP.get(engineId as EngineId);
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const run = useServerFn(runEngine);

  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (!engine) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Unknown engine.</p>
      </div>
    );
  }

  async function handleRun(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await run({ data: { engineId: engine!.id, prompt } });
      setResult(JSON.stringify((res as any).result.output, null, 2));
      setBalance((res as any).balance);
      toast.success(`${engine!.name} fired. ${engine!.tokenCost} tokens spent.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Engine run failed";
      if (msg.includes("INSUFFICIENT_TOKENS")) {
        toast.error("Not enough tokens. Fuel up first.");
        navigate({ to: "/tokens" });
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background bg-grid">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Console
          </Link>
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-neon" />
            <span className="font-display font-bold">{engine.name}</span>
          </div>
          <Link
            to="/tokens"
            className="flex items-center gap-2 rounded-lg border border-neon/40 bg-neon/10 px-3 py-1.5 text-sm font-bold text-neon"
          >
            <Coins className="h-4 w-4" />
            {balance === null ? "—" : balance.toLocaleString()}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold tracking-tight">
            {engine.name}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {engine.description}
          </p>
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-neon/10 px-3 py-1 text-xs font-bold text-neon">
            <Zap className="h-3 w-3" /> {engine.tokenCost}{" "}
            {engine.tokenCost === 1 ? "token" : "tokens"} per run
          </p>
        </div>

        <form onSubmit={handleRun} className="panel-glass rounded-2xl p-6">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={engine.placeholder}
            rows={6}
            className="w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={busy || !prompt.trim()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-bold text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-50 glow-primary"
          >
            {busy ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Firing…
              </>
            ) : (
              <>
                <Zap className="h-5 w-5" /> Fire {engine.name}
              </>
            )}
          </button>
        </form>

        {result !== null && (
          <div className="panel-glass mt-8 rounded-2xl p-6">
            <h2 className="font-display mb-4 text-lg font-bold text-neon">
              Output
            </h2>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {result}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
