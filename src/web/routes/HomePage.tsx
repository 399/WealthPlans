import {
  ArrowLeftRight,
  Bot,
  CheckCircle2,
  Cloud,
  Database,
  RefreshCw,
  Search,
  Server,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { DailyValue, InstrumentSummary } from "../../shared/schemas/financialData";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button, buttonVariants } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { cn } from "../lib/utils";

type SyncStep = "closed" | "setup" | "confirm" | "syncing" | "done";
type ConflictMode = "skip" | "overwrite";
type Health = {
  environment: "local" | "preview" | "production";
  storage: {
    engine: string;
    archive: string;
    recordCount: number;
    lastFetchedAt: string | null;
  };
  sync: { remoteEnabled: boolean; authRequired: boolean };
};

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
const fiveDaysAgo = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
}).format(new Date(Date.now() - 6 * 86_400_000));

function displayValue(value: string | null, digits = 4) {
  if (!value) return "—";
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: digits }).format(Number(value));
}

function displayCompact(value: string | null) {
  if (!value) return "—";
  return new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message ?? `请求失败（HTTP ${response.status}）`);
  }
  return body;
}

export function DataCenterPage() {
  const [query, setQuery] = useState("");
  const [instruments, setInstruments] = useState<InstrumentSummary[]>([]);
  const [catalog, setCatalog] = useState<InstrumentSummary[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("000001.XSHG");
  const [values, setValues] = useState<DailyValue[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStep, setSyncStep] = useState<SyncStep>("closed");
  const [syncSymbols, setSyncSymbols] = useState<string[]>(["000001.XSHG", "001316.OF"]);
  const [startDate, setStartDate] = useState(fiveDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [conflict, setConflict] = useState<ConflictMode>("skip");
  const [overlaps, setOverlaps] = useState<Array<{ symbol: string; count: number }>>([]);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncToken, setSyncToken] = useState("");

  const loadInstruments = useCallback(async (search = "") => {
    const response = await fetch(`/api/v1/instruments?q=${encodeURIComponent(search)}`);
    const body = await readJson<{ data: InstrumentSummary[] }>(response);
    setInstruments(body.data);
    if (!search) setCatalog(body.data);
    return body.data;
  }, []);

  const loadValues = useCallback(async (symbol: string) => {
    const response = await fetch(`/api/v1/instruments/${encodeURIComponent(symbol)}/data`);
    const body = await readJson<{ data: DailyValue[] }>(response);
    setValues(body.data);
  }, []);

  const loadHealth = useCallback(async () => {
    const response = await fetch("/api/v1/health");
    setHealth(await readJson<Health>(response));
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        await Promise.all([loadHealth(), loadInstruments(), loadValues(selectedSymbol)]);
        if (active) setError(null);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "数据读取失败");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [loadHealth, loadInstruments, loadValues, selectedSymbol]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadInstruments(query).catch((searchError) =>
        setError(searchError instanceof Error ? searchError.message : "搜索失败"),
      );
    }, 180);
    return () => window.clearTimeout(timer);
  }, [loadInstruments, query]);

  const selected = useMemo(
    () => catalog.find((instrument) => instrument.symbol === selectedSymbol),
    [catalog, selectedSymbol],
  );
  const totalRecords = catalog.reduce((sum, instrument) => sum + instrument.recordCount, 0);
  const canSync = health?.sync.remoteEnabled === true;

  function toggleSymbol(symbol: string) {
    setSyncSymbols((current) =>
      current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol],
    );
  }

  async function previewSync() {
    setError(null);
    if (syncSymbols.length === 0) {
      setError("请至少选择一个同步标的");
      return;
    }
    try {
      const response = await fetch("/api/v1/sync/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: syncSymbols, startDate, endDate }),
      });
      const body = await readJson<{ overlaps: Array<{ symbol: string; count: number }> }>(response);
      setOverlaps(body.overlaps);
      setSyncStep("confirm");
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "检查失败");
    }
  }

  async function runSync() {
    setSyncStep("syncing");
    setError(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (health?.sync.authRequired && syncToken) {
        headers.Authorization = `Bearer ${syncToken}`;
      }
      const response = await fetch("/api/v1/sync", {
        method: "POST",
        headers,
        body: JSON.stringify({ symbols: syncSymbols, startDate, endDate, conflict }),
      });
      const body = await readJson<{
        results: Array<{
          symbol: string;
          inserted: number;
          updated: number;
          skipped: number;
        }>;
      }>(response);
      setSyncMessage(
        body.results
          .map(
            (result) =>
              `${result.symbol}：新增 ${result.inserted}，更新 ${result.updated}，跳过 ${result.skipped}`,
          )
          .join("；"),
      );
      await Promise.all([loadHealth(), loadInstruments(), loadValues(selectedSymbol)]);
      if (query) await loadInstruments(query);
      setSyncStep("done");
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "同步失败");
      setSyncStep("confirm");
    }
  }

  function closeSync() {
    setSyncStep("closed");
    setSyncMessage("");
    setOverlaps([]);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link className="flex items-center gap-2 font-semibold" to="/">
            <span className="flex size-7 items-center justify-center rounded bg-primary text-xs text-primary-foreground">
              WP
            </span>
            WealthPlans
          </Link>
          <nav className="flex items-center gap-2">
            <Link className={buttonVariants({ variant: "ghost", size: "sm" })} to="/">
              总览
            </Link>
            <Badge variant="outline" className="hidden gap-1.5 sm:flex">
              <Cloud className="size-3" />
              {health?.environment ?? "连接中"}
            </Badge>
            <Link
              className={buttonVariants({ variant: "ghost", size: "sm" })}
              to="/environment-sync"
            >
              <ArrowLeftRight className="size-4" />
              <span className="hidden sm:inline">环境同步</span>
            </Link>
            <Link className={buttonVariants({ variant: "ghost", size: "sm" })} to="/agent-access">
              <Bot className="size-4" />
              Agent 接入
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">数据中心</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              查看 D1 中的数据范围，按需从公开数据源同步，原始同步批次归档到 R2。
            </p>
          </div>
          <Button disabled={!canSync} onClick={() => setSyncStep("setup")}>
            <RefreshCw className="size-4" />
            同步数据
          </Button>
        </div>

        {!canSync && health ? (
          <Alert>
            <AlertTitle>当前远程环境为只读</AlertTitle>
            <AlertDescription>
              数据可以远程查看。远程同步需先配置 SYNC_TOKEN 并显式启用，避免公开写接口被滥用。
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert className="border-destructive/40 bg-destructive/5">
            <AlertTitle>操作未完成</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-3" aria-label="数据概览">
          <Card className="gap-3 py-4 shadow-none">
            <CardContent className="flex items-center justify-between px-4">
              <div>
                <p className="text-sm text-muted-foreground">已存标的</p>
                <p className="mt-1 text-2xl font-semibold">{catalog.length}</p>
              </div>
              <Database className="size-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card className="gap-3 py-4 shadow-none">
            <CardContent className="flex items-center justify-between px-4">
              <div>
                <p className="text-sm text-muted-foreground">日频记录</p>
                <p className="mt-1 text-2xl font-semibold">
                  {totalRecords.toLocaleString("zh-CN")}
                </p>
              </div>
              <Server className="size-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card className="gap-3 py-4 shadow-none">
            <CardContent className="px-4">
              <p className="text-sm text-muted-foreground">存储</p>
              <p className="mt-1 text-sm font-medium">
                {health?.storage.engine ?? "D1"} · {health?.storage.archive ?? "R2"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {health?.storage.lastFetchedAt
                  ? `最近抓取 ${new Date(health.storage.lastFetchedAt).toLocaleString("zh-CN")}`
                  : "尚无抓取记录"}
              </p>
            </CardContent>
          </Card>
        </section>

        {syncStep !== "closed" ? (
          <Card className="shadow-none">
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle>{syncStep === "done" ? "同步完成" : "同步金融数据"}</CardTitle>
                <CardDescription>先检查重叠记录，再明确选择跳过或覆盖。</CardDescription>
              </div>
              <Button aria-label="关闭同步面板" onClick={closeSync} size="icon" variant="ghost">
                <X className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-5">
              {syncStep === "setup" ? (
                <>
                  <fieldset className="space-y-2">
                    <legend className="mb-2 text-sm font-medium">标的</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        ["000001.XSHG", "上证指数"],
                        ["001316.OF", "安信稳健增值混合A"],
                      ].map(([symbol, name]) => (
                        <Label className="rounded-md border p-3" key={symbol}>
                          <input
                            checked={syncSymbols.includes(symbol)}
                            onChange={() => toggleSymbol(symbol)}
                            type="checkbox"
                          />
                          <span>
                            <span className="block">{name}</span>
                            <span className="font-mono text-xs font-normal text-muted-foreground">
                              {symbol}
                            </span>
                          </span>
                        </Label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Label className="grid gap-2">
                      开始日期
                      <Input
                        max={endDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        type="date"
                        value={startDate}
                      />
                    </Label>
                    <Label className="grid gap-2">
                      结束日期
                      <Input
                        min={startDate}
                        onChange={(event) => setEndDate(event.target.value)}
                        type="date"
                        value={endDate}
                      />
                    </Label>
                  </div>
                  <Button onClick={() => void previewSync()}>检查已有数据</Button>
                </>
              ) : null}

              {syncStep === "confirm" || syncStep === "syncing" ? (
                <>
                  <div className="rounded-md border">
                    {overlaps.map((item) => (
                      <div
                        className="flex items-center justify-between border-b px-3 py-2 text-sm last:border-0"
                        key={item.symbol}
                      >
                        <span className="font-mono">{item.symbol}</span>
                        <span>{item.count} 条重叠记录</span>
                      </div>
                    ))}
                  </div>
                  <fieldset className="space-y-2" disabled={syncStep === "syncing"}>
                    <legend className="mb-2 text-sm font-medium">冲突处理</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Label className="rounded-md border p-3">
                        <input
                          checked={conflict === "skip"}
                          name="conflict"
                          onChange={() => setConflict("skip")}
                          type="radio"
                        />
                        跳过已有记录
                      </Label>
                      <Label className="rounded-md border p-3">
                        <input
                          checked={conflict === "overwrite"}
                          name="conflict"
                          onChange={() => setConflict("overwrite")}
                          type="radio"
                        />
                        覆盖已有记录
                      </Label>
                    </div>
                  </fieldset>
                  {health?.sync.authRequired ? (
                    <Label className="grid max-w-md gap-2">
                      远程同步令牌
                      <Input
                        autoComplete="off"
                        onChange={(event) => setSyncToken(event.target.value)}
                        placeholder="Bearer Token"
                        type="password"
                        value={syncToken}
                      />
                    </Label>
                  ) : null}
                  <div className="flex gap-2">
                    <Button
                      disabled={syncStep === "syncing"}
                      onClick={() => setSyncStep("setup")}
                      variant="outline"
                    >
                      返回
                    </Button>
                    <Button
                      disabled={
                        syncStep === "syncing" || (health?.sync.authRequired === true && !syncToken)
                      }
                      onClick={() => void runSync()}
                    >
                      {syncStep === "syncing" ? "同步中…" : "确认同步"}
                    </Button>
                  </div>
                </>
              ) : null}

              {syncStep === "done" ? (
                <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-4">
                  <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" />
                  <div>
                    <p className="font-medium">数据与目录已刷新</p>
                    <p className="mt-1 text-sm text-muted-foreground">{syncMessage}</p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="h-fit gap-4 py-4 shadow-none">
            <CardHeader className="px-4">
              <CardTitle className="text-base">数据目录</CardTitle>
              <div className="relative pt-2">
                <Search className="absolute left-3 top-4.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索名称或代码"
                  type="search"
                  value={query}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-1 px-2">
              {instruments.map((instrument) => (
                <Button
                  className={cn(
                    "h-auto w-full justify-start px-3 py-3 text-left",
                    instrument.symbol === selectedSymbol && "bg-accent",
                  )}
                  key={instrument.symbol}
                  onClick={() => setSelectedSymbol(instrument.symbol)}
                  variant="ghost"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{instrument.name}</span>
                    <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                      {instrument.symbol}
                    </span>
                  </span>
                  <Badge variant="secondary">{instrument.recordCount}</Badge>
                </Button>
              ))}
              {!loading && instruments.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">没有匹配数据</p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="min-w-0 shadow-none">
            <CardHeader className="border-b">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{selected?.name ?? "请选择标的"}</CardTitle>
                  <CardDescription className="mt-1 font-mono">{selected?.symbol}</CardDescription>
                </div>
                {selected ? (
                  <div className="flex gap-2">
                    <Badge variant="outline">{selected.assetTypeLabel}</Badge>
                    <Badge variant="secondary">
                      {selected.startDate} — {selected.endDate}
                    </Badge>
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">日期</TableHead>
                    <TableHead>收盘 / 净值</TableHead>
                    <TableHead>涨跌</TableHead>
                    <TableHead>开盘</TableHead>
                    <TableHead>最高</TableHead>
                    <TableHead>最低</TableHead>
                    <TableHead>成交量</TableHead>
                    <TableHead className="pr-6">来源</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {values.map((value) => {
                    const positive = Number(value.changePercent ?? 0) >= 0;
                    return (
                      <TableRow key={`${value.source}-${value.date}`}>
                        <TableCell className="pl-6 font-mono">{value.date}</TableCell>
                        <TableCell className="font-medium">
                          {displayValue(value.unitNav ?? value.close)}
                        </TableCell>
                        <TableCell className={positive ? "text-rose-600" : "text-emerald-600"}>
                          {value.changePercent
                            ? `${positive ? "+" : ""}${displayValue(value.changePercent, 2)}%`
                            : "—"}
                        </TableCell>
                        <TableCell>{displayValue(value.open)}</TableCell>
                        <TableCell>{displayValue(value.high)}</TableCell>
                        <TableCell>{displayValue(value.low)}</TableCell>
                        <TableCell>{displayCompact(value.volume)}</TableCell>
                        <TableCell className="pr-6">
                          <Badge variant="outline">{value.source}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="mt-8 border-t py-5 text-center text-xs text-muted-foreground">
        数据仅用于个人研究，不构成投资建议
      </footer>
    </div>
  );
}
