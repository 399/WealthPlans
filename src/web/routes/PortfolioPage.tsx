import { ArrowLeft, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button, buttonVariants } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { type Instrument, readPlans, validInstrument } from "../lib/plans";
import {
  type Portfolio,
  type Purpose,
  purposes,
  readAssets,
  readPortfolios,
  saveAssets,
  savePortfolios,
  validateMembership,
} from "../lib/portfolio";

const kinds: Record<Instrument["kind"], string> = {
  etf: "ETF",
  fund: "场外基金",
  wealth: "银行理财",
  other: "其他",
};
function useRecords() {
  const [state, setState] = useState(() => ({
    assets: readAssets(),
    portfolios: readPortfolios(),
    plans: readPlans(),
  }));
  useEffect(() => {
    const refresh = () =>
      setState({
        assets: readAssets(),
        portfolios: readPortfolios(),
        plans: readPlans(),
      });
    window.addEventListener("storage", refresh);
    window.addEventListener("portfolio-changed", refresh);
    window.addEventListener("plans-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("portfolio-changed", refresh);
      window.removeEventListener("plans-changed", refresh);
    };
  }, []);
  return state;
}
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="font-semibold">
            WealthPlans
          </Link>
          <div className="flex gap-2">
            <Link className={buttonVariants({ variant: "ghost", size: "sm" })} to="/">
              总览
            </Link>
            <Link className={buttonVariants({ variant: "ghost", size: "sm" })} to="/data-center">
              数据中心
            </Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-9 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 py-8 text-xs text-muted-foreground">
        目前只在当前浏览器保存配置与归属；不含账户成交、资金流水与估值，不能计算实际收益。
      </footer>
    </div>
  );
}
function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Label className="grid gap-2 text-sm">
      {label}
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </Label>
  );
}
export function AssetsPage() {
  const { id } = useParams();
  const { assets, portfolios } = useRecords();
  const [instrument, setInstrument] = useState<Instrument>({
    kind: "wealth",
    symbol: "",
    name: "",
  });
  const [purpose, setPurpose] = useState<Purpose>("steady");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!validInstrument(instrument))
      return setError("请填写有效的产品代码和名称；没有公开代码的产品可填写账单中的唯一产品编号。");
    if (
      assets.some(
        (item) =>
          item.instrument.kind === instrument.kind &&
          item.instrument.symbol.toUpperCase() === instrument.symbol.trim().toUpperCase(),
      )
    )
      return setError("同类型、同代码产品已登记；同一产品在不同账户的份额应由后续账户账本区分。");
    try {
      saveAssets([
        ...assets,
        {
          id: crypto.randomUUID(),
          instrument: {
            ...instrument,
            symbol: instrument.symbol.trim().toUpperCase(),
            name: instrument.name.trim(),
          },
          purpose,
          note: note.trim(),
          createdAt: new Date().toISOString(),
        },
      ]);
      setInstrument({ kind: "wealth", symbol: "", name: "" });
      setNote("");
      setError("");
    } catch {
      setError("浏览器保存失败，请检查存储权限。");
    }
  }
  function updatePurpose(id: string, value: Purpose) {
    if (readPortfolios().some((p) => p.assetIds.includes(id) && p.purpose !== value))
      return setError("资产已归属组合，请先从组合移出再修改分类。");
    try {
      saveAssets(
        readAssets().map((asset) => (asset.id === id ? { ...asset, purpose: value } : asset)),
      );
      setError("");
    } catch {
      setError("浏览器保存失败。");
    }
  }
  if (id) {
    const asset = assets.find((item) => item.id === id);
    const owner = portfolios.find((p) => p.assetIds.includes(id));
    return (
      <Layout>
        <Link to="/" className="text-sm text-muted-foreground">
          ← 返回总览
        </Link>
        {asset ? (
          <Card>
            <CardHeader>
              <CardTitle>{asset.instrument.name}</CardTitle>
              <CardDescription>
                {purposes[asset.purpose]} · {kinds[asset.instrument.kind]} ·{" "}
                {asset.instrument.symbol}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{asset.note || "未填写备注"}</p>
              <p>
                归属：
                {owner ? (
                  <Link className="underline" to={`/portfolios/${owner.id}`}>
                    {owner.name}
                  </Link>
                ) : (
                  "独立资产"
                )}
              </p>
              <p className="text-muted-foreground">
                产品档案不代表实际持有；暂无账户、份额和收益数据。
              </p>
            </CardContent>
          </Card>
        ) : (
          <p>未找到资产</p>
        )}
      </Layout>
    );
  }
  return (
    <Layout>
      <Link to="/" className="text-sm text-muted-foreground">
        <ArrowLeft className="inline size-4" /> 返回总览
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">账户与资产 · 产品登记</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          “活期 / 稳健 / 长期 /
          保险”是用途分类，不是收益承诺或产品风险评级；登记产品不代表实际持有。
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>登记单个资产</CardTitle>
          <CardDescription>
            先建立独立的产品档案，再把它加入组合。账户、持仓数量和成本将在账本阶段单独记录。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={add}>
            <Label className="grid gap-2 text-sm">
              产品类型
              <select
                className="h-9 rounded-md border bg-background px-3"
                value={instrument.kind}
                onChange={(e) =>
                  setInstrument({
                    ...instrument,
                    kind: e.target.value as Instrument["kind"],
                  })
                }
              >
                {Object.entries(kinds).map(([id, title]) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}
              </select>
            </Label>
            <Label className="grid gap-2 text-sm">
              资金用途
              <select
                className="h-9 rounded-md border bg-background px-3"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as Purpose)}
              >
                {Object.entries(purposes).map(([id, title]) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}
              </select>
            </Label>
            <TextField
              label="产品代码 / 唯一编号"
              value={instrument.symbol}
              onChange={(symbol) => setInstrument({ ...instrument, symbol })}
              placeholder="按发行方或账单填写"
            />
            <TextField
              label="产品名称"
              value={instrument.name}
              onChange={(name) => setInstrument({ ...instrument, name })}
            />
            <TextField label="备注（选填）" value={note} onChange={setNote} />
            {error && (
              <p role="alert" className="text-sm text-destructive sm:col-span-2">
                {error}
              </p>
            )}
            <div className="sm:col-span-2">
              <Button type="submit">
                <Plus className="size-4" /> 登记资产
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-3">
        <h2 className="font-semibold">资产档案 · {assets.length}</h2>
        {assets.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-muted-foreground">
            尚无资产档案。
          </p>
        ) : (
          assets.map((asset) => (
            <Card key={asset.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                <div>
                  <p className="font-medium">
                    {asset.instrument.name} · {asset.instrument.symbol}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {kinds[asset.instrument.kind]} · {asset.note || "未填写备注"} ·{" "}
                    {portfolios.find((p) => p.assetIds.includes(asset.id))?.name || "未归属组合"}
                  </p>
                </div>
                <Label className="grid gap-1 text-xs">
                  资金用途
                  <select
                    aria-label={`${asset.instrument.name}资金用途`}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={asset.purpose}
                    onChange={(e) => updatePurpose(asset.id, e.target.value as Purpose)}
                  >
                    {Object.entries(purposes).map(([id, title]) => (
                      <option key={id} value={id}>
                        {title}
                      </option>
                    ))}
                  </select>
                </Label>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </Layout>
  );
}
function includedSymbols(plan: ReturnType<typeof readPlans>[number]): Instrument[] {
  const config = plan.versions.at(-1)?.config ?? plan.draft;
  return config.type === "grid" ? [config.data.instrument] : config.data.instruments;
}
export function PortfoliosPage() {
  const { portfolios, assets, plans } = useRecords();
  return (
    <Layout>
      <Link to="/" className="text-sm text-muted-foreground">
        ← 返回总览
      </Link>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">组合</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            组合持有成员的归属关系；方案规则各自独立，不能把计划当作已持仓。
          </p>
        </div>
        <Link to="/assets/new" className={buttonVariants()}>
          <Plus className="size-4" /> 新建资产
        </Link>
      </div>
      {portfolios.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          暂无组合。先登记资产或建立方案，再创建组合。
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {portfolios.map((p) => (
            <Link key={p.id} to={`/portfolios/${p.id}`}>
              <Card className="h-full hover:border-slate-400">
                <CardHeader>
                  <CardTitle>{p.name}</CardTitle>
                  <CardDescription>{p.goal || "未填写投资目标"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>
                    资产 {p.assetIds.length} 项 · 方案 {p.planIds.length} 个 · {p.currency}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {p.assetIds.map((id) => {
                      const a = assets.find((item) => item.id === id);
                      return (
                        a && (
                          <Badge key={id} variant="outline">
                            {purposes[a.purpose]} · {a.instrument.name}
                          </Badge>
                        )
                      );
                    })}
                    {p.planIds.map((id) => {
                      const plan = plans.find((item) => item.id === id);
                      return (
                        plan && (
                          <Badge key={id} variant="secondary">
                            {plan.name}
                          </Badge>
                        )
                      );
                    })}
                  </div>
                  <p className="text-muted-foreground">收益：暂无可核算数据</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
export function PortfolioFormPage({
  embedded = false,
  initialPurpose,
}: {
  embedded?: boolean;
  initialPurpose?: Purpose;
} = {}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { assets, portfolios, plans } = useRecords();
  const existing = portfolios.find((p) => p.id === id);
  const [name, setName] = useState(existing?.name ?? "");
  const [goal, setGoal] = useState(existing?.goal ?? "");
  const [risk, setRisk] = useState(existing?.risk ?? "");
  const [purpose, setPurpose] = useState<Purpose>(existing?.purpose ?? initialPurpose ?? "steady");
  const [assetIds, setAssetIds] = useState(
    existing?.assetIds.filter((assetId) =>
      assets.some(
        (a) => a.id === assetId && a.purpose === (existing.purpose ?? initialPurpose ?? "steady"),
      ),
    ) ?? ([] as string[]),
  );
  const [planIds, setPlanIds] = useState(
    existing?.planIds.filter((planId) =>
      plans.some(
        (p) => p.id === planId && p.purpose === (existing.purpose ?? initialPurpose ?? "steady"),
      ),
    ) ?? ([] as string[]),
  );
  const [error, setError] = useState("");
  if (id && !existing)
    return (
      <Layout>
        <p>未找到组合</p>
      </Layout>
    );
  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Portfolio = {
      id: existing?.id ?? crypto.randomUUID(),
      name: name.trim(),
      goal: goal.trim(),
      risk: risk.trim(),
      purpose,
      currency: "CNY",
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      assetIds,
      planIds,
    };
    const issue = validateMembership(next, readPortfolios(), readAssets(), readPlans());
    if (issue) return setError(issue);
    if (!assetIds.length && !planIds.length)
      return setError("请至少选择一项资产或方案；可先在新建资产中登记成员。");
    const identities = new Set(
      assetIds.map((assetId) => {
        const a = assets.find((item) => item.id === assetId);
        return a && `${a.instrument.kind}:${a.instrument.symbol.toUpperCase()}`;
      }),
    );
    for (const planId of planIds) {
      const plan = plans.find((item) => item.id === planId);
      if (plan?.purpose !== purpose)
        return setError(`方案“${plan?.name}”与组合分类不一致，请先修改方案分类。`);
      if (
        plan &&
        includedSymbols(plan).some(
          (item) => !identities.has(`${item.kind}:${item.symbol.trim().toUpperCase()}`),
        )
      )
        return setError(
          `方案“${plan.name}”的标的尚未全部登记并加入本组合。请先在账户与资产中登记，再勾选对应资产。`,
        );
    }
    try {
      savePortfolios(
        existing
          ? readPortfolios().map((p) => (p.id === next.id ? next : p))
          : [next, ...readPortfolios()],
      );
      navigate(`/portfolios/${next.id}`);
    } catch {
      setError("浏览器保存失败，请检查存储权限。");
    }
  }
  const content = (
    <>
      {!embedded && (
        <Link
          to={existing ? `/portfolios/${existing.id}` : "/"}
          className="text-sm text-muted-foreground"
        >
          ← 返回总览
        </Link>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{existing ? "编辑组合" : "配置组合"}</CardTitle>
          <CardDescription>
            资产与方案分开选择；网格方案仍在自己的详情中维护参数。相同产品可有多个方案，实际持仓和收益的归属需后续按成交分配，不按方案数复制。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Label className="grid gap-2 text-sm">
                资金用途
                <select
                  className="h-9 rounded-md border bg-background px-3"
                  value={purpose}
                  onChange={(e) => {
                    setPurpose(e.target.value as Purpose);
                    setAssetIds([]);
                    setPlanIds([]);
                  }}
                >
                  {Object.entries(purposes).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </Label>
              <TextField label="组合名称" value={name} onChange={setName} />
              <TextField label="投资目标（选填）" value={goal} onChange={setGoal} />
              <TextField label="风险定位（选填，非产品风险评级）" value={risk} onChange={setRisk} />
              <p className="self-end text-sm text-muted-foreground">统计币种：人民币（CNY）</p>
            </div>
            <div>
              <h2 className="font-medium">选择资产档案</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                每项资产最多归属一个组合；保险类只列为档案，保障支出及价值不自动并入投资收益。
              </p>
              <div className="mt-3 space-y-2">
                {assets
                  .filter((asset) => asset.purpose === purpose)
                  .map((asset) => {
                    const owner = portfolios.find(
                      (p) => p.id !== existing?.id && p.assetIds.includes(asset.id),
                    );
                    return (
                      <label
                        key={asset.id}
                        className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={assetIds.includes(asset.id)}
                          disabled={Boolean(owner)}
                          onChange={() => setAssetIds(toggle(assetIds, asset.id))}
                        />
                        <span>
                          {purposes[asset.purpose]} · {asset.instrument.name} ·{" "}
                          {asset.instrument.symbol}
                          {owner && `（已归属 ${owner.name}）`}
                        </span>
                      </label>
                    );
                  })}
                {!assets.length && (
                  <Link to="/assets/new" className="text-sm underline">
                    先登记资产
                  </Link>
                )}
              </div>
            </div>
            <div>
              <h2 className="font-medium">选择独立方案</h2>
              <div className="mt-3 space-y-2">
                {plans
                  .filter((plan) => plan.purpose === purpose)
                  .map((plan) => {
                    const owner = portfolios.find(
                      (p) => p.id !== existing?.id && p.planIds.includes(plan.id),
                    );
                    return (
                      <label
                        key={plan.id}
                        className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={planIds.includes(plan.id)}
                          disabled={Boolean(owner)}
                          onChange={() => setPlanIds(toggle(planIds, plan.id))}
                        />
                        <span>
                          {plan.draft.type === "grid" ? "网格" : "普通"} · {plan.name}
                          {owner && `（已归属 ${owner.name}）`}
                        </span>
                      </label>
                    );
                  })}
                {!plans.length && (
                  <Link to="/assets/new" className="text-sm underline">
                    先建立方案
                  </Link>
                )}
              </div>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit">保存组合</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
  return embedded ? content : <Layout>{content}</Layout>;
}
export function PortfolioDetailPage() {
  const { id } = useParams();
  const { portfolios, assets, plans } = useRecords();
  const portfolio = portfolios.find((p) => p.id === id);
  return (
    <Layout>
      <Link to="/" className="text-sm text-muted-foreground">
        ← 返回总览
      </Link>
      {!portfolio ? (
        <p>未找到组合</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{portfolio.name}</CardTitle>
              <CardDescription>
                {portfolio.purpose ? purposes[portfolio.purpose] : "待设置分类"} ·{" "}
                {portfolio.goal || "未填写目标"} · {portfolio.risk || "未填写风险定位"} · CNY
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                to={`/portfolios/${id}/edit`}
                className={buttonVariants({ variant: "outline" })}
              >
                编辑成员与目标
              </Link>
            </CardContent>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>资产档案</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {portfolio.assetIds.map((assetId) => {
                  const a = assets.find((item) => item.id === assetId);
                  return (
                    a && (
                      <Link
                        to={`/assets/${a.id}`}
                        key={assetId}
                        className="block rounded-lg border p-3 text-sm hover:bg-muted/40"
                      >
                        {purposes[a.purpose]} · {a.instrument.name} · {a.instrument.symbol} →
                      </Link>
                    )
                  );
                })}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>独立方案</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {portfolio.planIds.map((planId) => {
                  const p = plans.find((item) => item.id === planId);
                  return (
                    p && (
                      <Link
                        key={planId}
                        to={`/plans/${planId}`}
                        className="block rounded-lg border p-3 text-sm hover:bg-muted"
                      >
                        {p.draft.type === "grid" ? "网格" : "普通"} · {p.name} →
                      </Link>
                    )
                  );
                })}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>组合收益与分析</CardTitle>
              <CardDescription>
                待接入：账户成交与费用、现金流归属、估值及对账。组合内多个方案的收益不能直接相加为收益率；同一标的也不能因多个方案重复计市值。
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              暂无可核算数据。仅显示已登记的成员，不显示虚构的持仓、市值或收益。保险类成员不自动进入投资绩效范围。
            </CardContent>
          </Card>
        </>
      )}
    </Layout>
  );
}
