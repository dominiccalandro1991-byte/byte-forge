// Engine catalog — client-safe. The server resolves system prompts by id.

export type EngineId =
  | "oracle"
  | "distill"
  | "forge"
  | "wordsmith"
  | "insight"
  | "babel";

export interface Engine {
  id: EngineId;
  name: string;
  tagline: string;
  description: string;
  tokenCost: number;
  icon: string; // lucide icon name key used by the UI
  accent: "neon" | "volt" | "ember";
  placeholder: string;
}

export const ENGINES: Engine[] = [
  {
    id: "oracle",
    name: "Oracle",
    tagline: "Ask anything. Get brilliance.",
    description:
      "A frontier conversational intelligence tuned for sharp, honest, deeply-reasoned answers on any topic.",
    tokenCost: 1,
    icon: "sparkles",
    accent: "neon",
    placeholder: "Ask Oracle anything…",
  },
  {
    id: "distill",
    name: "Distill",
    tagline: "10,000 words → the 100 that matter.",
    description:
      "Paste any article, report, or transcript. Distill extracts the signal: key points, decisions, and action items.",
    tokenCost: 2,
    icon: "filter",
    accent: "volt",
    placeholder: "Paste a long document to summarize…",
  },
  {
    id: "forge",
    name: "Forge",
    tagline: "Production-grade code, on demand.",
    description:
      "Describe what you need — a function, a component, a script — and Forge returns clean, commented, working code.",
    tokenCost: 3,
    icon: "code",
    accent: "ember",
    placeholder: "Describe the code you want built…",
  },
  {
    id: "wordsmith",
    name: "Wordsmith",
    tagline: "Copy that converts.",
    description:
      "Headlines, ads, product descriptions, cold emails. Wordsmith writes persuasive copy in your brand's voice.",
    tokenCost: 2,
    icon: "pen",
    accent: "volt",
    placeholder: "Describe the product and the copy you need…",
  },
  {
    id: "insight",
    name: "Insight",
    tagline: "Your data, decoded.",
    description:
      "Paste raw data, metrics, or survey results. Insight finds the patterns, outliers, and the story behind the numbers.",
    tokenCost: 3,
    icon: "chart",
    accent: "neon",
    placeholder: "Paste data or describe the analysis you need…",
  },
  {
    id: "babel",
    name: "Babel",
    tagline: "Every language. Native fluency.",
    description:
      "Translation that preserves tone, idiom, and intent across 90+ languages — not word-swaps, real localization.",
    tokenCost: 1,
    icon: "globe",
    accent: "ember",
    placeholder: "Text to translate + target language…",
  },
];

export const ENGINE_MAP = new Map(ENGINES.map((e) => [e.id, e]));

export interface TokenPack {
  id: string;
  name: string;
  tokens: number;
  priceCents: number;
  tagline: string;
  featured?: boolean;
}

export const TOKEN_PACKS: TokenPack[] = [
  {
    id: "spark",
    name: "Spark",
    tokens: 100,
    priceCents: 500,
    tagline: "Dip a toe in the current.",
  },
  {
    id: "surge",
    name: "Surge",
    tokens: 500,
    priceCents: 2000,
    tagline: "Our most popular charge.",
    featured: true,
  },
  {
    id: "storm",
    name: "Storm",
    tokens: 2000,
    priceCents: 6000,
    tagline: "For serious operators.",
  },
  {
    id: "supernova",
    name: "Supernova",
    tokens: 10000,
    priceCents: 20000,
    tagline: "Maximum capacity. Best value.",
  },
];
