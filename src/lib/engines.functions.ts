import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ENGINE_MAP, TOKEN_PACKS } from "./engines";

const SYSTEM_PROMPTS: Record<string, string> = {
  oracle:
    "You are Oracle, a frontier conversational intelligence. Give sharp, honest, deeply-reasoned answers. Be direct, structured, and genuinely useful. No filler.",
  distill:
    "You are Distill, a summarization engine. Extract the signal from any document: key points, decisions, and action items. Use tight bullet structure. Never pad.",
  forge:
    "You are Forge, a code generation engine. Return clean, commented, production-grade code in the most appropriate language. Brief explanation first, then the code block.",
  wordsmith:
    "You are Wordsmith, a conversion copywriting engine. Write persuasive, vivid copy matched to the requested format and audience. Offer 2-3 variations when useful.",
  insight:
    "You are Insight, a data analysis engine. Find patterns, outliers, trends, and the story behind the numbers. Present findings clearly with concrete takeaways.",
  babel:
    "You are Babel, a localization engine. Translate with native fluency, preserving tone, idiom, and intent. If the target language is ambiguous, ask or pick the most likely and note it.",
};

const AI_GATEWAY_URL = "https://ai-gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-3-flash-preview";

export const getAccountOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [balanceRes, txRes, runsRes, ordersRes] = await Promise.all([
      supabase
        .from("token_balances")
        .select("balance")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("token_transactions")
        .select("id, amount, kind, engine_id, note, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("engine_runs")
        .select("id, engine_id, prompt, tokens_spent, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("orders")
        .select("id, pack_id, tokens, amount_cents, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    return {
      balance: balanceRes.data?.balance ?? 0,
      transactions: txRes.data ?? [],
      runs: runsRes.data ?? [],
      orders: ordersRes.data ?? [],
    };
  });

export const runEngine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        engineId: z.string(),
        prompt: z.string().min(1).max(20000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const engine = ENGINE_MAP.get(data.engineId as never);
    if (!engine) throw new Error("Unknown engine");

    // Atomically spend tokens — raises 'insufficient_tokens' when too low.
    const { data: newBalance, error: spendError } = await supabase.rpc(
      "spend_tokens",
      {
        _user_id: userId,
        _amount: engine.tokenCost,
        _engine_id: engine.id,
      },
    );
    if (spendError) {
      if (spendError.message.includes("insufficient_tokens")) {
        throw new Error("INSUFFICIENT_TOKENS");
      }
      throw new Error(spendError.message);
    }

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI gateway is not configured");

    let resultText: string;
    try {
      const response = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPTS[engine.id] },
            { role: "user", content: data.prompt },
          ],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`AI gateway failed [${response.status}]: ${errorBody}`);
        throw new Error(`AI request failed [${response.status}]`);
      }

      const json = await response.json();
      resultText =
        json.choices?.[0]?.message?.content ?? "The engine returned nothing.";
    } catch (err) {
      // Refund on failure so users never pay for a broken run.
      await supabase.rpc("grant_tokens", {
        _user_id: userId,
        _amount: engine.tokenCost,
        _kind: "refund",
        _note: `Refund: ${engine.name} run failed`,
      });
      throw err;
    }

    await supabase.from("engine_runs").insert({
      user_id: userId,
      engine_id: engine.id,
      prompt: data.prompt,
      result: resultText,
      tokens_spent: engine.tokenCost,
    });

    return { result: resultText, balance: newBalance as number };
  });

export const purchasePack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ packId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const pack = TOKEN_PACKS.find((p) => p.id === data.packId);
    if (!pack) throw new Error("Unknown token pack");

    const { error: orderError } = await supabase.from("orders").insert({
      user_id: userId,
      pack_id: pack.id,
      tokens: pack.tokens,
      amount_cents: pack.priceCents,
      status: "completed",
    });
    if (orderError) throw new Error(orderError.message);

    const { data: newBalance, error: grantError } = await supabase.rpc(
      "grant_tokens",
      {
        _user_id: userId,
        _amount: pack.tokens,
        _kind: "purchase",
        _note: `${pack.name} pack (${pack.tokens} tokens)`,
      },
    );
    if (grantError) throw new Error(grantError.message);

    return { balance: newBalance as number, tokens: pack.tokens };
  });
