PRAGMA foreign_keys = ON;

CREATE TABLE instrument (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('fund', 'etf', 'index')),
  exchange TEXT,
  currency TEXT NOT NULL DEFAULT 'CNY',
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE daily_value (
  symbol TEXT NOT NULL REFERENCES instrument(symbol),
  value_type TEXT NOT NULL CHECK (value_type IN ('unit_nav', 'market_price', 'index_close')),
  date TEXT NOT NULL,
  open TEXT,
  high TEXT,
  low TEXT,
  close TEXT,
  unit_nav TEXT,
  accumulated_nav TEXT,
  adjusted_value TEXT,
  change_percent TEXT,
  volume TEXT,
  turnover TEXT,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  PRIMARY KEY (source, symbol, value_type, date)
) STRICT;

CREATE INDEX daily_value_symbol_date ON daily_value(symbol, date DESC);
