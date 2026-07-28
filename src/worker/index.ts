import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { environmentSyncRequestSchema } from "../shared/schemas/environmentSync";
import {
  isoDateSchema,
  syncPreviewRequestSchema,
  syncRequestSchema,
} from "../shared/schemas/financialData";
import { countOverlaps, databaseInfo, listInstruments, listValues } from "./db/database";
import type { Env } from "./env";
import {
  compareEnvironments,
  EnvironmentSyncError,
  executeEnvironmentSync,
} from "./services/environmentSync";
import { DataSourceError } from "./services/ftshare";
import { SyncInProgressError, synchronize } from "./services/sync";

const app = new Hono<{ Bindings: Env }>();

const querySchema = z.object({ q: z.string().max(100).optional() });
const symbolSchema = z.object({ symbol: z.string().min(1).max(32) });
const agentDataQuerySchema = z
  .object({
    symbol: z.string().min(1).max(32),
    start_date: isoDateSchema.optional(),
    end_date: isoDateSchema.optional(),
    order: z.enum(["asc", "desc"]).default("asc"),
    limit: z.coerce.number().int().min(1).max(5000).default(500),
    format: z.enum(["json", "csv"]).default("json"),
  })
  .refine((value) => !value.start_date || !value.end_date || value.start_date <= value.end_date, {
    message: "start_date 不能晚于 end_date",
    path: ["end_date"],
  });

function toCsv(data: Awaited<ReturnType<typeof listValues>>) {
  const columns = [
    "date",
    "symbol",
    "valueType",
    "open",
    "high",
    "low",
    "close",
    "unitNav",
    "accumulatedNav",
    "adjustedValue",
    "changePercent",
    "volume",
    "turnover",
    "source",
    "fetchedAt",
  ] as const;
  const escapeCsv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    columns.join(","),
    ...data.map((row) => columns.map((column) => escapeCsv(row[column])).join(",")),
  ].join("\n");
}

function remoteSyncError(env: Env, authorization?: string) {
  if (env.APP_ENV === "local") return null;
  if (env.REMOTE_SYNC_ENABLED !== "true") {
    return {
      status: 403 as const,
      code: "REMOTE_SYNC_DISABLED",
      message: "远程环境当前为只读；请先配置同步令牌并启用远程同步",
    };
  }
  if (!env.SYNC_TOKEN) {
    return {
      status: 503 as const,
      code: "SYNC_AUTH_NOT_CONFIGURED",
      message: "远程同步尚未配置认证令牌",
    };
  }
  if (authorization !== `Bearer ${env.SYNC_TOKEN}`) {
    return {
      status: 401 as const,
      code: "SYNC_AUTH_REQUIRED",
      message: "远程同步需要有效的 Bearer Token",
    };
  }
  return null;
}

const routes = app
  .get("/api/v1/health", async (context) => {
    const [storage, bucket] = await Promise.all([
      databaseInfo(context.env.DB),
      context.env.FILES.list({ limit: 1 }),
    ]);
    return context.json({
      ok: true,
      environment: context.env.APP_ENV,
      runtime: "cloudflare-workers",
      storage: {
        ...storage,
        archive: "Cloudflare R2",
        sampledObjects: bucket.objects.length,
      },
      sync: {
        remoteEnabled:
          context.env.APP_ENV === "local" || context.env.REMOTE_SYNC_ENABLED === "true",
        authRequired: context.env.APP_ENV !== "local",
      },
      checkedAt: new Date().toISOString(),
    });
  })
  .get("/api/v1/instruments", zValidator("query", querySchema), async (context) => {
    const { q } = context.req.valid("query");
    return context.json({ data: await listInstruments(context.env.DB, q) });
  })
  .get("/api/v1/instruments/:symbol/data", zValidator("param", symbolSchema), async (context) =>
    context.json({
      data: await listValues(context.env.DB, context.req.valid("param").symbol),
    }),
  )
  .get("/api/v1/agent", async (context) => {
    const baseUrl = new URL("/api/v1/agent", context.req.url).toString();
    return context.json({
      schemaVersion: "1.1",
      service: "wealthplans-cloud-data",
      baseUrl,
      storage: await databaseInfo(context.env.DB),
      environment: context.env.APP_ENV,
      endpoints: {
        catalog: "GET /catalog?q=",
        data: "GET /data?symbol=&start_date=&end_date=&order=asc&limit=500&format=json",
        syncPreview: "POST /sync/preview",
        sync: "POST /sync",
        environmentCompare: "GET /environment/compare (local service only)",
        environmentTransfer: "POST /environment/transfer (local service only)",
      },
      documentation: "docs/runbooks/agent-data-access.md",
    });
  })
  .get("/api/v1/agent/catalog", zValidator("query", querySchema), async (context) => {
    const { q } = context.req.valid("query");
    const data = await listInstruments(context.env.DB, q);
    return context.json({ schemaVersion: "1.1", count: data.length, data });
  })
  .get("/api/v1/agent/data", zValidator("query", agentDataQuerySchema), async (context) => {
    const query = context.req.valid("query");
    const data = await listValues(context.env.DB, query.symbol, {
      startDate: query.start_date,
      endDate: query.end_date,
      limit: query.limit,
      order: query.order,
    });
    if (query.format === "csv") {
      return context.text(toCsv(data), 200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `inline; filename="${query.symbol}.csv"`,
      });
    }
    return context.json({
      schemaVersion: "1.1",
      query: {
        symbol: query.symbol,
        startDate: query.start_date ?? null,
        endDate: query.end_date ?? null,
        order: query.order,
        limit: query.limit,
      },
      count: data.length,
      data,
    });
  })
  .post("/api/v1/sync/preview", zValidator("json", syncPreviewRequestSchema), async (context) => {
    const request = context.req.valid("json");
    return context.json({
      overlaps: await countOverlaps(
        context.env.DB,
        request.symbols,
        request.startDate,
        request.endDate,
      ),
    });
  })
  .post("/api/v1/sync", zValidator("json", syncRequestSchema), async (context) => {
    const blocked = remoteSyncError(context.env, context.req.header("authorization"));
    if (blocked) {
      return context.json(
        { ok: false, error: { code: blocked.code, message: blocked.message } },
        blocked.status,
      );
    }
    return context.json(await synchronize(context.env, context.req.valid("json")));
  })
  .post(
    "/api/v1/agent/sync/preview",
    zValidator("json", syncPreviewRequestSchema),
    async (context) => {
      const request = context.req.valid("json");
      return context.json({
        schemaVersion: "1.1",
        overlaps: await countOverlaps(
          context.env.DB,
          request.symbols,
          request.startDate,
          request.endDate,
        ),
      });
    },
  )
  .post("/api/v1/agent/sync", zValidator("json", syncRequestSchema), async (context) => {
    const blocked = remoteSyncError(context.env, context.req.header("authorization"));
    if (blocked) {
      return context.json(
        {
          schemaVersion: "1.1",
          ok: false,
          error: { code: blocked.code, message: blocked.message },
        },
        blocked.status,
      );
    }
    return context.json({
      schemaVersion: "1.1",
      ...(await synchronize(context.env, context.req.valid("json"))),
    });
  })
  .get("/api/v1/environment-sync/compare", async (context) =>
    context.json({
      schemaVersion: "1.0",
      remoteEnvironment: "preview",
      comparison: await compareEnvironments(context.env),
    }),
  )
  .post(
    "/api/v1/environment-sync/transfer",
    zValidator("json", environmentSyncRequestSchema),
    async (context) =>
      context.json({
        schemaVersion: "1.0",
        ...(await executeEnvironmentSync(context.env, context.req.valid("json"))),
      }),
  )
  .get("/api/v1/agent/environment/compare", async (context) =>
    context.json({
      schemaVersion: "1.0",
      remoteEnvironment: "preview",
      comparison: await compareEnvironments(context.env),
    }),
  )
  .post(
    "/api/v1/agent/environment/transfer",
    zValidator("json", environmentSyncRequestSchema),
    async (context) =>
      context.json({
        schemaVersion: "1.0",
        ...(await executeEnvironmentSync(context.env, context.req.valid("json"))),
      }),
  );

app.onError((error, context) => {
  console.error(error);
  if (error instanceof EnvironmentSyncError) {
    return context.json(
      {
        ok: false,
        error: { code: error.code, message: error.message, retryable: error.status >= 500 },
      },
      error.status,
    );
  }
  if (error instanceof SyncInProgressError) {
    return context.json(
      {
        ok: false,
        error: { code: "SYNC_IN_PROGRESS", message: error.message, retryable: true },
      },
      409,
    );
  }
  if (error instanceof DataSourceError) {
    return context.json(
      {
        ok: false,
        error: { code: error.code, message: error.message, retryable: error.retryable },
      },
      503,
    );
  }
  return context.json(
    {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "服务暂时不可用",
        retryable: false,
      },
    },
    500,
  );
});

app.notFound((context) =>
  context.json({ ok: false, error: { code: "NOT_FOUND", message: "请求的 API 不存在" } }, 404),
);

export type AppType = typeof routes;
export default app;
