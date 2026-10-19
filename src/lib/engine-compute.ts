// Real client-side computations for each engine. Pure where possible.
import * as acorn from "acorn";

export interface EngineResult {
  status: "pass" | "fail" | "info";
  summary: string;
  output: unknown;
  series?: { values: number[]; flagged: number[]; label: string };
}

type P = Record<string, string>;
const n = (v: string | undefined, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const r = (x: number, d = 3) => Number(x.toFixed(d));

export async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const split = (l: string) => {
    const out: string[] = [];
    let cur = "", q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if (ch === "," && !q) { out.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const header = split(lines[0] ?? "");
  const rows: Record<string, string>[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((l, i) => {
    const cells = split(l);
    if (cells.length !== header.length) errors.push(`line ${i + 2}: expected ${header.length} fields, got ${cells.length}`);
    rows.push(Object.fromEntries(header.map((h, j) => [h, cells[j] ?? ""])));
  });
  return { header, rows, errors };
}

export function ingest(text: string): EngineResult {
  const log: string[] = [];
  const t = text.trim();
  let records: unknown[] = [];
  let format = "text";
  const errors: string[] = [];
  try {
    const j = JSON.parse(t);
    format = "json";
    records = Array.isArray(j) ? j : [j];
  } catch {
    const lines = t.split(/\r?\n/).filter(Boolean);
    const ndjson = lines.every((l) => l.trim().startsWith("{"));
    if (ndjson) {
      format = "ndjson";
      lines.forEach((l, i) => { try { records.push(JSON.parse(l)); } catch (e) { errors.push(`line ${i + 1}: ${(e as Error).message}`); } });
    } else if (lines.length > 1 && lines[0].includes(",")) {
      format = "csv";
      const c = parseCsv(t); records = c.rows; errors.push(...c.errors);
    } else {
      records = lines.map((l, i) => ({ line: i + 1, text: l }));
    }
  }
  const fields = new Set<string>();
  records.forEach((rec) => rec && typeof rec === "object" && Object.keys(rec).forEach((k) => fields.add(k)));
  log.push(`[detect] format=${format}`, `[parse] bytes=${new TextEncoder().encode(text).length} lines=${text.split(/\n/).length}`, `[parse] records=${records.length} errors=${errors.length}`, `[fields] ${[...fields].join(", ") || "none"}`, ...errors.map((e) => `[error] ${e}`));
  return { status: errors.length ? "fail" : "pass", summary: `${records.length} records parsed as ${format}, ${errors.length} errors`, output: { log, fields: [...fields], records } };
}

export function indexDoc(text: string): EngineResult {
  const kv: { key: string; value: string; line: number }[] = [];
  text.split(/\r?\n/).forEach((l, i) => {
    const m = l.match(/^\s*["']?([\w.\- ]{1,60}?)["']?\s*[:=]\s*(.+?)\s*,?$/);
    if (m) kv.push({ key: m[1].trim(), value: m[2].replace(/^["']|["']$/g, ""), line: i + 1 });
  });
  const freq: Record<string, number> = {};
  (text.toLowerCase().match(/[a-z0-9_]{3,}/g) ?? []).forEach((w) => (freq[w] = (freq[w] ?? 0) + 1));
  const tokens = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 100).map(([token, count]) => ({ token, count }));
  return { status: "info", summary: `${kv.length} key-value pairs, ${Object.keys(freq).length} unique tokens`, output: { metadata: { chars: text.length, lines: text.split(/\n/).length, uniqueTokens: Object.keys(freq).length }, keyValues: kv, tokens } };
}

function numbers(text: string) {
  return (text.match(/-?\d+(\.\d+)?(e-?\d+)?/gi) ?? []).map(Number);
}

export function anomaly(text: string, p: P): EngineResult {
  const v = numbers(text);
  if (v.length < 4) return { status: "fail", summary: "Need at least 4 numbers", output: {} };
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  const s = [...v].sort((a, b) => a - b);
  const q = (f: number) => { const i = (s.length - 1) * f, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
  const q1 = q(0.25), q3 = q(0.75), iqr = q3 - q1;
  const zt = n(p.z, 3);
  const flagged: number[] = [];
  const rows = v.map((x, i) => {
    const z = sd ? (x - mean) / sd : 0;
    const out = Math.abs(z) > zt || x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr;
    if (out) flagged.push(i);
    return { index: i, value: x, z: r(z), outlier: out };
  });
  return { status: flagged.length ? "fail" : "pass", summary: `${flagged.length} outliers in ${v.length} points (mean ${r(mean)}, σ ${r(sd)})`, output: { mean: r(mean), sd: r(sd), q1, q3, iqr, outliers: rows.filter((x) => x.outlier) }, series: { values: v, flagged, label: "value" } };
}

export function aegis(text: string): EngineResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const csv = !lines[0]?.trim().startsWith("{");
  const width = csv ? lines[0]?.split(",").length ?? 0 : 0;
  const good: string[] = [], bad: { line: number; reason: string }[] = [];
  lines.forEach((l, i) => {
    if (csv) { if (l.split(",").length === width && !l.split(",").some((c) => !c.trim())) good.push(l); else bad.push({ line: i + 1, reason: "field count/empty field" }); }
    else { try { const o = JSON.parse(l); if (o && typeof o === "object") good.push(l); else bad.push({ line: i + 1, reason: "not an object" }); } catch (e) { bad.push({ line: i + 1, reason: (e as Error).message }); } }
  });
  const health = lines.length ? good.length / lines.length : 0;
  const repair = health < 0.85;
  return { status: repair ? "fail" : "pass", summary: `Health ${r(health)}${repair ? " < 0.85 — repair executed: " + bad.length + " records quarantined" : " — healthy"}`, output: { health: r(health), total: lines.length, quarantined: repair ? bad : [], issues: bad, repairedRecords: repair ? good : undefined } };
}

export function kinematic(p: P): EngineResult {
  const a = n(p.loadA), b = n(p.loadB), L = n(p.span, 48), S = n(p.sectionModulus, 1.2), R = n(p.wheelRadius, 8), Y = n(p.yield, 36000);
  const W = a + b;
  const M = (W * L) / 4; // center point load, lb·in
  const stress = M / S;
  const sf = Y / stress;
  const torque = W * 0.015 * R; // rolling resistance coefficient 0.015 for pneumatic on pavement
  return { status: sf >= 2 ? "pass" : "fail", summary: `Stress ${r(stress, 0)} psi, safety factor ${r(sf, 2)}`, output: { totalLoadLb: W, bendingMomentLbIn: r(M, 1), stressPsi: r(stress, 1), safetyFactor: r(sf, 3), axleTorqueLbIn: r(torque, 2), formulas: ["M = W·L/4", "σ = M/S", "SF = σy/σ", "T = W·Crr·r (Crr=0.015)"] } };
}

const CRR: Record<string, number> = { concrete: 0.01, asphalt: 0.012, grass: 0.08, gravel: 0.02, sand: 0.3 };
export function terrain(p: P): EngineResult {
  const crr = CRR[p.terrain] ?? 0.02, m = n(p.massKg, 250), v = n(p.speed, 2), base = n(p.baseRangeKm, 20);
  const F = crr * m * 9.81, P = F * v;
  const mult = crr / CRR.concrete;
  return { status: "info", summary: `${p.terrain}: Crr ${crr}, ${r(F, 1)} N, range ${r(base / mult, 2)} km`, output: { table: CRR, crr, forceN: r(F, 2), powerW: r(P, 1), dragMultiplier: r(mult, 2), rangeKm: r(base / mult, 2), formulas: ["F = Crr·m·g", "P = F·v", "range = base·Crr_concrete/Crr"] } };
}

export function thermal(text: string, p: P): EngineResult {
  const { header, rows } = parseCsv(text);
  const tk = header.find((h) => /temp/i.test(h)) ?? header[2];
  const kk = header.find((h) => /kw|power/i.test(h)) ?? header[1];
  const temps = rows.map((x) => n(x[tk])), kws = rows.map((x) => n(x[kk]));
  const lim = n(p.limit, 80);
  const flagged = temps.map((t, i) => (t > lim ? i : -1)).filter((i) => i >= 0);
  const crossings = temps.filter((t, i) => i > 0 && temps[i - 1] <= lim && t > lim).length;
  return { status: flagged.length ? "fail" : "pass", summary: `${rows.length} samples, peak ${Math.max(...temps)}°C, ${crossings} limit crossings`, output: { samples: rows.length, maxTemp: Math.max(...temps), avgKw: r(kws.reduce((a, b) => a + b, 0) / (kws.length || 1)), peakKw: Math.max(...kws), crossings, overLimitIndexes: flagged }, series: { values: temps, flagged, label: tk } };
}

const MAT: Record<string, { yieldMPa: number; E_GPa: number }> = { "steel-a36": { yieldMPa: 250, E_GPa: 200 }, "aluminum-6061": { yieldMPa: 276, E_GPa: 68.9 }, oak: { yieldMPa: 50, E_GPa: 11 } };
export function structural(p: P): EngineResult {
  const m = MAT[p.material] ?? MAT["steel-a36"];
  const F = n(p.loadN), L = n(p.lengthM) * 1000, b = n(p.widthMm), h = n(p.heightMm), t = n(p.wallMm);
  const I = (b * h ** 3 - (b - 2 * t) * (h - 2 * t) ** 3) / 12; // mm^4
  const M = (F * L) / 4; // N·mm
  const sigma = (M * (h / 2)) / I; // MPa
  const defl = (F * L ** 3) / (48 * m.E_GPa * 1000 * I); // mm
  const sf = m.yieldMPa / sigma;
  return { status: sf >= n(p.requiredSF, 2) ? "pass" : "fail", summary: `σ ${r(sigma, 1)} MPa, SF ${r(sf, 2)}, deflection ${r(defl, 2)} mm`, output: { material: p.material, momentOfInertiaMm4: r(I, 0), maxMomentNmm: r(M, 0), stressMPa: r(sigma, 2), yieldMPa: m.yieldMPa, safetyFactor: r(sf, 3), deflectionMm: r(defl, 3), criticalPoint: "mid-span, extreme fibre" } };
}

export function market(text: string, p: P): EngineResult {
  const { rows } = parseCsv(text);
  const price = n(p.price), cap = n(p.capacity);
  const out = rows.map((x) => {
    const cp = n(x.price), cc = n(x.capacity);
    return { name: x.name, price: cp, capacity: cc, priceDelta: r(price - cp, 2), capacityDelta: r(cap - cc, 2), valuePerDollar: r(cc / cp, 4) };
  });
  const better = out.filter((o) => cap / price > o.valuePerDollar).length;
  return { status: "info", summary: `Your value/$ ${r(cap / price, 4)} beats ${better}/${out.length} competitors`, output: { yours: { price, capacity: cap, valuePerDollar: r(cap / price, 4) }, competitors: out } };
}

function trimAst(node: unknown, depth = 0): unknown {
  if (Array.isArray(node)) return node.map((c) => trimAst(c, depth));
  if (!node || typeof node !== "object") return node;
  if (depth > 40) return "…";
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) if (k !== "start" && k !== "end") o[k] = trimAst(v, depth + 1);
  return o;
}

export function ast(text: string): EngineResult {
  try {
    const tree = acorn.parse(text, { ecmaVersion: "latest", sourceType: "module", locations: false });
    let count = 0;
    JSON.stringify(tree, (_k, v) => { if (v && typeof v === "object" && "type" in v) count++; return v; });
    return { status: "pass", summary: `Parsed ${count} AST nodes`, output: trimAst(tree) };
  } catch (e) {
    return { status: "fail", summary: `Parse error: ${(e as Error).message}`, output: {} };
  }
}

export function validate(text: string): EngineResult {
  const checks: { check: string; pass: boolean; detail: string }[] = [];
  let tree: acorn.Node | null = null;
  try { tree = acorn.parse(text, { ecmaVersion: "latest", sourceType: "module", locations: true }); checks.push({ check: "Syntax", pass: true, detail: "parses" }); }
  catch (e) { checks.push({ check: "Syntax", pass: false, detail: (e as Error).message }); }
  const stack: string[] = []; let bal = true; const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  for (const ch of text.replace(/(["'`])(?:\\.|(?!\1).)*\1|\/\/.*|\/\*[\s\S]*?\*\//g, "")) {
    if ("([{".includes(ch)) stack.push(ch); else if (pairs[ch]) { if (stack.pop() !== pairs[ch]) bal = false; }
  }
  checks.push({ check: "Bracket balance", pass: bal && !stack.length, detail: bal && !stack.length ? "balanced" : `unbalanced (${stack.length} open)` });
  const issues: Record<string, string[]> = { unreachable: [], loose: [], debugger: [], emptyCatch: [], vars: [] };
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.type === "BlockStatement" || node.type === "Program") {
      const idx = node.body.findIndex((s: any) => ["ReturnStatement", "ThrowStatement", "BreakStatement", "ContinueStatement"].includes(s.type));
      if (idx >= 0 && idx < node.body.length - 1 && node.body[idx + 1].type !== "FunctionDeclaration") issues.unreachable.push(`line ${node.body[idx + 1].loc.start.line}`);
    }
    if (node.type === "BinaryExpression" && (node.operator === "==" || node.operator === "!=")) issues.loose.push(`line ${node.loc.start.line}`);
    if (node.type === "DebuggerStatement") issues.debugger.push(`line ${node.loc.start.line}`);
    if (node.type === "CatchClause" && node.body.body.length === 0) issues.emptyCatch.push(`line ${node.loc.start.line}`);
    if (node.type === "VariableDeclaration" && node.kind === "var") issues.vars.push(`line ${node.loc.start.line}`);
    for (const k in node) if (k !== "loc") walk(node[k]);
  };
  if (tree) walk(tree);
  const add = (check: string, arr: string[]) => checks.push({ check, pass: tree ? arr.length === 0 : false, detail: tree ? arr.join(", ") || "none" : "skipped: syntax error" });
  add("No unreachable code", issues.unreachable); add("Strict equality", issues.loose); add("No debugger", issues.debugger); add("No empty catch", issues.emptyCatch); add("No var declarations", issues.vars);
  const passed = checks.filter((c) => c.pass).length;
  return { status: passed === checks.length ? "pass" : "fail", summary: `${passed}/${checks.length} checks passed`, output: checks };
}

export function runTests(text: string): Promise<EngineResult> {
  const [code, tests = ""] = text.split(/^\s*\/\/\s*TESTS\s*$/m);
  const cases = tests.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("//"));
  const src = `onmessage=e=>{const{code,cases}=e.data;const res=[];const t0=performance.now();for(const c of cases){const s=performance.now();try{const ok=new Function(code+"\\nreturn ("+c+");")();res.push({test:c,pass:ok===true,detail:ok===true?"ok":"returned "+String(ok),ms:+(performance.now()-s).toFixed(2)})}catch(err){res.push({test:c,pass:false,detail:String(err),ms:+(performance.now()-s).toFixed(2)})}}postMessage({res,ms:+(performance.now()-t0).toFixed(2)})}`;
  return new Promise((resolve) => {
    if (!cases.length) return resolve({ status: "fail", summary: "No tests found after // TESTS", output: {} });
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
    const timer = setTimeout(() => { w.terminate(); resolve({ status: "fail", summary: "Timed out after 5s", output: {} }); }, 5000);
    w.onmessage = (e) => {
      clearTimeout(timer); w.terminate();
      const { res, ms } = e.data as { res: { pass: boolean }[]; ms: number };
      const p = res.filter((x) => x.pass).length;
      resolve({ status: p === res.length ? "pass" : "fail", summary: `${p} passed, ${res.length - p} failed in ${ms} ms`, output: { passed: p, failed: res.length - p, durationMs: ms, results: res } });
    };
  });
}

export function targets(text: string, p: P): EngineResult {
  const list = text.split(/\r?\n/).filter((l) => l.trim()).map((l) => {
    const [name, url] = l.split(",").map((s) => s.trim());
    let valid = false; try { valid = ["http:", "https:"].includes(new URL(url).protocol); } catch { /* invalid */ }
    return { name, url, valid };
  });
  const sel = list.find((t) => t.name === p.select);
  return { status: sel?.valid ? "pass" : "fail", summary: sel ? `Selected ${sel.name} → ${sel.url}${sel.valid ? "" : " (invalid URL)"}` : `Target "${p.select}" not in list`, output: { selected: sel ?? null, targets: list } };
}

export function viewport(html: string, p: P): Promise<EngineResult> {
  const width = n(p.width, 390);
  return new Promise((resolve) => {
    const f = document.createElement("iframe");
    f.setAttribute("sandbox", "allow-same-origin");
    f.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:800px;border:0`;
    f.srcdoc = html;
    f.onload = () => {
      const d = f.contentDocument!;
      const sw = d.documentElement.scrollWidth;
      const over = [...d.body.querySelectorAll("*")].map((el) => { const b = el.getBoundingClientRect(); return { tag: el.tagName.toLowerCase(), cls: (el as HTMLElement).className || "", right: Math.round(b.right), width: Math.round(b.width) }; }).filter((x) => x.right > width).slice(0, 50);
      const height = d.documentElement.scrollHeight;
      f.remove();
      resolve({ status: sw <= width && !over.length ? "pass" : "fail", summary: `At ${width}px: scrollWidth ${sw}px, ${over.length} overflowing elements, height ${height}px`, output: { width, scrollWidth: sw, height, overflowing: over } });
    };
    document.body.appendChild(f);
  });
}

export async function causal(text: string): Promise<EngineResult> {
  const blocks = text.split(/\n(?=.*(?:error|fail|exception|FAILED))/i).map((b) => b.trim()).filter((b) => /error|fail|exception/i.test(b));
  const map = new Map<string, { signature: string; count: number; sample: string }>();
  for (const b of blocks) {
    const first = b.split("\n")[0];
    const norm = first.replace(/0x[0-9a-f]+/gi, "<hex>").replace(/[0-9a-f]{7,40}/gi, "<sha>").replace(/\d+/g, "<n>").replace(/(\/[\w.-]+)+/g, "<path>").trim();
    const h = await sha256Hex(norm);
    const e = map.get(h) ?? { signature: norm, count: 0, sample: first };
    e.count++; map.set(h, e);
  }
  const out = [...map.entries()].map(([hash, v]) => ({ hash, ...v })).sort((a, b) => b.count - a.count);
  return { status: out.length ? "fail" : "pass", summary: `${blocks.length} failures → ${out.length} unique signatures`, output: out };
}

export function dojo(text: string): EngineResult {
  const [q, ...docs] = text.split(/^\s*---\s*$/m).map((s) => s.trim()).filter(Boolean);
  if (!q || !docs.length) return { status: "fail", summary: "Need a query and at least one incident separated by ---", output: {} };
  const tok = (s: string) => s.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];
  const all = [q, ...docs].map(tok);
  const df: Record<string, number> = {};
  all.forEach((t) => new Set(t).forEach((w) => (df[w] = (df[w] ?? 0) + 1)));
  const vec = (t: string[]) => { const v: Record<string, number> = {}; t.forEach((w) => (v[w] = (v[w] ?? 0) + 1)); for (const w in v) v[w] *= Math.log((all.length + 1) / (df[w] + 1)) + 1; return v; };
  const cos = (a: Record<string, number>, b: Record<string, number>) => { let d = 0, na = 0, nb = 0; for (const k in a) { na += a[k] ** 2; if (b[k]) d += a[k] * b[k]; } for (const k in b) nb += b[k] ** 2; return na && nb ? d / Math.sqrt(na * nb) : 0; };
  const qv = vec(all[0]);
  const ranked = docs.map((d, i) => { const s = cos(qv, vec(all[i + 1])); return { rank: 0, similarity: r(s, 4), cosineDistance: r(1 - s, 4), incident: d.slice(0, 300) }; }).sort((a, b) => b.similarity - a.similarity).map((x, i) => ({ ...x, rank: i + 1 }));
  return { status: "info", summary: `Top match similarity ${ranked[0].similarity}`, output: ranked };
}

export async function scope(text: string): Promise<EngineResult> {
  const { z } = await import("zod");
  const results: { key: string; pass: boolean; rule: string }[] = [];
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((raw, i) => {
    const l = raw.trim();
    if (!l || l.startsWith("#")) return;
    const m = l.match(/^(?:export\s+)?([^=]+)=(.*)$/);
    if (!m) return results.push({ key: `line ${i + 1}`, pass: false, rule: "not KEY=VALUE" });
    const key = m[1].trim(); const val = m[2].trim().replace(/^["']|["']$/g, "");
    const fail = (rule: string) => results.push({ key, pass: false, rule });
    if (seen.has(key)) fail("duplicate key"); seen.add(key);
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) fail("key must be UPPER_SNAKE_CASE");
    if (!val) fail("empty value");
    if (/changeme|your[_-]|xxx|todo|<.*>/i.test(val)) fail("placeholder value");
    if (/URL$|_URI$/.test(key) && !z.string().url().safeParse(val).success) fail("invalid URL");
    if (/PORT$/.test(key) && !z.coerce.number().int().min(1).max(65535).safeParse(val).success) fail("port must be 1-65535");
    if (/EMAIL/.test(key) && !z.string().email().safeParse(val).success) fail("invalid email");
    if (/SECRET|TOKEN|PASSWORD|_KEY$/.test(key) && val.length < 16) fail("secret shorter than 16 chars");
    if (/^(true|false)$/i.test(val) === false && /^(ENABLE|DISABLE|IS_|USE_)/.test(key)) fail("boolean flag must be true/false");
    if (!results.some((x) => x.key === key && !x.pass)) results.push({ key, pass: true, rule: "all rules" });
  });
  const failed = results.filter((x) => !x.pass);
  return { status: failed.length ? "fail" : "pass", summary: `${results.length - failed.length} pass, ${failed.length} violations`, output: results };
}

export async function seal(text: string, p: P): Promise<EngineResult> {
  if (!p.passphrase || p.passphrase.length < 8) return { status: "fail", summary: "Passphrase must be at least 8 characters", output: {} };
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await crypto.subtle.importKey("raw", enc.encode(p.passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text.trim())));
  const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
  return { status: "pass", summary: `Sealed ${text.trim().length} chars with AES-256-GCM`, output: { alg: "AES-256-GCM", kdf: "PBKDF2-SHA256", iterations: 310000, salt: b64(salt), iv: b64(iv), ciphertext: b64(ct), fingerprint: (await sha256Hex(text.trim())).slice(0, 16) } };
}

export async function computeClient(id: string, text: string, p: P): Promise<EngineResult> {
  switch (id) {
    case "ingestion-core": return ingest(text);
    case "heuristic-indexer": return indexDoc(text);
    case "anomaly-detector": return anomaly(text, p);
    case "aegis-router": return aegis(text);
    case "kinematic-load": return kinematic(p);
    case "terrain-coefficient": return terrain(p);
    case "torque-thermal": return thermal(text, p);
    case "structural-validator": return structural(p);
    case "market-indexer": return market(text, p);
    case "ast-parser": return ast(text);
    case "syntax-logic-validator": return validate(text);
    case "test-harness": return runTests(text);
    case "target-node-selector": return targets(text, p);
    case "viewport-attestation": return viewport(text, p);
    case "causalrail": return causal(text);
    case "incidentdojo": return dojo(text);
    case "scopeshield": return scope(text);
    case "keyharbor": return seal(text, p);
    default: throw new Error("No client computation for " + id);
  }
}
