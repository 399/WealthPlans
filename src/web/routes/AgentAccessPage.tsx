import { ArrowLeft, Bot, Cloud, Database, KeyRound, Terminal } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { buttonVariants } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

const endpoints = [
  ["GET", "/catalog?q=", "查询 D1 中的标的、记录数和日期覆盖范围"],
  ["GET", "/data?symbol=&start_date=&end_date=&format=json", "读取 JSON 或 CSV 日频数据"],
  ["POST", "/sync/preview", "同步前检查日期范围内的重叠记录"],
  ["POST", "/sync", "按 skip 或 overwrite 写入 D1，并将批次归档到 R2"],
] as const;

export function AgentAccessPage() {
  const origin =
    typeof window === "undefined" ? "https://<deployment-host>" : window.location.origin;
  const baseUrl = `${origin}/api/v1/agent`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link className="flex items-center gap-2 font-semibold" to="/">
            <span className="flex size-7 items-center justify-center rounded bg-primary text-xs text-primary-foreground">
              WP
            </span>
            WealthPlans
          </Link>
          <Link className={buttonVariants({ variant: "ghost", size: "sm" })} to="/">
            <ArrowLeft className="size-4" />
            返回数据
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <Badge variant="secondary">
            <Bot className="size-3" />
            Agent API
          </Badge>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">金融数据接入</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Agent 不需要操作网页。直接通过当前部署的 HTTP API 查询 D1、下载
            CSV，或在授权后触发同步。
          </p>
        </div>

        <Alert>
          <KeyRound className="size-4" />
          <AlertTitle>远程读取与写入采用不同边界</AlertTitle>
          <AlertDescription>
            目录和数据读取可远程使用；同步写入默认关闭。启用远程同步后，请在请求中携带
            Authorization: Bearer &lt;SYNC_TOKEN&gt;。
          </AlertDescription>
        </Alert>

        <section className="grid gap-3 sm:grid-cols-3">
          <Card className="gap-3 py-4 shadow-none">
            <CardContent className="px-4">
              <Cloud className="mb-3 size-5 text-muted-foreground" />
              <p className="font-medium">远程可访问</p>
              <p className="mt-1 text-sm text-muted-foreground">
                使用当前 Worker 域名，无需本地进程。
              </p>
            </CardContent>
          </Card>
          <Card className="gap-3 py-4 shadow-none">
            <CardContent className="px-4">
              <Database className="mb-3 size-5 text-muted-foreground" />
              <p className="font-medium">D1 + R2</p>
              <p className="mt-1 text-sm text-muted-foreground">
                结构化查询与同步原始批次分开保存。
              </p>
            </CardContent>
          </Card>
          <Card className="gap-3 py-4 shadow-none">
            <CardContent className="px-4">
              <Terminal className="mb-3 size-5 text-muted-foreground" />
              <p className="font-medium">稳定 JSON 契约</p>
              <p className="mt-1 text-sm text-muted-foreground">
                schemaVersion、错误码和十进制字符串。
              </p>
            </CardContent>
          </Card>
        </section>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>基础地址</CardTitle>
            <CardDescription>先访问 manifest 获取当前环境和可用端点。</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
              <code>{baseUrl}</code>
            </pre>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>端点</CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {endpoints.map(([method, path, description]) => (
              <div className="grid gap-2 px-6 py-4 sm:grid-cols-[70px_1fr]" key={path}>
                <Badge className="h-fit" variant={method === "GET" ? "secondary" : "outline"}>
                  {method}
                </Badge>
                <div className="min-w-0">
                  <code className="break-all text-sm">{path}</code>
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>调用示例</CardTitle>
            <CardDescription>示例自动使用当前访问域名。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">查询目录</p>
              <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
                <code>{`curl -s "${baseUrl}/catalog?q=001316"`}</code>
              </pre>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">读取区间数据</p>
              <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
                <code>{`curl -s "${baseUrl}/data?symbol=001316.OF&start_date=2026-07-20&end_date=2026-07-27&order=asc"`}</code>
              </pre>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">授权同步</p>
              <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
                <code>{`curl -s -X POST "${baseUrl}/sync" \\
  -H "Authorization: Bearer <SYNC_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"symbols":["001316.OF"],"startDate":"2026-07-20","endDate":"2026-07-27","conflict":"skip"}'`}</code>
              </pre>
            </div>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground">
          完整字段、错误处理与执行顺序见{" "}
          <code className="text-foreground">docs/runbooks/agent-data-access.md</code>。
        </p>
      </main>
    </div>
  );
}
