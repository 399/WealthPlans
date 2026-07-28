import type { DailyValue } from "../../shared/schemas/financialData";

const endpoint = "https://market.ft.tech/gateway/mcp";
const protocolVersion = "2025-03-26";

export class DataSourceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "DataSourceError";
  }
}

type JsonRpcResponse = {
  result?: {
    isError?: boolean;
    structuredContent?: {
      data?: unknown[];
      metadata?: { pagination?: { has_more?: boolean } };
    };
    content?: Array<{ type: string; text?: string }>;
  };
  error?: { message?: string };
};

function parseSseResponse(body: string): JsonRpcResponse {
  const response = body
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data: {"))
    .map((line) => JSON.parse(line.slice(6)) as JsonRpcResponse)
    .find((payload) => payload.result || payload.error);
  if (!response) {
    throw new DataSourceError("UPSTREAM_INVALID_RESPONSE", "FTShare 返回了无法识别的响应", true);
  }
  return response;
}

async function postMcp(body: object, sessionId?: string) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": protocolVersion,
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new DataSourceError(
      "UPSTREAM_UNAVAILABLE",
      `FTShare 请求失败（HTTP ${response.status}）`,
      response.status >= 500 || response.status === 429,
    );
  }
  return {
    data: parseSseResponse(await response.text()),
    sessionId: response.headers.get("mcp-session-id") ?? sessionId,
  };
}

async function withRetry<T>(task: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

async function createSession() {
  const response = await postMcp({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion,
      capabilities: {},
      clientInfo: { name: "wealthplans", version: "0.1.0" },
    },
  });
  if (!response.sessionId) {
    throw new DataSourceError("UPSTREAM_INVALID_RESPONSE", "FTShare 未返回会话 ID", true);
  }
  const initialized = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "Mcp-Session-Id": response.sessionId,
      "MCP-Protocol-Version": protocolVersion,
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });
  if (!initialized.ok) {
    throw new DataSourceError(
      "UPSTREAM_UNAVAILABLE",
      `FTShare 会话确认失败（HTTP ${initialized.status}）`,
      true,
    );
  }
  return response.sessionId;
}

async function callTool(sessionId: string, name: string, args: object) {
  const response = await postMcp(
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name, arguments: args },
    },
    sessionId,
  );
  if (response.data.error) {
    throw new DataSourceError(
      "UPSTREAM_UNAVAILABLE",
      response.data.error.message ?? "FTShare 工具调用失败",
      true,
    );
  }
  if (response.data.result?.isError) {
    const message = response.data.result.content?.find((item) => item.text)?.text;
    try {
      const parsed = JSON.parse(message ?? "") as {
        error?: { code?: string; message?: string; retryable?: boolean };
      };
      throw new DataSourceError(
        parsed.error?.code ?? "UPSTREAM_UNAVAILABLE",
        parsed.error?.message ?? "FTShare 数据源暂时不可用",
        parsed.error?.retryable ?? true,
      );
    } catch (error) {
      if (error instanceof DataSourceError) throw error;
      throw new DataSourceError("UPSTREAM_UNAVAILABLE", message ?? "FTShare 暂时不可用", true);
    }
  }
  return {
    data: response.data.result?.structuredContent?.data ?? [],
    hasMore: response.data.result?.structuredContent?.metadata?.pagination?.has_more === true,
  };
}

function compactDate(date: string) {
  return Number(date.replaceAll("-", ""));
}

function shanghaiDay(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function startOfShanghaiDay(date: string) {
  return Date.parse(`${date}T16:00:00.000Z`) - 86_400_000;
}

function endOfShanghaiDay(date: string) {
  return Date.parse(`${date}T15:59:59.999Z`);
}

function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function splitDateRange(startDate: string, endDate: string) {
  const ranges: Array<{ startDate: string; endDate: string }> = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    const chunkEnd = addDays(cursor, 364);
    const boundedEnd = chunkEnd < endDate ? chunkEnd : endDate;
    ranges.push({ startDate: cursor, endDate: boundedEnd });
    cursor = addDays(boundedEnd, 1);
  }
  return ranges;
}

export async function fetchFtshareValues(
  symbol: string,
  startDate: string,
  endDate: string,
): Promise<DailyValue[]> {
  return withRetry(async () => {
    const sessionId = await createSession();
    const fetchedAt = new Date().toISOString();

    if (symbol === "001316.OF") {
      const rows: Array<Record<string, string | number>> = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const response = await callTool(sessionId, "ft_get_fund_net_value", {
          fund_code: "001316",
          start_date: compactDate(startDate),
          end_date: compactDate(endDate),
          page,
          page_size: 200,
        });
        rows.push(...(response.data as Array<Record<string, string | number>>));
        hasMore = response.hasMore;
        page += 1;
      }
      return rows.map((row) => ({
        date: String(row.nav_date).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"),
        symbol,
        valueType: "unit_nav",
        open: null,
        high: null,
        low: null,
        close: null,
        unitNav: String(row.unit_nav),
        accumulatedNav: String(row.accumulated_nav),
        adjustedValue: String(row.adjusted_unit_nav),
        changePercent: String(row.unit_nav_growth),
        volume: null,
        turnover: null,
        source: "ftshare",
        fetchedAt,
      }));
    }

    const rows: Array<Record<string, string | number>> = [];
    for (const range of splitDateRange(startDate, endDate)) {
      const response = await callTool(sessionId, "ft_stock_candlesticks", {
        symbol,
        interval_unit: "day",
        interval_value: 1,
        adjust_kind: "none",
        since_ts_millis: startOfShanghaiDay(range.startDate),
        until_ts_millis: endOfShanghaiDay(range.endDate),
        limit: 500,
      });
      rows.push(...(response.data as Array<Record<string, string | number>>));
    }
    return rows.map((row) => ({
      date: shanghaiDay(Number(row.ts_millis)),
      symbol,
      valueType: "index_close",
      open: String(row.open),
      high: String(row.high),
      low: String(row.low),
      close: String(row.close),
      unitNav: null,
      accumulatedNav: null,
      adjustedValue: null,
      changePercent: null,
      volume: String(row.volume),
      turnover: String(row.turnover),
      source: "ftshare",
      fetchedAt,
    }));
  });
}
