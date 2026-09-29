import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { type Instrument, validInstrument } from "../lib/plans";
import { type Purpose, purposes, readAssets, saveAssets } from "../lib/portfolio";
import { PlanForm } from "./PlansPage";
import { PortfolioFormPage } from "./PortfolioPage";

type CreationType = Instrument["kind"] | "grid" | "regular" | "portfolio";
const kinds: Record<CreationType, string> = {
  wealth: "银行理财",
  etf: "ETF",
  fund: "场外基金",
  other: "其他产品",
  grid: "网格方案",
  regular: "普通方案",
  portfolio: "组合",
};
export function AssetCreatePage() {
  const navigate = useNavigate();
  const [kind, setKind] = useState<CreationType>("wealth");
  const [purpose, setPurpose] = useState<Purpose>("steady");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const isProduct = ["wealth", "etf", "fund", "other"].includes(kind);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const instrument: Instrument = {
      kind: kind as Instrument["kind"],
      symbol: symbol.trim().toUpperCase(),
      name: name.trim(),
    };
    if (!validInstrument(instrument)) return setError("请填写有效的产品代码（或唯一编号）与名称。");
    if (
      readAssets().some(
        (a) =>
          a.instrument.kind === instrument.kind &&
          a.instrument.symbol.toUpperCase() === instrument.symbol,
      )
    )
      return setError("同类型、同代码的产品已登记。");
    try {
      const id = crypto.randomUUID();
      saveAssets([
        ...readAssets(),
        { id, purpose, instrument, note: note.trim(), createdAt: new Date().toISOString() },
      ]);
      navigate(`/assets/${id}`);
    } catch {
      setError("浏览器保存失败，请检查存储权限。");
    }
  }
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link to="/" className="font-semibold">
            WealthPlans
          </Link>
          <Link to="/data-center" className="text-sm text-muted-foreground">
            数据中心
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-5 px-5 py-9">
        <Link to="/" className="text-sm text-muted-foreground">
          ← 返回总览
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">新建资产</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            先选择资金用途与类型。组合是归属容器，网格是独立方案，产品是标的档案；使用同一个创建入口，不混淆底层数据。
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>选择类型</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Label className="grid gap-2 text-sm">
              资金用途
              <select
                className="h-9 rounded-md border bg-background px-3"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as Purpose)}
              >
                {Object.entries(purposes).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </Label>
            <Label className="grid gap-2 text-sm">
              资产类型
              <select
                className="h-9 rounded-md border bg-background px-3"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as CreationType);
                  setError("");
                }}
              >
                {Object.entries(kinds).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </Label>
          </CardContent>
        </Card>
        {isProduct ? (
          <Card>
            <CardHeader>
              <CardTitle>登记{kinds[kind]}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
                <Label className="grid gap-2 text-sm">
                  产品代码 / 唯一编号
                  <Input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    placeholder="按发行方或账单填写"
                  />
                </Label>
                <Label className="grid gap-2 text-sm">
                  产品名称
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Label>
                <Label className="grid gap-2 text-sm sm:col-span-2">
                  备注（选填）
                  <Input value={note} onChange={(e) => setNote(e.target.value)} />
                </Label>
                {error && (
                  <p role="alert" className="text-sm text-destructive sm:col-span-2">
                    {error}
                  </p>
                )}
                <div className="sm:col-span-2">
                  <Button type="submit">保存资产</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : kind === "portfolio" ? (
          <PortfolioFormPage key={`portfolio-${purpose}`} embedded initialPurpose={purpose} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{kinds[kind]}配置</CardTitle>
            </CardHeader>
            <CardContent>
              <PlanForm
                key={`${kind}-${purpose}`}
                initialType={kind === "grid" ? "grid" : "regular"}
                initialPurpose={purpose}
                onDone={(id) => navigate(`/plans/${id}`)}
              />
            </CardContent>
          </Card>
        )}
        <p className="text-xs text-muted-foreground">
          产品、组合和方案配置仅保存在此浏览器；创建不等于已持有，也不会生成收益。
        </p>
      </main>
    </div>
  );
}
