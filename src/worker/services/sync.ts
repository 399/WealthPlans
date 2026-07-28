import type { SyncRequest } from "../../shared/schemas/financialData";
import { storeValues } from "../db/database";
import type { Env } from "../env";
import { fetchFtshareValues } from "./ftshare";

let syncRunning = false;

export class SyncInProgressError extends Error {
  constructor() {
    super("已有同步任务正在执行，请稍后重试");
    this.name = "SyncInProgressError";
  }
}

async function archiveSync(env: Env, symbol: string, values: unknown[], syncedAt: string) {
  const safeTime = syncedAt.replaceAll(":", "-");
  const key = `financial-data/${symbol}/${safeTime}-${crypto.randomUUID()}.json`;
  await env.FILES.put(
    key,
    JSON.stringify({
      schemaVersion: "1.0",
      symbol,
      syncedAt,
      source: "ftshare",
      data: values,
    }),
    {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: { symbol, source: "ftshare", syncedAt },
    },
  );
  return key;
}

export async function synchronize(env: Env, request: SyncRequest) {
  if (syncRunning) throw new SyncInProgressError();

  syncRunning = true;
  try {
    const results = [];
    for (const symbol of request.symbols) {
      const values = await fetchFtshareValues(symbol, request.startDate, request.endDate);
      const syncedAt = new Date().toISOString();
      const archiveKey = await archiveSync(env, symbol, values, syncedAt);
      const stored = await storeValues(env.DB, values, request.conflict);
      results.push({ symbol, fetched: values.length, archiveKey, ...stored });
    }
    return {
      ok: true as const,
      results,
      syncedAt: new Date().toISOString(),
    };
  } finally {
    syncRunning = false;
  }
}
