// Engine catalog — client-safe.

export type EngineId = string;
export type EngineMode = "client" | "server" | "ai" | "connection";

export interface EngineParam {
  key: string;
  label: string;
  default: number | string;
  options?: string[];
}

export interface Engine {
  id: EngineId;
  phi: number;
  name: string;
  batch: string;
  tagline: string;
  description: string;
  tokenCost: number;
  icon: string;
  accent: "neon" | "volt" | "ember";
  placeholder: string;
  mode: EngineMode;
  acceptsFile?: boolean;
  textInput?: boolean;
  params?: EngineParam[];
  connectionNote?: string;
}

const B = ["Research", "Inventor", "Coder", "Deploy", "Reliability"];
const ICON = ["filter", "chart", "code", "globe", "sparkles"];
const ACC: Engine["accent"][] = ["neon", "volt", "ember", "volt", "neon"];

type Def = Omit<Engine, "batch" | "icon" | "accent" | "id" | "phi"> & { slug: string };

const DEFS: Def[] = [
  { slug: "ingestion-core", name: "Ingestion Core", tagline: "Parse and normalize CSV, JSON, logs.", description: "Upload CSV, JSON, NDJSON or log files. Records are parsed, fields detected and parse errors logged line by line.", tokenCost: 1, placeholder: "Paste CSV, JSON or log lines…", mode: "client", acceptsFile: true, textInput: true },
  { slug: "heuristic-indexer", name: "Heuristic Indexer", tagline: "Real key-value and token index.", description: "Extracts key-value pairs, token frequencies and metadata from your document; filter the real index.", tokenCost: 1, placeholder: "Paste a document to index…", mode: "client", acceptsFile: true, textInput: true },
  { slug: "prior-art-validator", name: "Prior-Art Validator", tagline: "SHA-256 against your stored baselines.", description: "Hashes the document bytes with SHA-256 and checks it against every baseline hash you have stored before.", tokenCost: 1, placeholder: "Paste or upload a document…", mode: "server", acceptsFile: true, textInput: true },
  { slug: "anomaly-detector", name: "Anomaly Detector", tagline: "Z-score and IQR outlier detection.", description: "Detects statistical outliers in your numeric series using z-score and IQR fences.", tokenCost: 1, placeholder: "Numbers separated by commas, spaces or new lines…", mode: "client", acceptsFile: true, textInput: true, params: [{ key: "z", label: "Z threshold", default: 3 }] },
  { slug: "aegis-router", name: "AEGIS Router", tagline: "Health score + quarantine repair.", description: "Scores health of a record batch (valid JSON/CSV rows). Below 0.85, repair quarantines the bad records and returns the clean set.", tokenCost: 2, placeholder: "One record per line (JSON objects or CSV rows)…", mode: "client", acceptsFile: true, textInput: true },
  { slug: "kinematic-load", name: "Kinematic Load Calculator", tagline: "Beam stress, torque, safety margin.", description: "Simply supported chassis beam: bending moment, stress, axle torque and safety factor from your loads and geometry.", tokenCost: 1, placeholder: "", mode: "client", params: [{ key: "loadA", label: "Load A (lb)", default: 400 }, { key: "loadB", label: "Load B (lb)", default: 350 }, { key: "span", label: "Span (in)", default: 48 }, { key: "sectionModulus", label: "Section modulus (in³)", default: 1.2 }, { key: "wheelRadius", label: "Wheel radius (in)", default: 8 }, { key: "yield", label: "Yield strength (psi)", default: 36000 }] },
  { slug: "terrain-coefficient", name: "Terrain Coefficient Analyzer", tagline: "Rolling resistance by surface.", description: "Rolling-resistance table per surface; computes resistive force, power draw and range impact versus concrete.", tokenCost: 1, placeholder: "", mode: "client", params: [{ key: "terrain", label: "Terrain", default: "gravel", options: ["concrete", "asphalt", "grass", "gravel", "sand"] }, { key: "massKg", label: "Mass (kg)", default: 250 }, { key: "speed", label: "Speed (m/s)", default: 2 }, { key: "baseRangeKm", label: "Range on concrete (km)", default: 20 }] },
  { slug: "torque-thermal", name: "Torque & Thermal Matrix", tagline: "Telemetry with thermal-limit alerts.", description: "Upload telemetry CSV (time,kw,temp). Charts real values and flags every thermal threshold crossing.", tokenCost: 1, placeholder: "time,kw,temp\n0,1.2,40\n1,1.8,52…", mode: "client", acceptsFile: true, textInput: true, params: [{ key: "limit", label: "Thermal limit (°C)", default: 80 }] },
  { slug: "structural-validator", name: "Structural Validator", tagline: "Load vs material limits.", description: "Rectangular tube cross-section under a center point load; stress and deflection versus material yield and required safety factor.", tokenCost: 1, placeholder: "", mode: "client", params: [{ key: "material", label: "Material", default: "steel-a36", options: ["steel-a36", "aluminum-6061", "oak"] }, { key: "loadN", label: "Load (N)", default: 3000 }, { key: "lengthM", label: "Length (m)", default: 1.2 }, { key: "widthMm", label: "Width (mm)", default: 40 }, { key: "heightMm", label: "Height (mm)", default: 60 }, { key: "wallMm", label: "Wall (mm)", default: 3 }, { key: "requiredSF", label: "Required SF", default: 2 }] },
  { slug: "market-indexer", name: "Market Indexer", tagline: "Your spec vs competitors.", description: "Paste a competitor table (name,price,capacity). Computes price and capacity deltas and value per dollar against your product.", tokenCost: 1, placeholder: "name,price,capacity\nAcme Hauler,899,400…", mode: "client", acceptsFile: true, textInput: true, params: [{ key: "price", label: "Your price", default: 799 }, { key: "capacity", label: "Your capacity", default: 450 }] },
  { slug: "codegen-orchestrator", name: "CodeGen Orchestrator", tagline: "AI code generation.", description: "Generates production code from your prompt with AI and saves it as an artifact.", tokenCost: 3, placeholder: "Describe the code you need…", mode: "ai", textInput: true },
  { slug: "ast-parser", name: "AST Parser", tagline: "Real JavaScript parse tree.", description: "Parses JavaScript (ES2023, modules) into a real ESTree AST you can expand node by node.", tokenCost: 1, placeholder: "Paste JavaScript…", mode: "client", acceptsFile: true, textInput: true },
  { slug: "syntax-logic-validator", name: "Syntax & Logic Validator", tagline: "Static analysis checklist.", description: "Syntax, bracket balance, unreachable code, loose equality, debugger and empty-catch checks on your code.", tokenCost: 1, placeholder: "Paste JavaScript…", mode: "client", acceptsFile: true, textInput: true },
  { slug: "refactoring-engine", name: "Autonomous Refactoring Engine", tagline: "AI refactor with computed diff.", description: "Refactors your code with AI and computes a real line diff between before and after.", tokenCost: 3, placeholder: "Paste code to refactor…", mode: "ai", acceptsFile: true, textInput: true },
  { slug: "test-harness", name: "Test Automation Harness", tagline: "Run assertions in a sandbox.", description: "Write code, then a line `// TESTS`, then one assertion expression per line. Executed in an isolated worker with timeout.", tokenCost: 2, placeholder: "function add(a,b){return a+b}\n// TESTS\nadd(1,2) === 3", mode: "client", textInput: true },
  { slug: "target-node-selector", name: "Target Node Selector", tagline: "Register and validate deploy targets.", description: "List targets as `name,url`. Each URL is validated and the selected target is recorded in your run history.", tokenCost: 1, placeholder: "production,https://example.com", mode: "client", textInput: true, params: [{ key: "select", label: "Selected target name", default: "production" }] },
  { slug: "edge-latency-matrix", name: "Edge Latency Matrix", tagline: "Measured HTTP latency.", description: "Probes each URL three times from the server and reports measured min/avg/max milliseconds and status.", tokenCost: 1, placeholder: "https://example.com\nhttps://cloudflare.com", mode: "server", textInput: true },
  { slug: "commit-orchestrator", name: "Commit Orchestrator", tagline: "GitHub commit history & sync.", description: "Reads commits and syncs branches through a connected GitHub account.", tokenCost: 2, placeholder: "", mode: "connection", connectionNote: "Requires a GitHub connection linked to this app. Not linked yet — no result is faked." },
  { slug: "viewport-attestation", name: "Mobile Viewport Attestation", tagline: "Real DOM measurement at width.", description: "Renders your HTML in a sandboxed frame at the selected width and measures overflow and element widths.", tokenCost: 1, placeholder: "<html>…</html>", mode: "client", textInput: true, acceptsFile: true, params: [{ key: "width", label: "Width (px)", default: 390 }] },
  { slug: "build-compiler", name: "Production Build Compiler", tagline: "Build and deploy.", description: "Triggers builds and deployments on a connected hosting target.", tokenCost: 3, placeholder: "", mode: "connection", connectionNote: "Requires deploy target credentials (e.g. Vercel token). Not connected — no deployment is simulated." },
  { slug: "causalrail", name: "CausalRail", tagline: "Dedup CI failures by SHA-256.", description: "Splits CI logs into failures, normalizes volatile values, hashes signatures with SHA-256 and counts frequencies.", tokenCost: 1, placeholder: "Paste CI/CD log output…", mode: "client", acceptsFile: true, textInput: true },
  { slug: "proofpatch", name: "ProofPatch", tagline: "Patch, test, PR.", description: "Applies patches on an ephemeral branch, runs tests and opens a PR.", tokenCost: 3, placeholder: "", mode: "connection", connectionNote: "Requires a GitHub connection and an isolated CI runner. Not connected — exit codes are never simulated." },
  { slug: "incidentdojo", name: "IncidentDojo", tagline: "Cosine similarity incident search.", description: "First block is the query; following blocks (separated by ---) are past incidents. Ranked by TF-IDF cosine similarity.", tokenCost: 1, placeholder: "DB timeout on checkout\n---\nIncident A…\n---\nIncident B…", mode: "client", textInput: true, acceptsFile: true },
  { slug: "scopeshield", name: "ScopeShield", tagline: ".env pre-flight validation.", description: "Validates every key in your .env with zod and regex rules: naming, URLs, ports, emails, secrets length, placeholders.", tokenCost: 1, placeholder: "DATABASE_URL=postgres://…\nPORT=8080", mode: "client", acceptsFile: true, textInput: true },
  { slug: "keyharbor", name: "KeyHarbor", tagline: "AES-256-GCM key sealing.", description: "Seals an API key with AES-256-GCM using a PBKDF2-derived key from your passphrase, entirely in your browser. Output is the ciphertext envelope.", tokenCost: 1, placeholder: "API key to seal…", mode: "client", textInput: true, params: [{ key: "passphrase", label: "Passphrase", default: "" }] },
];

export const ENGINES: Engine[] = DEFS.map(({ slug, ...d }, i) => {
  const b = Math.floor(i / 5);
  return { ...d, id: slug, phi: i + 1, batch: B[b] ?? "Reliability", icon: ICON[b] ?? "sparkles", accent: ACC[b] ?? "neon" };
});

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
  { id: "spark", name: "Spark", tokens: 100, priceCents: 500, tagline: "Dip a toe in the current." },
  { id: "surge", name: "Surge", tokens: 500, priceCents: 2000, tagline: "Our most popular charge.", featured: true },
  { id: "storm", name: "Storm", tokens: 2000, priceCents: 6000, tagline: "For serious operators." },
  { id: "supernova", name: "Supernova", tokens: 10000, priceCents: 20000, tagline: "Maximum capacity. Best value." },
];
