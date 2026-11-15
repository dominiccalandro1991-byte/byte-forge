import { useState } from "react";
import { diffLines } from "diff";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import type { EngineResult } from "@/lib/engine-compute";
import { Input } from "@/components/ui/input";

function Tree({
  value,
  label = "root",
  depth = 0,
}: {
  value: unknown;
  label?: string;
  depth?: number;
}) {
  if (!value || typeof value !== "object")
    return (
      <div className="break-words font-mono text-xs">
        <span className="text-muted-foreground">{label}: </span>
        {JSON.stringify(value)}
      </div>
    );
  return (
    <details open={depth < 1} className="border-l border-border pl-3">
      <summary className="cursor-pointer py-1 font-mono text-xs text-neon">
        {label} ·{" "}
        {Array.isArray(value) ? `${value.length} items` : `${Object.keys(value).length} fields`}
      </summary>
      <div className="space-y-1">
        {Object.entries(value).map(([k, v]) => (
          <Tree key={k} label={k} value={v} depth={depth + 1} />
        ))}
      </div>
    </details>
  );
}

export function ResultView({
  result,
  engineId,
  input,
}: {
  result: EngineResult;
  engineId: string;
  input: string;
}) {
  const [filter, setFilter] = useState("");
  const output = result.output;
  const text =
    output && typeof output === "object" && "text" in output && typeof output.text === "string"
      ? output.text
      : null;
  const indexed = engineId === "heuristic-indexer";
  const series = result.series;
  return (
    <div className="min-w-0 space-y-4">
      <p
        role="status"
        className={`border-l-2 pl-3 text-sm ${result.status === "fail" ? "border-destructive text-destructive" : "border-neon text-neon"}`}
      >
        {result.summary}
      </p>
      {series && (
        <div
          className="h-64 w-full min-w-0"
          aria-label={`${series.label} chart, ${series.flagged.length} flagged points`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series.values.map((value, index) => ({ value, index }))}>
              <CartesianGrid stroke="var(--border)" />
              <XAxis dataKey="index" stroke="var(--muted-foreground)" />
              <YAxis stroke="var(--muted-foreground)" />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
              <Line
                type="linear"
                dataKey="value"
                stroke="var(--neon)"
                dot={false}
                isAnimationActive={false}
              />
              {series.flagged.map((index) => {
                const value = series.values[index];
                return value === undefined ? null : (
                  <ReferenceDot
                    key={index}
                    x={index}
                    y={value}
                    r={4}
                    fill="var(--destructive)"
                    stroke="var(--destructive)"
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {engineId === "refactoring-engine" && text ? (
        <div className="overflow-x-auto border border-border font-mono text-xs">
          {diffLines(input, text).map((part, i) => (
            <pre
              key={i}
              className={`min-w-fit p-2 ${part.added ? "bg-neon/10 text-neon" : part.removed ? "bg-destructive/10 text-destructive" : "text-muted-foreground"}`}
            >
              {part.value}
            </pre>
          ))}
        </div>
      ) : text ? (
        <pre className="overflow-x-auto border border-border p-3 font-mono text-xs">{text}</pre>
      ) : (
        <>
          {indexed && (
            <Input
              aria-label="Filter index"
              placeholder="Filter index…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          )}
          {indexed && output && typeof output === "object" ? (
            <Tree
              value={Object.fromEntries(
                Object.entries(output).map(([k, v]) => [
                  k,
                  Array.isArray(v)
                    ? v.filter((row) =>
                        JSON.stringify(row).toLowerCase().includes(filter.toLowerCase()),
                      )
                    : v,
                ]),
              )}
            />
          ) : (
            <Tree value={output} />
          )}
        </>
      )}
    </div>
  );
}
