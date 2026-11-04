import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ENGINE_MAP, TOKEN_PACKS } from "./engines";

const AI_PROMPTS: Record<string, string> = {
  "codegen-orchestrator":
    "You are CodeGen Orchestrator. Return production-grade, commented code for the request. One short explanation line, then a single fenced code block.",
  "refactoring-engine":
    "You are an autonomous refactoring engine. Refactor the user's code for clarity, safety and performance without changing behavior. Return ONLY the refactored code, no fences, no commentary.",
};

type Ctx = { supabase: any; userId: string };

async function spend(ctx: Ctx, engineId: string, cost: number) {
  const { data, error } = await ctx.supabase.rpc("spend_tokens", {
    _user_id: ctx.userId,
    _amount: cost,
    _engine_id: engineId,
  });
  if (error) {
    if (error.message.includes("insufficient_tokens")) throw new Error("INSUFFICIENT_TOKENS");
    throw new Error(error.message);
  }
  return data as number;
}

async function refund(ctx: Ctx, name: string, cost: number) {
  await ctx.supabase.rpc("grant_tokens", {
    _user_id: ctx.userId,
    _amount: cost,
    _kind: "refund",
    _note: `Refund: ${name} run failed`,
  });
}

async function record(ctx: Ctx, engineId: string, input: string, result: unknown, cost: number) {
  await ctx.supabase.from("engine_runs").insert({
    user_id: ctx.userId,
    engine_id: engineId,
    prompt: input.slice(0, 20000),
    result: JSON.stringify(result).slice(0, 200000),
    tokens_spent: cost,
  });
}

export const getAccountOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [balanceRes, txRes, runsRes, ordersRes] = await Promise.all([
      supabase.from("token_balances").select("balance").eq("user_id", userId).maybeSingle(),
      supabase.from("token_transactions").select("id, amount, kind, engine_id, note, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("engine_runs").select("id, engine_id, prompt, tokens_spent, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      supabase.from("orders").select("id, pack_id, tokens, amount_cents, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
    ]);
    return {
      balance: balanceRes.data?.balance ?? 0,
      transactions: txRes.data ?? [],
      runs: runsRes.data ?? [],
      orders: ordersRes.data ?? [],
    };
  });

export const getEngineHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ engineId: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const [runs, bal] = await Promise.all([
      context.supabase.from("engine_runs").select("id, prompt, result, created_at").eq("user_id", context.userId).eq("engine_id", data.engineId).order("created_at", { ascending: false }).limit(10),
      context.supabase.from("token_balances").select("balance").eq("user_id", context.userId).maybeSingle(),
    ]);
    return { runs: runs.data ?? [], balance: bal.data?.balance ?? 0 };
  });

/** Charge and save a run whose computation happened in the user's browser. */
export const recordClientRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ engineId: z.string(), input: z.string().max(200000), result: z.unknown() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const engine = ENGINE_MAP.get(data.engineId);
    if (!engine || engine.mode !== "client") throw new Error("Unknown engine");
    const balance = await spend(context, engine.id, engine.tokenCost);
    await record(context, engine.id, data.input, data.result, engine.tokenCost);
    return { balance };
  });

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Server / AI engines: computation runs here. */
export const runEngine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ engineId: z.string(), prompt: z.string().min(1).max(100000) }).parse(d))
  .handler(async ({ context, data }) => {
    const engine = ENGINE_MAP.get(data.engineId);
    if (!engine || (engine.mode !== "server" && engine.mode !== "ai")) throw new Error("Unknown engine");
    const balance = await spend(context, engine.id, engine.tokenCost);
    let result: { status: string; summary: string; output: any };
    try {
      if (engine.id === "prior-art-validator") {
        const hash = await sha256(data.prompt);
        const { data: prev } = await context.supabase.from("engine_runs").select("result, created_at").eq("user_id", context.userId).eq("engine_id", engine.id);
        const matches = (prev ?? []).filter((r: any) => {
          try { return JSON.parse(r.result).output.sha256 === hash; } catch { return false; }
        });
        result = {
          status: matches.length ? "fail" : "pass",
          summary: matches.length ? `Match: identical to ${matches.length} stored baseline(s).` : `No match among ${(prev ?? []).length} stored baselines. Stored as new baseline.`,
          output: { sha256: hash, bytes: new TextEncoder().encode(data.prompt).length, matchedAt: matches.map((m: any) => m.created_at) },
        };
      } else if (engine.id === "edge-latency-matrix") {
        const urls = data.prompt.split(/\s+/).filter(Boolean).slice(0, 10);
        const rows = [];
        for (const u of urls) {
          try { new URL(u); } catch { rows.push({ url: u, error: "invalid URL" }); continue; }
          const times: number[] = []; let status = 0;
          for (let i = 0; i < 3; i++) {
            const t = Date.now();
            try { const res = await fetch(u, { method: "GET", redirect: "follow" }); status = res.status; await res.body?.cancel(); } catch { status = -1; }
            times.push(Date.now() - t);
          }
          rows.push({ url: u, status, minMs: Math.min(...times), avgMs: Math.round(times.reduce((a, b) => a + b, 0) / 3), maxMs: Math.max(...times) });
        }
        result = { status: "info", summary: `Probed ${rows.length} URL(s), 3 requests each.`, output: rows };
      } else {
        const { generateResponse } = await import("@lovable.dev/ai-gateway");
        const res = await generateResponse({
          model: "openai/gpt-6-astra",
          instructions: AI_PROMPTS[engine.id] ?? null,
          input: data.prompt,
        });
        const text = ((res as any).output ?? [])
          .flatMap((o: any) => (o.type === "message" ? o.content : []))
          .filter((c: any) => c.type === "output_text")
          .map((c: any) => c.text)
          .join("");
        result = { status: "info", summary: "Generated by AI.", output: { text } };
      }
    } catch (err) {
      await refund(context, engine.name, engine.tokenCost);
      throw err;
    }
    await record(context, engine.id, data.prompt, result, engine.tokenCost);
    return { result: JSON.parse(JSON.stringify(result)) as { status: string; summary: string; output: Record<string, string> }, balance };
  });

export const purchasePack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ packId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const pack = TOKEN_PACKS.find((p) => p.id === data.packId);
    if (!pack) throw new Error("Unknown token pack");
    const { error: orderError } = await supabase.from("orders").insert({
      user_id: userId, pack_id: pack.id, tokens: pack.tokens, amount_cents: pack.priceCents, status: "completed",
    });
    if (orderError) throw new Error(orderError.message);
    const { data: newBalance, error: grantError } = await supabase.rpc("grant_tokens", {
      _user_id: userId, _amount: pack.tokens, _kind: "purchase", _note: `${pack.name} pack (${pack.tokens} tokens)`,
    });
    if (grantError) throw new Error(grantError.message);
    return { balance: newBalance as number, tokens: pack.tokens };
  });
