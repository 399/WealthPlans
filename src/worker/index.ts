import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

const healthQuerySchema = z.object({
  deep: z.enum(["0", "1"]).optional(),
});

const app = new Hono<{ Bindings: Cloudflare.Env }>();

const routes = app.get(
  "/api/v1/health",
  zValidator("query", healthQuerySchema),
  async (context) => {
    const { deep } = context.req.valid("query");

    if (deep !== "1") {
      return context.json({
        ok: true,
        environment: context.env.APP_ENV,
        runtime: "cloudflare-workers",
        storage: null,
        checkedAt: new Date().toISOString(),
      });
    }

    const [database, bucket] = await Promise.all([
      context.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>(),
      context.env.FILES.list({ limit: 1 }),
    ]);

    return context.json({
      ok: database?.ok === 1,
      environment: context.env.APP_ENV,
      runtime: "cloudflare-workers",
      storage: {
        d1: database?.ok === 1 ? "ready" : "unavailable",
        r2: "ready",
        sampledObjects: bucket.objects.length,
      },
      checkedAt: new Date().toISOString(),
    });
  },
);

app.notFound((context) =>
  context.json(
    {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "The requested API route does not exist.",
      },
    },
    404,
  ),
);

export type AppType = typeof routes;
export default app;
