import { ArrowRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { buttonVariants } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { readPlans } from "../lib/plans";
import { type Purpose, purposes, readAssets, readPortfolios } from "../lib/portfolio";

const groups = Object.keys(purposes) as Purpose[];
export function AssetHomePage() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((n) => n + 1);
    for (const event of ["storage", "portfolio-changed", "plans-changed"])
      window.addEventListener(event, refresh);
    return () => {
      for (const event of ["storage", "portfolio-changed", "plans-changed"])
        window.removeEventListener(event, refresh);
    };
  }, []);
  void revision;
  const assets = readAssets(),
    portfolios = readPortfolios(),
    plans = readPlans();
  const ownedAssets = new Set(portfolios.flatMap((p) => p.assetIds));
  const ownedPlans = new Set(portfolios.flatMap((p) => p.planIds));
  const unresolved = portfolios.filter(
    (p) =>
      !p.purpose ||
      p.assetIds.some((id) => assets.find((a) => a.id === id)?.purpose !== p.purpose) ||
      p.planIds.some((id) => plans.find((plan) => plan.id === id)?.purpose !== p.purpose),
  );
  const unsetPlans = plans.filter((p) => !p.purpose && !ownedPlans.has(p.id));
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="font-semibold tracking-tight">
            WealthPlans
          </Link>
          <Link to="/data-center" className="text-sm text-muted-foreground hover:text-foreground">
            数据中心 <ArrowRight className="inline size-4" />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-10 px-5 py-10">
        <section className="rounded-2xl border bg-card p-7 sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">投资收益分析 · 人民币</p>
              <h1 className="mt-2 text-3xl font-semibold">收益总览</h1>
            </div>
            <Badge variant="outline">账本未建立 · 暂不可核算</Badge>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            仅统计纳入投资账本的资产及现金；保险保障支出、生活资金不自动计入。收益取自真实成交、边界现金流和有效估值，不使用产品清单或计划价格推算。
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["投资资产市值", "需持仓及有效估值"],
              ["投资现金", "需账户及资金归属"],
              ["期间总盈亏", "需期初期末净资产与外部现金流"],
              ["期间收益率", "需完整估值与现金流；区分 TWR / XIRR"],
              ["数据完整性", "需账本、估值与对账结果"],
            ].map(([label, reason]) => (
              <div key={label} className="rounded-xl border bg-background p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-3 text-xl font-semibold">—</p>
                <p className="mt-2 text-xs text-muted-foreground">{reason}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            统计期间和组合范围将在账本接入后选择；数据不足时不填 0、不展示虚假曲线。
          </p>
        </section>
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">按资金用途查看</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                组合是归属边界，成员仍保留各自的产品或网格规则；下方未归属项不重复计入组合。
              </p>
            </div>
            <Link to="/assets/new" className={buttonVariants()}>
              <Plus className="size-4" /> 新建资产
            </Link>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {groups.map((purpose) => {
              const groupPortfolios = portfolios.filter(
                (p) => p.purpose === purpose && !unresolved.includes(p),
              );
              const independent = assets.filter(
                (a) => a.purpose === purpose && !ownedAssets.has(a.id),
              );
              const standalonePlans = plans.filter(
                (p) => p.purpose === purpose && !ownedPlans.has(p.id),
              );
              return (
                <Card key={purpose} className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {purposes[purpose]}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        {groupPortfolios.length} 个组合 ·{" "}
                        {independent.length + standalonePlans.length} 个独立项
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div>
                      <h3 className="mb-2 text-sm font-medium">组合</h3>
                      {groupPortfolios.length ? (
                        groupPortfolios.map((p) => (
                          <Link
                            key={p.id}
                            to={`/portfolios/${p.id}`}
                            className="mb-2 block rounded-lg border p-3 hover:bg-muted/40"
                          >
                            <div className="flex justify-between gap-2">
                              <strong>{p.name}</strong>
                              <ArrowRight className="size-4" />
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {p.assetIds.length} 项资产 · {p.planIds.length} 个方案
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {p.assetIds.map((id) => {
                                const a = assets.find((item) => item.id === id);
                                return (
                                  a && (
                                    <Badge variant="outline" key={id}>
                                      {a.instrument.name}
                                    </Badge>
                                  )
                                );
                              })}
                              {p.planIds.map((id) => {
                                const plan = plans.find((item) => item.id === id);
                                return (
                                  plan && (
                                    <Badge variant="secondary" key={id}>
                                      {plan.name}
                                    </Badge>
                                  )
                                );
                              })}
                            </div>
                          </Link>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">暂无组合</p>
                      )}
                    </div>
                    <div className="border-t pt-4">
                      <h3 className="mb-2 text-sm font-medium">独立资产与方案</h3>
                      {independent.length || standalonePlans.length ? (
                        <div className="space-y-2">
                          {independent.map((a) => (
                            <Link
                              to={`/assets/${a.id}`}
                              key={a.id}
                              className="block rounded-lg border p-3 text-sm hover:bg-muted/40"
                            >
                              <Badge variant="outline">
                                {a.instrument.kind === "wealth"
                                  ? "银行理财"
                                  : a.instrument.kind === "fund"
                                    ? "场外基金"
                                    : a.instrument.kind === "etf"
                                      ? "ETF"
                                      : "其他"}
                              </Badge>{" "}
                              <span className="font-medium">{a.instrument.name}</span>
                              <span className="ml-2 text-muted-foreground">
                                {a.instrument.symbol}
                              </span>
                            </Link>
                          ))}
                          {standalonePlans.map((plan) => (
                            <Link
                              to={`/plans/${plan.id}`}
                              key={plan.id}
                              className="block rounded-lg border p-3 text-sm hover:bg-muted/40"
                            >
                              <Badge variant="secondary">
                                {plan.draft.type === "grid" ? "网格" : "普通方案"}
                              </Badge>{" "}
                              <span className="font-medium">{plan.name}</span>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">暂无独立项</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {(unresolved.length > 0 || unsetPlans.length > 0) && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
              <h3 className="font-semibold">待整理的历史记录</h3>
              <p className="mt-1">
                旧数据没有明确分类或成员跨分类，不自动猜测和迁移；原记录仍保留。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {unresolved.map((p) => (
                  <Link key={p.id} className="underline" to={`/portfolios/${p.id}/edit`}>
                    {p.name} · 设置组合分类
                  </Link>
                ))}
                {unsetPlans.map((p) => (
                  <Link key={p.id} className="underline" to={`/plans/${p.id}/edit`}>
                    {p.name} · 设置方案分类
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
      <footer className="mx-auto max-w-6xl px-5 py-8 text-xs text-muted-foreground">
        配置保存在当前浏览器；尚无真实账户账本，不代表实际持有或已计算收益。
      </footer>
    </div>
  );
}
