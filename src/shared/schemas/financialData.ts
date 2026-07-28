import { z } from "zod";

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日期必须使用 YYYY-MM-DD 格式");

export const supportedSyncSymbolSchema = z.enum(["000001.XSHG", "001316.OF"]);

const syncRangeSchema = z.object({
  symbols: z.array(supportedSyncSymbolSchema).min(1, "请至少选择一个标的"),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
});

const validDateRange = {
  message: "开始日期不能晚于结束日期",
  path: ["endDate"],
};

export const syncPreviewRequestSchema = syncRangeSchema.refine(
  (value) => value.startDate <= value.endDate,
  validDateRange,
);

export const syncRequestSchema = syncRangeSchema
  .extend({
    conflict: z.enum(["skip", "overwrite"]),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "开始日期不能晚于结束日期",
    path: ["endDate"],
  });

export type SyncRequest = z.infer<typeof syncRequestSchema>;

export type InstrumentSummary = {
  symbol: string;
  name: string;
  assetType: "fund" | "etf" | "index";
  assetTypeLabel: string;
  exchange: string | null;
  currency: string;
  recordCount: number;
  startDate: string | null;
  endDate: string | null;
  latestValue: string | null;
  latestChange: string | null;
  source: string | null;
  fetchedAt: string | null;
};

const nullableDecimalString = z.string().nullable();

export const dailyValueSchema = z.object({
  date: isoDateSchema,
  symbol: z.string().min(1).max(32),
  valueType: z.enum(["unit_nav", "market_price", "index_close"]),
  open: nullableDecimalString,
  high: nullableDecimalString,
  low: nullableDecimalString,
  close: nullableDecimalString,
  unitNav: nullableDecimalString,
  accumulatedNav: nullableDecimalString,
  adjustedValue: nullableDecimalString,
  changePercent: nullableDecimalString,
  volume: nullableDecimalString,
  turnover: nullableDecimalString,
  source: z.string().min(1).max(40),
  fetchedAt: z.iso.datetime(),
});

export type DailyValue = z.infer<typeof dailyValueSchema>;
