import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Coins,
  Download,
  Loader2,
  Play,
  Trash2,
  Upload,
  LockKeyhole,
} from "lucide-react";
import { toast } from "sonner";
import { ENGINE_MAP } from "@/lib/engines";
import { computeClient, type EngineResult } from "@/lib/engine-compute";
import { getEngineHistory, recordClientRun, runEngine } from "@/lib/engines.functions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ResultView } from "@/components/engines/result-view";

export const Route = createFileRoute("/engines/$engineId")({
  head: ({ params }) => {
    const engine = ENGINE_MAP.get(params.engineId);
    const title = `${engine?.name ?? "Engine"} — EngineCore`;
    const description = engine?.description ?? "Independent diagnostic workflows on EngineCore.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: () => {
    const { engineId } = Route.useParams();
    return <EnginePage key={engineId} engineId={engineId} />;
  },
});

function EnginePage({ engineId }: { engineId: string }) {
  const engine = ENGINE_MAP.get(engineId);
  const { session, loading } = useAuth();
  const run = useServerFn(runEngine);
  const save = useServerFn(recordClientRun);
  const history = useServerFn(getEngineHistory);
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [params, setParams] = useState<Record<string, string>>(() =>
    Object.fromEntries((engine?.params ?? []).map((p) => [p.key, String(p.default)])),
  );
  const [result, setResult] = useState<EngineResult | null>(null);
  const [resultInput, setResultInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const { data, isError } = useQuery({
    queryKey: ["engine-history", session?.user.id, engineId],
    queryFn: () => history({ data: { engineId } }),
    enabled: Boolean(session),
    retry: false,
  });
  if (!engine)
    return (
      <main className="p-6">
        <h1>Unknown engine</h1>
        <Button asChild variant="outline">
          <Link to="/dashboard">Console</Link>
        </Button>
      </main>
    );
  const activeEngine = engine;

  async function handleRun(e: React.FormEvent) {
    e.preventDefault();
    if (!session || busy || activeEngine.mode === "connection") return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const storedInput =
        activeEngine.id === "keyharbor" || activeEngine.id === "scopeshield"
          ? "[Sensitive input omitted]"
          : JSON.stringify({ text: input, params });
      if (activeEngine.mode === "client") {
        const output = await computeClient(activeEngine.id, input, params);
        await save({ data: { engineId: activeEngine.id, input: storedInput, result: output } });
        setResult(output);
      } else {
        const response = await run({ data: { engineId: activeEngine.id, prompt: input } });
        setResult(response.result as EngineResult);
      }
      setResultInput(input);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["engine-history"] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
      ]);
      toast.success("Run saved to your private history.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${engineId}-result.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard">
              <ArrowLeft />
              Console
            </Link>
          </Button>
          <span className="font-display font-semibold">EngineCore</span>
          <Button variant="outline" size="sm" asChild>
            <Link to="/tokens">
              <Coins />
              <span className="font-mono">{data?.balance ?? "—"}</span>
            </Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 border-b border-border pb-5">
          <p className="mb-2 font-mono text-xs text-neon">
            φ{String(engine.phi).padStart(2, "0")} / {engine.batch.toUpperCase()}
          </p>
          <h1 className="font-display text-3xl font-semibold break-words">{engine.name}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{engine.description}</p>
          <p className="mt-3 font-mono text-xs text-ember">{engine.tokenCost} tokens / run</p>
        </div>
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="min-w-0">
            <h2 className="mb-4 font-mono text-xs text-muted-foreground">INPUT / CONFIGURATION</h2>
            {engine.mode === "connection" ? (
              <div className="border-l-2 border-ember py-3 pl-4">
                <LockKeyhole className="mb-3 text-ember" />
                <p className="text-sm text-muted-foreground">{engine.connectionNote}</p>
                <p className="mt-3 font-mono text-xs text-ember">Unavailable · no tokens charged</p>
              </div>
            ) : (
              <form onSubmit={handleRun} className="space-y-4">
                {engine.acceptsFile && (
                  <div className="flex items-center gap-3">
                    <Input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      aria-label="Upload input file"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 100000) {
                          setError("File must be 100 KB or smaller.");
                          return;
                        }
                        setInput(await file.text());
                        setFilename(file.name);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload />
                      Upload
                    </Button>
                    <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                      {filename || "No file selected"}
                    </span>
                  </div>
                )}
                {engine.textInput && (
                  <div>
                    <label
                      htmlFor="engine-input"
                      className="mb-2 block text-xs text-muted-foreground"
                    >
                      {engine.id === "keyharbor" ? "API key" : "Source input"}
                    </label>
                    <Textarea
                      id="engine-input"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={engine.placeholder}
                      rows={10}
                      maxLength={100000}
                      className="font-mono text-sm"
                      required
                    />
                  </div>
                )}
                {engine.params && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {engine.params.map((p) => (
                      <div key={p.key}>
                        <label
                          htmlFor={`param-${p.key}`}
                          className="mb-1 block text-xs text-muted-foreground"
                        >
                          {p.label}
                        </label>
                        {p.options ? (
                          <Select
                            value={params[p.key] ?? String(p.default)}
                            onValueChange={(value) =>
                              setParams((prev) => ({ ...prev, [p.key]: value }))
                            }
                          >
                            <SelectTrigger id={`param-${p.key}`}>
                              <SelectValue>{params[p.key] ?? String(p.default)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {p.options.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id={`param-${p.key}`}
                            type={
                              p.key === "passphrase"
                                ? "password"
                                : typeof p.default === "number"
                                  ? "number"
                                  : "text"
                            }
                            step="any"
                            value={params[p.key] ?? ""}
                            required
                            onChange={(e) =>
                              setParams((prev) => ({ ...prev, [p.key]: e.target.value }))
                            }
                            className="font-mono"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {error && (
                  <p role="alert" className="break-words text-sm text-destructive">
                    {error === "INSUFFICIENT_TOKENS" ? "Not enough tokens for this run." : error}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {session ? (
                    <Button type="submit" disabled={busy || (engine.textInput && !input.trim())}>
                      {busy ? <Loader2 className="animate-spin" /> : <Play />}
                      {busy ? "Running…" : "Run engine"}
                    </Button>
                  ) : (
                    <Button asChild disabled={loading}>
                      <Link to="/auth">
                        <LockKeyhole />
                        Sign in to run
                      </Link>
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setInput("");
                      setFilename("");
                      setResult(null);
                      setError("");
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  >
                    <Trash2 />
                    {engine.id === "ingestion-core" ? "Flush buffer" : "Clear"}
                  </Button>
                </div>
              </form>
            )}
          </section>
          <section className="min-w-0 border-t border-border pt-5 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono text-xs text-muted-foreground">RESULT</h2>
              <Button
                size="icon"
                variant="ghost"
                title="Download result"
                aria-label="Download result"
                disabled={!result}
                onClick={download}
              >
                <Download />
              </Button>
            </div>
            {result ? (
              <ResultView result={result} engineId={engineId} input={resultInput} />
            ) : (
              <p className="py-8 font-mono text-xs text-muted-foreground">
                {busy ? "Computation in progress…" : "No result"}
              </p>
            )}
          </section>
        </div>
        <section className="mt-8 border-t border-border pt-5">
          <h2 className="mb-4 font-mono text-xs text-muted-foreground">PRIVATE RUN HISTORY</h2>
          {isError ? (
            <p className="text-sm text-destructive">History could not be loaded.</p>
          ) : data?.runs.length ? (
            <div className="grid gap-2">
              {data.runs.map((row) => (
                <Button
                  key={row.id}
                  variant="outline"
                  className="h-auto justify-between gap-4 py-3"
                  onClick={() => {
                    try {
                      setResult(JSON.parse(row.result ?? "null"));
                      try {
                        setResultInput(JSON.parse(row.prompt).text ?? row.prompt);
                      } catch {
                        setResultInput(row.prompt);
                      }
                    } catch {
                      setError("This saved result cannot be opened.");
                    }
                  }}
                >
                  <span className="truncate font-mono text-xs">
                    {new Date(row.created_at).toLocaleString()}
                  </span>
                  <span className="text-xs text-neon">Open result</span>
                </Button>
              ))}
            </div>
          ) : (
            <p className="font-mono text-xs text-muted-foreground">
              {session ? "No saved runs" : "Sign in to view your runs"}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
