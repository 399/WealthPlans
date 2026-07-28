import type { EnvironmentSyncAction } from "../../shared/schemas/environmentSync";
import type { DailyValue } from "../../shared/schemas/financialData";
import { listAllValues, listInstrumentSymbols, storeValues } from "../db/database";
import type { Env } from "../env";

const maximumTransferRecords = 500;
const maximumManifestRecords = 5000;

export type ManifestEntry = {
  key: string;
  hash: string;
  symbol: string;
  date: string;
  valueType: DailyValue["valueType"];
  source: string;
  primaryValue: string | null;
  changePercent: string | null;
  fetchedAt: string;
};

export type RecordConflict = {
  key: string;
  local: ManifestEntry;
  remote: ManifestEntry;
};

export type EnvironmentComparison = {
  planHash: string;
  generatedAt: string;
  localCount: number;
  remoteCount: number;
  matchingCount: number;
  onlyLocal: ManifestEntry[];
  onlyRemote: ManifestEntry[];
  conflicts: RecordConflict[];
};

export class EnvironmentSyncError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: 400 | 403 | 409 | 413 | 503,
  ) {
    super(message);
    this.name = "EnvironmentSyncError";
  }
}

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  return bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export function recordKey(value: DailyValue) {
  return JSON.stringify([value.source, value.symbol, value.valueType, value.date]);
}

function canonicalValue(value: DailyValue) {
  return JSON.stringify([
    value.source,
    value.symbol,
    value.valueType,
    value.date,
    value.open,
    value.high,
    value.low,
    value.close,
    value.unitNav,
    value.accumulatedNav,
    value.adjustedValue,
    value.changePercent,
    value.volume,
    value.turnover,
  ]);
}

export async function createManifest(values: DailyValue[]): Promise<ManifestEntry[]> {
  return Promise.all(
    values.map(async (value) => ({
      key: recordKey(value),
      hash: await sha256(canonicalValue(value)),
      symbol: value.symbol,
      date: value.date,
      valueType: value.valueType,
      source: value.source,
      primaryValue: value.unitNav ?? value.close,
      changePercent: value.changePercent,
      fetchedAt: value.fetchedAt,
    })),
  );
}

export async function compareRecordSets(
  localValues: DailyValue[],
  remoteValues: DailyValue[],
): Promise<EnvironmentComparison> {
  const [local, remote] = await Promise.all([
    createManifest(localValues),
    createManifest(remoteValues),
  ]);
  const localByKey = new Map(local.map((entry) => [entry.key, entry]));
  const remoteByKey = new Map(remote.map((entry) => [entry.key, entry]));
  const onlyLocal: ManifestEntry[] = [];
  const onlyRemote: ManifestEntry[] = [];
  const conflicts: RecordConflict[] = [];
  let matchingCount = 0;

  for (const entry of local) {
    const counterpart = remoteByKey.get(entry.key);
    if (!counterpart) {
      onlyLocal.push(entry);
    } else if (counterpart.hash === entry.hash) {
      matchingCount += 1;
    } else {
      conflicts.push({ key: entry.key, local: entry, remote: counterpart });
    }
  }
  for (const entry of remote) {
    if (!localByKey.has(entry.key)) onlyRemote.push(entry);
  }

  const state = JSON.stringify({
    local: local.map(({ key, hash }) => [key, hash]),
    remote: remote.map(({ key, hash }) => [key, hash]),
  });
  return {
    planHash: await sha256(state),
    generatedAt: new Date().toISOString(),
    localCount: local.length,
    remoteCount: remote.length,
    matchingCount,
    onlyLocal,
    onlyRemote,
    conflicts,
  };
}

async function readEnvironment(db: D1Database) {
  const values = await listAllValues(db, maximumManifestRecords + 1);
  if (values.length > maximumManifestRecords) {
    throw new EnvironmentSyncError(
      "MANIFEST_TOO_LARGE",
      `当前记录超过 ${maximumManifestRecords} 条，需要改用分页同步`,
      413,
    );
  }
  return values;
}

export async function compareEnvironments(env: Env) {
  if (env.APP_ENV !== "local") {
    throw new EnvironmentSyncError("LOCAL_ONLY", "环境同步只能从本地开发服务发起", 403);
  }
  if (!env.REMOTE_DB || !env.REMOTE_FILES) {
    throw new EnvironmentSyncError(
      "REMOTE_BINDING_UNAVAILABLE",
      "没有连接 preview D1/R2，请检查 Cloudflare 登录和 remote bindings",
      503,
    );
  }
  const [localValues, remoteValues] = await Promise.all([
    readEnvironment(env.DB),
    readEnvironment(env.REMOTE_DB),
  ]);
  return compareRecordSets(localValues, remoteValues);
}

function actionRecords(
  action: EnvironmentSyncAction,
  comparison: EnvironmentComparison,
  localValues: DailyValue[],
  remoteValues: DailyValue[],
) {
  const localByKey = new Map(localValues.map((value) => [recordKey(value), value]));
  const remoteByKey = new Map(remoteValues.map((value) => [recordKey(value), value]));

  if (action === "push_missing") {
    return comparison.onlyLocal.flatMap((entry) => {
      const value = localByKey.get(entry.key);
      return value ? [value] : [];
    });
  }
  if (action === "pull_missing") {
    return comparison.onlyRemote.flatMap((entry) => {
      const value = remoteByKey.get(entry.key);
      return value ? [value] : [];
    });
  }
  if (action === "resolve_local") {
    return comparison.conflicts.flatMap((entry) => {
      const value = localByKey.get(entry.key);
      return value ? [value] : [];
    });
  }
  return comparison.conflicts.flatMap((entry) => {
    const value = remoteByKey.get(entry.key);
    return value ? [value] : [];
  });
}

async function archiveTransfer(
  bucket: R2Bucket,
  action: EnvironmentSyncAction,
  planHash: string,
  values: DailyValue[],
) {
  const transferredAt = new Date().toISOString();
  const key = `environment-sync/${transferredAt.replaceAll(":", "-")}-${crypto.randomUUID()}.json`;
  await bucket.put(
    key,
    JSON.stringify({
      schemaVersion: "1.0",
      action,
      planHash,
      transferredAt,
      count: values.length,
      data: values,
    }),
    {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: { action, planHash, transferredAt },
    },
  );
  return key;
}

export async function executeEnvironmentSync(
  env: Env,
  request: { action: EnvironmentSyncAction; planHash: string; confirmed: true },
) {
  if (env.APP_ENV !== "local" || !env.REMOTE_DB || !env.REMOTE_FILES) {
    throw new EnvironmentSyncError(
      "LOCAL_ONLY",
      "环境同步只能从已连接 preview bindings 的本地服务发起",
      403,
    );
  }

  const [localValues, remoteValues] = await Promise.all([
    readEnvironment(env.DB),
    readEnvironment(env.REMOTE_DB),
  ]);
  const comparison = await compareRecordSets(localValues, remoteValues);
  if (comparison.planHash !== request.planHash) {
    throw new EnvironmentSyncError(
      "SYNC_PLAN_STALE",
      "本地或 Cloudflare 数据已变化，请重新检查后再确认",
      409,
    );
  }

  const values = actionRecords(request.action, comparison, localValues, remoteValues);
  if (values.length > maximumTransferRecords) {
    throw new EnvironmentSyncError(
      "TRANSFER_TOO_LARGE",
      `单次最多同步 ${maximumTransferRecords} 条，请缩小范围`,
      413,
    );
  }
  if (values.length === 0) {
    return {
      ok: true as const,
      action: request.action,
      transferred: 0,
      archiveKey: null,
      comparison,
    };
  }

  const pushToRemote = request.action === "push_missing" || request.action === "resolve_local";
  const targetDb = pushToRemote ? env.REMOTE_DB : env.DB;
  const targetFiles = pushToRemote ? env.REMOTE_FILES : env.FILES;
  const overwrite = request.action === "resolve_local" || request.action === "resolve_remote";
  const targetSymbols = new Set(await listInstrumentSymbols(targetDb));
  const missingSymbols = [...new Set(values.map((value) => value.symbol))].filter(
    (symbol) => !targetSymbols.has(symbol),
  );
  if (missingSymbols.length > 0) {
    throw new EnvironmentSyncError(
      "TARGET_INSTRUMENT_MISSING",
      `目标环境缺少标的定义：${missingSymbols.join("、")}；请先迁移标的 Schema`,
      409,
    );
  }
  const archiveKey = await archiveTransfer(targetFiles, request.action, request.planHash, values);
  const stored = await storeValues(targetDb, values, overwrite ? "overwrite" : "skip");
  const updatedComparison = await compareEnvironments(env);

  return {
    ok: true as const,
    action: request.action,
    transferred: values.length,
    archiveKey,
    stored,
    comparison: updatedComparison,
  };
}
