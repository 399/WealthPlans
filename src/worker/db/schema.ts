import { index, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const instruments = sqliteTable("instrument", {
  symbol: text().primaryKey(),
  name: text().notNull(),
  assetType: text("asset_type", { enum: ["fund", "etf", "index"] }).notNull(),
  exchange: text(),
  currency: text().notNull().default("CNY"),
  createdAt: text("created_at").notNull(),
});

export const dailyValues = sqliteTable(
  "daily_value",
  {
    symbol: text()
      .notNull()
      .references(() => instruments.symbol),
    valueType: text("value_type", {
      enum: ["unit_nav", "market_price", "index_close"],
    }).notNull(),
    date: text().notNull(),
    open: text(),
    high: text(),
    low: text(),
    close: text(),
    unitNav: text("unit_nav"),
    accumulatedNav: text("accumulated_nav"),
    adjustedValue: text("adjusted_value"),
    changePercent: text("change_percent"),
    volume: text(),
    turnover: text(),
    source: text().notNull(),
    fetchedAt: text("fetched_at").notNull(),
    rawJson: text("raw_json").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.source, table.symbol, table.valueType, table.date],
    }),
    index("daily_value_symbol_date").on(table.symbol, table.date),
  ],
);
