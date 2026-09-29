import { ArrowLeft, ArrowRight, Database, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button, buttonVariants } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  type Config,
  emptyGrid,
  type GridConfig,
  gridLevels,
  type Instrument,
  type Plan,
  readPlans,
  savePlans,
  validate,
} from "../lib/plans";
import { purposes, readAssets, readPortfolios } from "../lib/portfolio";

function usePlans() {
  const [plans, setPlans] = useState(readPlans);
  useEffect(() => {
    const refresh = () => setPlans(readPlans());
    window.addEventListener("storage", refresh);
    window.addEventListener("plans-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("plans-changed", refresh);
    };
  }, []);
  return plans;
}
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link className="font-semibold" to="/">
            WealthPlans
          </Link>
          <nav className="flex items-center gap-2">
            <Link className={buttonVariants({ variant: "ghost", size: "sm" })} to="/">
              总览
            </Link>
            <Link className={buttonVariants({ variant: "ghost", size: "sm" })} to="/data-center">
              <Database className="size-4" /> 数据中心
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="mx-auto max-w-7xl px-4 py-8 text-xs text-muted-foreground sm:px-6">
        方案配置仅保存在此浏览器，不与数据中心或其他设备自动同步；尚未建立持仓和收益账本。
      </footer>
    </div>
  );
}
const kinds: Record<Instrument["kind"], string> = {
  etf: "ETF",
  fund: "场外基金",
  wealth: "银行理财",
  other: "其他",
};
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <Label className="grid gap-2 text-sm">
      {label}
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Label>
  );
}
function InstrumentFields({
  item,
  onChange,
  grid = false,
}: {
  item: Instrument;
  onChange: (value: Instrument) => void;
  grid?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Label className="grid gap-2 text-sm">
        产品类型
        <select
          className="h-9 rounded-md border bg-background px-3"
          value={item.kind}
          onChange={(event) =>
            onChange({
              ...item,
              kind: event.target.value as Instrument["kind"],
            })
          }
        >
          {(grid ? ["etf" as const] : (Object.keys(kinds) as Instrument["kind"][])).map((kind) => (
            <option key={kind} value={kind}>
              {kinds[kind]}
            </option>
          ))}
        </select>
      </Label>
      <Field
        label="标的代码"
        placeholder="按产品公布的代码填写"
        value={item.symbol}
        onChange={(symbol) => onChange({ ...item, symbol })}
      />
      <Field
        label="标的名称"
        placeholder="产品名称"
        value={item.name}
        onChange={(name) => onChange({ ...item, name })}
      />
    </div>
  );
}
function ConfigFields({ config, onChange }: { config: Config; onChange: (value: Config) => void }) {
  if (config.type === "regular") {
    const update = (instruments: Instrument[]) =>
      onChange({ type: "regular", data: { instruments } });
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          普通方案记录关注标的，不等于已经买入或持有。
        </p>
        {config.data.instruments.map((item, index) => (
          <div className="rounded-lg border p-4" key={index}>
            <div className="mb-3 flex items-center justify-between text-sm font-medium">
              <span>标的 {index + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => update(config.data.instruments.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" /> 移除
              </Button>
            </div>
            <InstrumentFields
              item={item}
              onChange={(next) =>
                update(config.data.instruments.map((current, i) => (i === index ? next : current)))
              }
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            update([...config.data.instruments, { kind: "fund", symbol: "", name: "" }])
          }
        >
          <Plus className="size-4" /> 添加标的
        </Button>
      </div>
    );
  }
  const grid = config.data;
  const update = (data: GridConfig) => onChange({ type: "grid", data });
  const numberField = (label: string, key: keyof GridConfig, placeholder?: string) => (
    <Field
      label={label}
      value={String(grid[key])}
      placeholder={placeholder}
      onChange={(value) => update({ ...grid, [key]: key === "intervals" ? Number(value) : value })}
    />
  );
  const levels = gridLevels(grid);
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        仅配置无杠杆、单只 ETF 的静态网格；计划档位不代表已触发、已委托或已成交。
      </p>
      <InstrumentFields
        grid
        item={grid.instrument}
        onChange={(instrument) => update({ ...grid, instrument })}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Label className="grid gap-2 text-sm">
          网格方式
          <select
            className="h-9 rounded-md border bg-background px-3"
            value={grid.mode}
            onChange={(event) =>
              update({
                ...grid,
                mode: event.target.value as GridConfig["mode"],
              })
            }
          >
            <option value="arithmetic">等差</option>
            <option value="geometric">等比</option>
          </select>
        </Label>
        {numberField("价格下界", "lower")}
        {numberField("价格上界", "upper")}
        {numberField("区间数（产生 n+1 个边界价格）", "intervals")}
        {numberField("价格最小变动单位", "tick", "依产品与市场规则填写")}
        {numberField("基准价", "basePrice")}
        {numberField("交易数量单位", "quantityStep", "依产品与市场规则填写")}
        {numberField("每档数量", "quantityPerGrid")}
        {numberField("初始底仓数量", "initialQuantity")}
        {numberField("备用资金（¥）", "reserve")}
        {numberField("最大投入（¥）", "maximum")}
        <Label className="grid gap-2 text-sm">
          超出区间
          <select
            className="h-9 rounded-md border bg-background px-3"
            value={grid.outOfRange}
            onChange={(event) =>
              update({
                ...grid,
                outOfRange: event.target.value as GridConfig["outOfRange"],
              })
            }
          >
            <option value="pause">暂停新计划</option>
            <option value="review">人工复核</option>
          </select>
        </Label>
      </div>
      <div className="rounded-lg border bg-muted/30 p-4">
        <h3 className="font-medium">档位预览（仅计划）</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          按填写的价格步长四舍五入；预览不计算成交利润。最大投入按上界价格 ×（初始底仓＋区间数 ×
          每档数量）＋备用资金做保守预检；不含费用，不代表实际占用。
        </p>
        {levels.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {levels.map((value, index) => (
              <Badge key={`${index}-${value}`} variant="outline">
                {index + 1} · {value}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
export function PlanForm({
  plan,
  onDone,
  initialType = "regular",
  initialPurpose,
}: {
  plan?: Plan;
  onDone: (id: string) => void;
  initialType?: Config["type"];
  initialPurpose?: import("../lib/portfolio").Purpose;
}) {
  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [purpose, setPurpose] = useState<import("../lib/portfolio").Purpose>(
    plan?.purpose ?? initialPurpose ?? "steady",
  );
  const [config, setConfig] = useState<Config>(
    plan?.draft ??
      (initialType === "grid"
        ? { type: "grid", data: emptyGrid() }
        : {
            type: "regular",
            data: { instruments: [{ kind: "fund", symbol: "", name: "" }] },
          }),
  );
  const [error, setError] = useState("");
  const owner = plan && readPortfolios().find((p) => p.planIds.includes(plan.id));
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return setError("请填写方案名称。");
    if (
      plan &&
      readPortfolios().some(
        (p) => p.planIds.includes(plan.id) && p.purpose && p.purpose !== purpose,
      )
    )
      return setError("方案已归属组合，请先从组合移出或保持分类一致。");
    const issue = validate(config);
    if (issue) return setError(issue);
    const now = new Date().toISOString();
    const saved: Plan = plan
      ? {
          ...plan,
          purpose,
          name: name.trim(),
          description: description.trim(),
          draft: config,
        }
      : {
          id: crypto.randomUUID(),
          purpose,
          name: name.trim(),
          description: description.trim(),
          createdAt: now,
          status: "draft",
          draft: config,
          versions: [],
        };
    try {
      const next = plan
        ? readPlans().map((item) => (item.id === plan.id ? saved : item))
        : [saved, ...readPlans()];
      savePlans(next);
      onDone(saved.id);
    } catch {
      setError("浏览器保存失败，请检查存储权限。");
    }
  }
  return (
    <form className="space-y-6" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="方案名称" value={name} onChange={setName} placeholder="例如：长期基金组合" />
        <Field
          label="方案说明（选填）"
          value={description}
          onChange={setDescription}
          placeholder="投资目标与计划"
        />
      </div>
      <Label className="grid max-w-sm gap-2 text-sm">
        资金用途
        <select
          className="h-9 rounded-md border bg-background px-3"
          value={purpose}
          onChange={(event) => setPurpose(event.target.value as import("../lib/portfolio").Purpose)}
        >
          {Object.entries(purposes).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </Label>
      <Label className="grid max-w-sm gap-2 text-sm">
        方案类型
        <select
          className="h-9 rounded-md border bg-background px-3"
          value={config.type}
          disabled={Boolean(plan?.versions.length || owner)}
          onChange={(event) => {
            setError("");
            setConfig(
              event.target.value === "grid"
                ? { type: "grid", data: emptyGrid() }
                : {
                    type: "regular",
                    data: {
                      instruments: [{ kind: "fund", symbol: "", name: "" }],
                    },
                  },
            );
          }}
        >
          <option value="regular">普通投资方案</option>
          <option value="grid">网格方案</option>
        </select>
      </Label>
      {Boolean(plan?.versions.length) && (
        <p className="text-sm text-muted-foreground">
          已发布方案不能更改类型。编辑保存的是草稿，发布时会创建新版本。
        </p>
      )}
      <ConfigFields
        config={config}
        onChange={(value) => {
          setConfig(value);
          setError("");
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button type="submit">{plan ? "保存草稿" : "创建方案"}</Button>
        <Link
          to={plan ? `/plans/${plan.id}` : "/"}
          className={buttonVariants({ variant: "outline" })}
        >
          取消
        </Link>
      </div>
    </form>
  );
}
export function PlansPage() {
  const plans = usePlans();
  const portfolios = readPortfolios();
  const assets = readAssets();
  return (
    <Shell>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-9 sm:px-6">
        <div className="rounded-2xl border bg-card p-8">
          <Badge variant="secondary">个人金融工作台</Badge>
          <h1 className="mt-4 text-3xl font-semibold">方案与组合</h1>
          <p className="mt-3 text-muted-foreground">
            分别管理普通投资方案与网格规则。公开行情在数据中心；方案配置不代表真实持仓。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className={buttonVariants()} to="/portfolios/new">
              新建组合
            </Link>
            <Link className={buttonVariants({ variant: "outline" })} to="/assets">
              登记资产
            </Link>
            <Link className={buttonVariants({ variant: "outline" })} to="/plans/new">
              <Plus className="size-4" /> 新建方案
            </Link>
            <Link className={buttonVariants({ variant: "outline" })} to="/data-center">
              数据中心 <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">组合总览</h2>
            <Link to="/portfolios" className="text-sm underline">
              管理组合
            </Link>
          </div>
          {portfolios.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {portfolios.map((portfolio) => (
                <Link key={portfolio.id} to={`/portfolios/${portfolio.id}`}>
                  <Card className="h-full hover:border-slate-400">
                    <CardHeader>
                      <CardTitle>{portfolio.name}</CardTitle>
                      <CardDescription>{portfolio.goal || "未填写投资目标"}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p>
                        {portfolio.assetIds.length} 项资产 · {portfolio.planIds.length} 个方案 · CNY
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {portfolio.assetIds.map((id) => {
                          const asset = assets.find((a) => a.id === id);
                          return (
                            asset && (
                              <Badge variant="outline" key={id}>
                                {purposes[asset.purpose]} · {asset.instrument.name}
                              </Badge>
                            )
                          );
                        })}
                      </div>
                      <p>收益：暂无可核算数据</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              尚无组合。可以将单个理财、基金以及独立网格方案纳入组合。
            </div>
          )}
        </section>
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">独立方案</h2>
          {plans.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <Link key={plan.id} to={`/plans/${plan.id}`}>
                  <Card className="h-full hover:border-slate-400">
                    <CardHeader>
                      <div className="flex gap-2">
                        <Badge variant="outline">
                          {plan.draft.type === "grid" ? "网格方案" : "普通方案"}
                        </Badge>
                        <Badge variant="secondary">
                          {plan.status === "draft"
                            ? "草稿"
                            : plan.status === "active"
                              ? "生效"
                              : "暂停"}
                        </Badge>
                      </div>
                      <CardTitle className="mt-2">{plan.name}</CardTitle>
                      <CardDescription>{plan.description || "未填写说明"}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      {plan.draft.type === "regular"
                        ? `${plan.draft.data.instruments.length} 个标的`
                        : `${plan.draft.data.instrument.symbol} · ${plan.draft.data.intervals} 个区间`}{" "}
                      · {plan.versions.length} 个已发布版本
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
              还没有方案。创建时请选择类型并填入实际配置。
            </div>
          )}
        </section>
      </main>
    </Shell>
  );
}
export function PlanNewPage() {
  const navigate = useNavigate();
  return (
    <Shell>
      <main className="mx-auto max-w-5xl px-4 py-9 sm:px-6">
        <Link className="text-sm text-muted-foreground" to="/">
          ← 返回总览
        </Link>
        <Card className="mt-5">
          <CardHeader>
            <CardTitle>新建方案</CardTitle>
            <CardDescription>先选类型，再填写对应的标的或网格参数。</CardDescription>
          </CardHeader>
          <CardContent>
            <PlanForm onDone={(id) => navigate(`/plans/${id}`)} />
          </CardContent>
        </Card>
      </main>
    </Shell>
  );
}
export function PlanEditPage() {
  const { id } = useParams();
  const plans = usePlans();
  const navigate = useNavigate();
  const plan = plans.find((item) => item.id === id);
  return (
    <Shell>
      <main className="mx-auto max-w-5xl px-4 py-9 sm:px-6">
        <Link className="text-sm text-muted-foreground" to={`/plans/${id}`}>
          ← 返回详情
        </Link>
        {plan ? (
          <Card className="mt-5">
            <CardHeader>
              <CardTitle>编辑方案草稿</CardTitle>
            </CardHeader>
            <CardContent>
              <PlanForm
                key={plan.id}
                plan={plan}
                onDone={(savedId) => navigate(`/plans/${savedId}`)}
              />
            </CardContent>
          </Card>
        ) : (
          <p className="mt-5">未找到方案</p>
        )}
      </main>
    </Shell>
  );
}
export function PlanDetailPage() {
  const { id } = useParams();
  const plan = usePlans().find((item) => item.id === id);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  function publish() {
    if (!plan) return;
    const issue = validate(plan.draft);
    if (issue) return setError(issue);
    if (plan.versions.length && !reason.trim()) return setError("发布新版本时请填写变更原因。");
    if (
      plan.versions.length &&
      JSON.stringify(plan.versions.at(-1)?.config) === JSON.stringify(plan.draft)
    )
      return setError("配置与上一版本相同，无需重复发布。");
    const now = new Date().toISOString();
    const updated: Plan = {
      ...plan,
      status: "active",
      versions: [
        ...plan.versions,
        {
          number: plan.versions.length + 1,
          effectiveAt: now,
          reason: reason.trim() || "首次发布",
          config: structuredClone(plan.draft),
        },
      ],
    };
    try {
      savePlans(readPlans().map((item) => (item.id === id ? updated : item)));
      setReason("");
      setError("");
    } catch {
      setError("浏览器保存失败，请检查存储权限。");
    }
  }
  function changeStatus(status: Plan["status"]) {
    if (!plan) return;
    try {
      savePlans(readPlans().map((item) => (item.id === id ? { ...item, status } : item)));
      setError("");
    } catch {
      setError("浏览器保存失败。");
    }
  }
  return (
    <Shell>
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-9 sm:px-6">
        <Link className="inline-flex items-center gap-2 text-sm text-muted-foreground" to="/">
          <ArrowLeft className="size-4" /> 返回总览
        </Link>
        {!plan ? (
          <Card>
            <CardHeader>
              <CardTitle>未找到该方案</CardTitle>
            </CardHeader>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex gap-2">
                  <Badge>{plan.draft.type === "grid" ? "网格方案" : "普通方案"}</Badge>
                  <Badge variant="secondary">
                    {plan.status === "draft" ? "草稿" : plan.status === "active" ? "生效" : "暂停"}
                  </Badge>
                </div>
                <CardTitle className="mt-3 text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description || "未填写方案说明"}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  to={`/plans/${plan.id}/edit`}
                >
                  编辑配置
                </Link>
                {plan.status === "active" && (
                  <Button variant="outline" onClick={() => changeStatus("paused")}>
                    暂停方案
                  </Button>
                )}
                {plan.status === "paused" && (
                  <Button variant="outline" onClick={() => changeStatus("active")}>
                    恢复方案
                  </Button>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>配置草稿</CardTitle>
                <CardDescription>
                  草稿可以修改；已发布版本只读保存。以下都是计划，不是持仓或成交。
                </CardDescription>
              </CardHeader>
              <CardContent>
                {plan.draft.type === "regular" ? (
                  <div className="space-y-2">
                    {plan.draft.data.instruments.map((item) => (
                      <div className="rounded-lg border p-3 text-sm" key={item.symbol}>
                        {kinds[item.kind]} · {item.name} · {item.symbol}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 text-sm">
                    <p>
                      {plan.draft.data.instrument.name} · {plan.draft.data.instrument.symbol} ·{" "}
                      {plan.draft.data.mode === "arithmetic" ? "等差" : "等比"} ·{" "}
                      {plan.draft.data.intervals} 个区间
                    </p>
                    <p>
                      区间 {plan.draft.data.lower}～{plan.draft.data.upper}
                      ；基准价 {plan.draft.data.basePrice}；每档 {plan.draft.data.quantityPerGrid}{" "}
                      份；初始底仓 {plan.draft.data.initialQuantity} 份；备用资金 ¥
                      {plan.draft.data.reserve}；最大投入 ¥{plan.draft.data.maximum}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {gridLevels(plan.draft.data).map((level, index) => (
                        <Badge variant="outline" key={`${index}-${level}`}>
                          {index + 1} · {level}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>发布配置版本</CardTitle>
                <CardDescription>
                  发布后保存不可改写的参数快照；不触发交易，修改后的草稿须再次发布才成为生效版本。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {plan.versions.length > 0 && (
                  <Field
                    label="变更原因"
                    value={reason}
                    onChange={setReason}
                    placeholder="说明本次调整了什么"
                  />
                )}
                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
                <Button onClick={publish}>
                  {plan.versions.length ? "发布新版本" : "发布首个版本"}
                </Button>
                <div className="space-y-2">
                  {[...plan.versions].reverse().map((version) => (
                    <details className="rounded-lg border p-3 text-sm" key={version.number}>
                      <summary className="cursor-pointer">
                        v{version.number} · {new Date(version.effectiveAt).toLocaleString("zh-CN")}{" "}
                        · {version.reason}
                      </summary>
                      <div className="mt-3 space-y-2 text-sm">
                        {version.config.type === "regular" ? (
                          version.config.data.instruments.map((item) => (
                            <p key={item.symbol}>
                              {kinds[item.kind]} · {item.name} · {item.symbol}
                            </p>
                          ))
                        ) : (
                          <>
                            <p>
                              {version.config.data.instrument.name} ·{" "}
                              {version.config.data.instrument.symbol} ·{" "}
                              {version.config.data.mode === "arithmetic" ? "等差" : "等比"} ·{" "}
                              {version.config.data.intervals} 个区间
                            </p>
                            <p>
                              价格 {version.config.data.lower}～{version.config.data.upper}，基准价{" "}
                              {version.config.data.basePrice}，价格步长 {version.config.data.tick}
                              ；每档 {version.config.data.quantityPerGrid} 份，交易单位{" "}
                              {version.config.data.quantityStep} 份；初始底仓{" "}
                              {version.config.data.initialQuantity} 份，备用资金 ¥
                              {version.config.data.reserve}，最大投入 ¥{version.config.data.maximum}
                              ；超出区间：
                              {version.config.data.outOfRange === "pause"
                                ? "暂停新计划"
                                : "人工复核"}
                              。
                            </p>
                            <p>
                              档位：
                              {gridLevels(version.config.data).join(" / ")}
                            </p>
                          </>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>投资执行与收益</CardTitle>
                <CardDescription>
                  尚未接入账户、成交、资金、持仓与对账，不能据方案配置计算实际收益。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link className={buttonVariants({ variant: "outline" })} to="/data-center">
                  <Database className="size-4" /> 查看公开数据
                </Link>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </Shell>
  );
}
