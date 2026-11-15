import { describe, it, expect } from "vitest";
import { ENGINES } from "./engines";
import { computeClient, seal, aegis } from "./engine-compute";

const cases: Record<string, { text: string; params?: Record<string, string>; status: string }> = {
  "ingestion-core": { text: "name,value\na,10\nb,20", status: "pass" },
  "heuristic-indexer": { text: "name: engine\nengine engine", status: "info" },
  "anomaly-detector": { text: "10,10,10,10,10,10,100", status: "fail" },
  "aegis-router": { text: '{"a":1}\nbroken', status: "fail" },
  "kinematic-load": {
    text: "",
    params: {
      loadA: "400",
      loadB: "350",
      span: "48",
      sectionModulus: "1.2",
      wheelRadius: "8",
      yield: "36000",
    },
    status: "pass",
  },
  "terrain-coefficient": {
    text: "",
    params: { terrain: "gravel", massKg: "250", speed: "2", baseRangeKm: "20" },
    status: "info",
  },
  "torque-thermal": {
    text: "time,kw,temp\n0,1,40\n1,2,90",
    params: { limit: "80" },
    status: "fail",
  },
  "structural-validator": {
    text: "",
    params: {
      material: "steel-a36",
      loadN: "3000",
      lengthM: "1.2",
      widthMm: "40",
      heightMm: "60",
      wallMm: "3",
      requiredSF: "2",
    },
    status: "pass",
  },
  "market-indexer": {
    text: "name,price,capacity\nAcme,899,400",
    params: { price: "799", capacity: "450" },
    status: "info",
  },
  "ast-parser": { text: "const x = 1;", status: "pass" },
  "syntax-logic-validator": { text: "const x = 1;", status: "pass" },
  "target-node-selector": {
    text: "production,https://example.com",
    params: { select: "production" },
    status: "pass",
  },
  causalrail: { text: "Error: request 123 failed\nError: request 456 failed", status: "fail" },
  incidentdojo: {
    text: "DB timeout\n---\nDB timeout checkout\n---\nimage not found",
    status: "info",
  },
  scopeshield: { text: "PORT=8080\nENABLE_CACHE=true", status: "pass" },
  keyharbor: {
    text: "test-key-for-verification",
    params: { passphrase: "test-passphrase" },
    status: "pass",
  },
};
describe("standalone computations", () => {
  it("provides exactly 25 distinct engines", () => {
    expect(ENGINES).toHaveLength(25);
    expect(new Set(ENGINES.map((e) => e.id)).size).toBe(25);
  });
  for (const [id, sample] of Object.entries(cases))
    it(`computes ${id} from real input`, async () => {
      const result = await computeClient(id, sample.text, sample.params ?? {});
      expect(result.status).toBe(sample.status);
      expect(result.output).toBeDefined();
    });
  it("executes quarantine when health is below 0.85", () => {
    const result = aegis('{"a":1}\ninvalid');
    expect(result.output).toMatchObject({
      health: 0.5,
      quarantined: [{ line: 2 }],
      repairedRecords: ['{"a":1}'],
    });
  });
  it("does not execute quarantine at health 0.85", () => {
    const result = aegis(
      [
        ...Array.from({ length: 17 }, () => '{"a":1}'),
        ...Array.from({ length: 3 }, () => "invalid"),
      ].join("\n"),
    );
    expect(result.output).toMatchObject({ health: 0.85, quarantined: [] });
  });
  it("rejects passphrases shorter than eight characters", async () => {
    expect((await seal("key", { passphrase: "1234567" })).status).toBe("fail");
  });
  it("calculates load stress and safety factor", async () => {
    const sample = cases["kinematic-load"];
    if (!sample) throw new Error("missing case");
    expect((await computeClient("kinematic-load", "", sample.params ?? {})).output).toMatchObject({
      stressPsi: 7500,
      safetyFactor: 4.8,
    });
  });
});
