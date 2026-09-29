import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpToLine,
  Check,
  Cloud,
  Database,
  RefreshCw,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { EnvironmentSyncAction } from "../../shared/schemas/environmentSync";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button, buttonVariants } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

type ManifestEntry = {
  key: string;
  hash: string;
  symbol: string;
  date: string;
  valueType: string;
  source: string;
  primaryValue: string | null;
  changePercent: string | null;
  fetchedAt: string;
};

type RecordConflict = {
  key: string;
  local: ManifestEntry;
  remote: ManifestEntry;
};

type Comparison = {
  planHash: string;
  generatedAt: string;
  localCount: number;
  remoteCount: number;
  matchingCount: number;
  onlyLocal: ManifestEntry[];
  onlyRemote: ManifestEntry[];
  conflicts: RecordConflict[];
};

const actionDetails: Record<
  EnvironmentSyncAction,
  { title: string; description: string; button: string }
> = {
  push_missing: {
    title: "上传本地缺少项",
    description: "只向 Cloudflare 新增远程不存在的记录，不覆盖已有远程数据。",
    button: "确认上传到 Cloudflare",
  },
  pull_missing: {
    title: "下载远程缺少项",
    description: "只向本地新增当前没有的记录，不覆盖已有本地数据。",
    button: "确认下载到本地",
  },
  resolve_local: {
    title: "冲突以本地为准",
    description: "用本地内容覆盖 Cloudflare 中主键相同但内容不同的记录。",
    button: "确认以本地覆盖远程",
  },
  resolve_remote: {
    title: "冲突以 Cloudflare 为准",
    description: "用 Cloudflare 内容覆盖本地主键相同但内容不同的记录。",
    button: "确认以远程覆盖本地",
  },
};

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message ?? `请求失败（HTTP ${response.status}）`);
  }
  return body;
}

function valueLabel(entry: ManifestEntry) {
  return entry.primaryValue ?? "—";
}

export function EnvironmentSyncPage() {
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<EnvironmentSyncAction | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const loadComparison = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/environment-sync/compare");
      const body = await readJson<{ comparison: Comparison }>(response);
      setComparison(body.comparison);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "环境对比失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadComparison();
  }, [loadComparison]);

  const pendingCount = useMemo(() => {
    if (!comparison || !pendingAction) return 0;
    if (pendingAction === "push_missing") return comparison.onlyLocal.length;
    if (pendingAction === "pull_missing") return comparison.onlyRemote.length;
    return comparison.conflicts.length;
  }, [comparison, pendingAction]);

  function chooseAction(action: EnvironmentSyncAction) {
    setPendingAction(action);
    setConfirmed(false);
    setMessage(null);
    setError(null);
  }

  async function executeTransfer() {
    if (!comparison || !pendingAction || !confirmed) return;
    setTransferring(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/environment-sync/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: pendingAction,
          planHash: comparison.planHash,
          confirmed: true,
        }),
      });
      const body = await readJson<{ transferred: number; comparison: Comparison }>(response);
      setComparison(body.comparison);
      setMessage(`同步完成，共处理 ${body.transferred} 条记录。`);
      setPendingAction(null);
      setConfirmed(false);
    } catch (transferError) {
      setError(transferError instanceof Error ? transferError.message : "环境同步失败");
    } finally {
      setTransferring(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link className="flex items-center gap-2 font-semibold" to="/">
            <span className="flex size-7 items-center justify-center rounded bg-primary text-xs text-primary-foreground">
              WP
            </span>
            WealthPlans
          </Link>
          <Link className={buttonVariants({ variant: "ghost", size: "sm" })} to="/data-center">
            <ArrowLeft className="size-4" />
            返回数据中心
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Badge variant="secondary">LOCAL ↔ PREVIEW</Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">本地与 Cloudflare 同步</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              对比本地 D1 与 preview D1。系统先按稳定主键和内容指纹生成计划；确认时会重新校验，
              任何一侧发生变化都会让旧计划失效。
            </p>
          </div>
          <Button
            disabled={loading || transferring}
            onClick={() => void loadComparison()}
            variant="outline"
          >
            <RefreshCw className="size-4" />
            重新检查
          </Button>
        </div>

        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>每次只执行一个方向</AlertTitle>
          <AlertDescription>
            缺少记录只新增、不覆盖；内容冲突必须单独选择以本地或 Cloudflare 为准。Git
            提交和普通部署不会触发这里的数据同步。
          </AlertDescription>
        </Alert>

        {error ? (
          <Alert className="border-destructive/40 bg-destructive/5">
            <AlertTitle>无法完成操作</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {message ? (
          <Alert className="border-emerald-600/30 bg-emerald-50">
            <Check className="size-4 text-emerald-700" />
            <AlertTitle>同步完成</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard icon={<Database />} label="本地记录" value={comparison?.localCount} />
          <SummaryCard icon={<Cloud />} label="Cloudflare 记录" value={comparison?.remoteCount} />
          <SummaryCard icon={<Check />} label="内容一致" value={comparison?.matchingCount} />
          <SummaryCard
            icon={<AlertTriangle />}
            label="内容冲突"
            value={comparison?.conflicts.length}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowUpToLine className="size-4" />
                仅本地存在
              </CardTitle>
              <CardDescription>
                {comparison?.onlyLocal.length ?? 0} 条可以上传到 Cloudflare。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RecordList entries={comparison?.onlyLocal ?? []} />
              <Button
                disabled={!comparison?.onlyLocal.length || transferring}
                onClick={() => chooseAction("push_missing")}
              >
                上传缺少记录
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowDownToLine className="size-4" />仅 Cloudflare 存在
              </CardTitle>
              <CardDescription>
                {comparison?.onlyRemote.length ?? 0} 条可以下载到本地。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RecordList entries={comparison?.onlyRemote ?? []} />
              <Button
                disabled={!comparison?.onlyRemote.length || transferring}
                onClick={() => chooseAction("pull_missing")}
              >
                下载缺少记录
              </Button>
            </CardContent>
          </Card>
        </section>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">内容冲突</CardTitle>
            <CardDescription>
              主键相同但价格、净值或成交字段不同。抓取时间不同不会被判定为冲突。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ConflictTable conflicts={comparison?.conflicts ?? []} />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!comparison?.conflicts.length || transferring}
                onClick={() => chooseAction("resolve_local")}
              >
                全部以本地为准
              </Button>
              <Button
                disabled={!comparison?.conflicts.length || transferring}
                onClick={() => chooseAction("resolve_remote")}
                variant="outline"
              >
                全部以 Cloudflare 为准
              </Button>
            </div>
          </CardContent>
        </Card>

        {pendingAction ? (
          <Card className="border-primary/30 shadow-none">
            <CardHeader>
              <CardTitle>{actionDetails[pendingAction].title}</CardTitle>
              <CardDescription>{actionDetails[pendingAction].description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md bg-muted p-4 text-sm">
                本次计划处理 <strong>{pendingCount}</strong> 条记录。确认使用的计划版本：
                <code className="ml-1 break-all text-xs">{comparison?.planHash.slice(0, 16)}…</code>
              </div>
              <Label className="items-start rounded-md border p-3">
                <input
                  checked={confirmed}
                  className="mt-1"
                  onChange={(event) => setConfirmed(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <span className="block">我已查看数量和方向，并确认提交本次同步</span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    如果确认后任一环境发生变化，服务会返回计划过期并拒绝写入。
                  </span>
                </span>
              </Label>
              <div className="flex gap-2">
                <Button
                  disabled={!confirmed || transferring}
                  onClick={() => void executeTransfer()}
                >
                  {transferring ? "正在同步…" : actionDetails[pendingAction].button}
                </Button>
                <Button
                  disabled={transferring}
                  onClick={() => {
                    setPendingAction(null);
                    setConfirmed(false);
                  }}
                  variant="outline"
                >
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {comparison ? (
          <p className="text-xs text-muted-foreground">
            最近检查：{new Date(comparison.generatedAt).toLocaleString("zh-CN")} · 指纹不包含
            fetchedAt，但包含来源、标的、类型、日期及全部金融数值字段。
          </p>
        ) : null}
      </main>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value?: number }) {
  return (
    <Card className="gap-3 py-4 shadow-none">
      <CardContent className="px-4">
        <span className="mb-3 block text-muted-foreground [&_svg]:size-5">{icon}</span>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value ?? "—"}</p>
      </CardContent>
    </Card>
  );
}

function RecordList({ entries }: { entries: ManifestEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        暂无差异
      </p>
    );
  }
  return (
    <div className="max-h-52 divide-y overflow-auto rounded-md border">
      {entries.slice(0, 100).map((entry) => (
        <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm" key={entry.key}>
          <span>
            <span className="font-mono">{entry.symbol}</span>
            <span className="ml-2 text-muted-foreground">{entry.date}</span>
          </span>
          <span>{valueLabel(entry)}</span>
        </div>
      ))}
    </div>
  );
}

function ConflictTable({ conflicts }: { conflicts: RecordConflict[] }) {
  if (conflicts.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        没有内容冲突
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>标的</TableHead>
          <TableHead>日期</TableHead>
          <TableHead>本地值</TableHead>
          <TableHead>Cloudflare 值</TableHead>
          <TableHead>来源</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {conflicts.slice(0, 100).map((conflict) => (
          <TableRow key={conflict.key}>
            <TableCell className="font-mono">{conflict.local.symbol}</TableCell>
            <TableCell className="font-mono">{conflict.local.date}</TableCell>
            <TableCell>{valueLabel(conflict.local)}</TableCell>
            <TableCell>{valueLabel(conflict.remote)}</TableCell>
            <TableCell>{conflict.local.source}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
