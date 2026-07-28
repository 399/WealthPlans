import type { DailyValue, InstrumentSummary } from "../../shared/schemas/financialData";

const assetTypeLabels = {
  fund: "公募基金",
  etf: "ETF",
  index: "指数",
} as const;

type SummaryRow = {
  symbol: string;
  name: string;
  asset_type: keyof typeof assetTypeLabels;
  exchange: string | null;
  currency: string;
  record_count: number;
  start_date: string | null;
  end_date: string | null;
  latest_value: string | null;
  latest_change: string | null;
  source: string | null;
  fetched_at: string | null;
};

type ValueRow = {
  date: string;
  symbol: string;
  value_type: DailyValue["valueType"];
  open: string | null;
  high: string | null;
  low: string | null;
  close: string | null;
  unit_nav: string | null;
  accumulated_nav: string | null;
  adjusted_value: string | null;
  change_percent: string | null;
  volume: string | null;
  turnover: string | null;
  source: string;
  fetched_at: string;
};

export type ValueQuery = {
  startDate?: string;
  endDate?: string;
  limit?: number;
  order?: "asc" | "desc";
};

function mapValue(row: ValueRow): DailyValue {
  return {
    date: row.date,
    symbol: row.symbol,
    valueType: row.value_type,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    unitNav: row.unit_nav,
    accumulatedNav: row.accumulated_nav,
    adjustedValue: row.adjusted_value,
    changePercent: row.change_percent,
    volume: row.volume,
    turnover: row.turnover,
    source: row.source,
    fetchedAt: row.fetched_at,
  };
}

export async function listInstruments(db: D1Database, query = ""): Promise<InstrumentSummary[]> {
  const pattern = `%${query.trim()}%`;
  const result = await db
    .prepare(`
      SELECT
        i.symbol,
        i.name,
        i.asset_type,
        i.exchange,
        i.currency,
        COUNT(d.date) AS record_count,
        MIN(d.date) AS start_date,
        MAX(d.date) AS end_date,
        (
          SELECT COALESCE(latest.unit_nav, latest.close)
          FROM daily_value latest
          WHERE latest.symbol = i.symbol
          ORDER BY latest.date DESC
          LIMIT 1
        ) AS latest_value,
        (
          SELECT latest.change_percent
          FROM daily_value latest
          WHERE latest.symbol = i.symbol
          ORDER BY latest.date DESC
          LIMIT 1
        ) AS latest_change,
        (
          SELECT latest.source
          FROM daily_value latest
          WHERE latest.symbol = i.symbol
          ORDER BY latest.date DESC
          LIMIT 1
        ) AS source,
        MAX(d.fetched_at) AS fetched_at
      FROM instrument i
      LEFT JOIN daily_value d ON d.symbol = i.symbol
      WHERE i.symbol LIKE ? OR i.name LIKE ? OR i.asset_type LIKE ?
      GROUP BY i.symbol
      ORDER BY i.asset_type, i.symbol
    `)
    .bind(pattern, pattern, pattern)
    .all<SummaryRow>();

  return result.results.map((row) => ({
    symbol: row.symbol,
    name: row.name,
    assetType: row.asset_type,
    assetTypeLabel: assetTypeLabels[row.asset_type],
    exchange: row.exchange,
    currency: row.currency,
    recordCount: Number(row.record_count),
    startDate: row.start_date,
    endDate: row.end_date,
    latestValue: row.latest_value,
    latestChange: row.latest_change,
    source: row.source,
    fetchedAt: row.fetched_at,
  }));
}

export async function listValues(
  db: D1Database,
  symbol: string,
  query: ValueQuery = {},
): Promise<DailyValue[]> {
  const direction = query.order === "asc" ? "ASC" : "DESC";
  const result = await db
    .prepare(`
      SELECT date, symbol, value_type, open, high, low, close, unit_nav,
        accumulated_nav, adjusted_value, change_percent, volume, turnover,
        source, fetched_at
      FROM daily_value
      WHERE symbol = ? AND date BETWEEN ? AND ?
      ORDER BY date ${direction}
      LIMIT ?
    `)
    .bind(
      symbol,
      query.startDate ?? "0000-01-01",
      query.endDate ?? "9999-12-31",
      query.limit ?? 500,
    )
    .all<ValueRow>();

  return result.results.map(mapValue);
}

export async function listAllValues(db: D1Database, limit = 5001): Promise<DailyValue[]> {
  const result = await db
    .prepare(`
      SELECT date, symbol, value_type, open, high, low, close, unit_nav,
        accumulated_nav, adjusted_value, change_percent, volume, turnover,
        source, fetched_at
      FROM daily_value
      ORDER BY source, symbol, value_type, date
      LIMIT ?
    `)
    .bind(limit)
    .all<ValueRow>();

  return result.results.map(mapValue);
}

export async function listInstrumentSymbols(db: D1Database) {
  const result = await db
    .prepare("SELECT symbol FROM instrument ORDER BY symbol")
    .all<{ symbol: string }>();
  return result.results.map((row) => row.symbol);
}

export async function countOverlaps(
  db: D1Database,
  symbols: string[],
  startDate: string,
  endDate: string,
) {
  const results = await db.batch<{ count: number }>(
    symbols.map((symbol) =>
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM daily_value WHERE symbol = ? AND date BETWEEN ? AND ?",
        )
        .bind(symbol, startDate, endDate),
    ),
  );
  return results.map((result, index) => ({
    symbol: symbols[index] ?? "",
    count: Number(result.results[0]?.count ?? 0),
  }));
}

function valueParams(value: DailyValue) {
  return [
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
    value.source,
    value.fetchedAt,
    JSON.stringify(value),
  ];
}

async function batchInChunks<T>(db: D1Database, statements: D1PreparedStatement[], size = 80) {
  const results: D1Result<T>[] = [];
  for (let index = 0; index < statements.length; index += size) {
    results.push(...(await db.batch<T>(statements.slice(index, index + size))));
  }
  return results;
}

export async function storeValues(
  db: D1Database,
  values: DailyValue[],
  conflict: "skip" | "overwrite",
) {
  if (values.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  const existing = await batchInChunks<{ found: number }>(
    db,
    values.map((value) =>
      db
        .prepare(`
          SELECT 1 AS found FROM daily_value
          WHERE source = ? AND symbol = ? AND value_type = ? AND date = ?
        `)
        .bind(value.source, value.symbol, value.valueType, value.date),
    ),
  );
  const existed = existing.map((result) => result.results.length > 0);
  const candidates = values.filter((_, index) => conflict === "overwrite" || !existed[index]);

  const insertSql =
    conflict === "overwrite"
      ? `
        INSERT INTO daily_value (
          symbol, value_type, date, open, high, low, close, unit_nav,
          accumulated_nav, adjusted_value, change_percent, volume, turnover,
          source, fetched_at, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source, symbol, value_type, date) DO UPDATE SET
          open = excluded.open,
          high = excluded.high,
          low = excluded.low,
          close = excluded.close,
          unit_nav = excluded.unit_nav,
          accumulated_nav = excluded.accumulated_nav,
          adjusted_value = excluded.adjusted_value,
          change_percent = excluded.change_percent,
          volume = excluded.volume,
          turnover = excluded.turnover,
          fetched_at = excluded.fetched_at,
          raw_json = excluded.raw_json
      `
      : `
        INSERT OR IGNORE INTO daily_value (
          symbol, value_type, date, open, high, low, close, unit_nav,
          accumulated_nav, adjusted_value, change_percent, volume, turnover,
          source, fetched_at, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

  await batchInChunks(
    db,
    candidates.map((value) => db.prepare(insertSql).bind(...valueParams(value))),
  );

  const updated = conflict === "overwrite" ? existed.filter(Boolean).length : 0;
  const skipped = conflict === "skip" ? existed.filter(Boolean).length : 0;
  return { inserted: candidates.length - updated, updated, skipped };
}

export async function databaseInfo(db: D1Database) {
  const row = await db
    .prepare("SELECT COUNT(*) AS count, MAX(fetched_at) AS fetched_at FROM daily_value")
    .first<{ count: number; fetched_at: string | null }>();
  return {
    engine: "Cloudflare D1",
    recordCount: Number(row?.count ?? 0),
    lastFetchedAt: row?.fetched_at ?? null,
  };
}
