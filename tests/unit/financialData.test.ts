import { describe, expect, it } from "vitest";
import type { DailyValue } from "../../src/shared/schemas/financialData";
import { syncRequestSchema } from "../../src/shared/schemas/financialData";
import { buttonVariants } from "../../src/web/components/ui/button";
import app from "../../src/worker";
import { compareRecordSets } from "../../src/worker/services/environmentSync";

const sampleValue: DailyValue = {
  date: "2026-07-24",
  symbol: "001316.OF",
  valueType: "unit_nav",
  open: null,
  high: null,
  low: null,
  close: null,
  unitNav: "1.8108",
  accumulatedNav: "1.8658",
  adjustedValue: "1.896347",
  changePercent: "-0.31379",
  volume: null,
  turnover: null,
  source: "ftshare",
  fetchedAt: "2026-07-27T08:15:00.000Z",
};

describe("financial data service", () => {
  it("rejects reversed synchronization ranges", () => {
    const result = syncRequestSchema.safeParse({
      symbols: ["000001.XSHG"],
      startDate: "2026-07-27",
      endDate: "2026-07-20",
      conflict: "skip",
    });

    expect(result.success).toBe(false);
  });

  it("accepts explicit overwrite mode", () => {
    const result = syncRequestSchema.safeParse({
      symbols: ["001316.OF"],
      startDate: "2026-07-20",
      endDate: "2026-07-27",
      conflict: "overwrite",
    });

    expect(result.success).toBe(true);
  });

  it("rejects unsupported sync symbols before contacting an upstream service", async () => {
    const response = await app.request("/api/v1/agent/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        symbols: ["999999.UNKNOWN"],
        startDate: "2026-07-20",
        endDate: "2026-07-24",
        conflict: "skip",
      }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects incomplete agent data queries at the HTTP boundary", async () => {
    const response = await app.request("/api/v1/agent/data");
    expect(response.status).toBe(400);
  });

  it("returns a stable machine-readable 404", async () => {
    const response = await app.request("/api/v1/missing");
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("uses shadcn button variants backed by Tailwind utilities", () => {
    const classes = buttonVariants({ variant: "outline", size: "sm" });
    expect(classes).toContain("border-input");
    expect(classes).toContain("h-8");
  });

  it("does not treat fetched-at differences as financial data conflicts", async () => {
    const comparison = await compareRecordSets(
      [sampleValue],
      [{ ...sampleValue, fetchedAt: "2026-07-27T09:00:00.000Z" }],
    );

    expect(comparison.matchingCount).toBe(1);
    expect(comparison.conflicts).toHaveLength(0);
  });

  it("classifies changed financial values as explicit conflicts", async () => {
    const comparison = await compareRecordSets(
      [sampleValue],
      [{ ...sampleValue, unitNav: "1.9999" }],
    );

    expect(comparison.matchingCount).toBe(0);
    expect(comparison.conflicts).toHaveLength(1);
  });

  it("classifies missing records by synchronization direction", async () => {
    const remoteOnly = { ...sampleValue, date: "2026-07-25" };
    const comparison = await compareRecordSets([sampleValue], [remoteOnly]);

    expect(comparison.onlyLocal.map((entry) => entry.date)).toEqual(["2026-07-24"]);
    expect(comparison.onlyRemote.map((entry) => entry.date)).toEqual(["2026-07-25"]);
  });
});
