export type Instrument = {
  symbol: string;
  name: string;
  kind: "etf" | "fund" | "wealth" | "other";
};
export type RegularConfig = { instruments: Instrument[] };
export type GridConfig = {
  instrument: Instrument;
  mode: "arithmetic" | "geometric";
  lower: string;
  upper: string;
  intervals: number;
  tick: string;
  quantityStep: string;
  quantityPerGrid: string;
  initialQuantity: string;
  reserve: string;
  maximum: string;
  basePrice: string;
  outOfRange: "pause" | "review";
};
export type Config = { type: "regular"; data: RegularConfig } | { type: "grid"; data: GridConfig };
export type PlanVersion = {
  number: number;
  effectiveAt: string;
  reason: string;
  config: Config;
};
export type Plan = {
  id: string;
  purpose?: "liquid" | "steady" | "longterm" | "insurance";

  name: string;
  description: string;
  createdAt: string;
  status: "draft" | "active" | "paused";
  draft: Config;
  versions: PlanVersion[];
};
const key = "wealthplans:plans:v2";
const legacyKey = "wealthplans:plans:v1";

export function readPlans(): Plan[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (Array.isArray(saved)) return saved.filter(isPlan);
    // Preserve existing browser-only names rather than discarding v1 plans.
    const old: unknown = JSON.parse(localStorage.getItem(legacyKey) ?? "[]");
    return Array.isArray(old)
      ? old.filter(isLegacy).map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          createdAt: item.createdAt,
          status: "draft" as const,
          draft: { type: "regular" as const, data: { instruments: [] } },
          versions: [],
        }))
      : [];
  } catch {
    return [];
  }
}
function isLegacy(item: unknown): item is {
  id: string;
  name: string;
  description: string;
  createdAt: string;
} {
  return (
    typeof item === "object" &&
    item !== null &&
    "id" in item &&
    typeof item.id === "string" &&
    "name" in item &&
    typeof item.name === "string" &&
    "description" in item &&
    typeof item.description === "string" &&
    "createdAt" in item &&
    typeof item.createdAt === "string"
  );
}
function isPlan(item: unknown): item is Plan {
  return (
    isLegacy(item) &&
    "status" in item &&
    ["draft", "active", "paused"].includes(String(item.status)) &&
    "draft" in item &&
    typeof item.draft === "object" &&
    item.draft !== null &&
    "type" in item.draft &&
    ["regular", "grid"].includes(String(item.draft.type)) &&
    "versions" in item &&
    Array.isArray(item.versions)
  );
}
export function savePlans(plans: Plan[]): void {
  localStorage.setItem(key, JSON.stringify(plans));
  window.dispatchEvent(new Event("plans-changed"));
}
export function emptyGrid(): GridConfig {
  return {
    instrument: { symbol: "", name: "", kind: "etf" },
    mode: "arithmetic",
    lower: "",
    upper: "",
    intervals: 5,
    tick: "",
    quantityStep: "",
    quantityPerGrid: "",
    initialQuantity: "0",
    reserve: "0",
    maximum: "",
    basePrice: "",
    outOfRange: "pause",
  };
}
export function decimal(value: string): boolean {
  return /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value.trim());
}
export function positive(value: string): boolean {
  return decimal(value) && Number(value) > 0 && Number.isFinite(Number(value));
}
export function validInstrument(item: Instrument): boolean {
  return (
    /^[A-Za-z0-9._-]{2,32}$/.test(item.symbol.trim()) &&
    item.name.trim().length > 0 &&
    item.name.trim().length <= 80
  );
}
function multiple(value: string, step: string): boolean {
  const places = Math.max((value.split(".")[1] ?? "").length, (step.split(".")[1] ?? "").length);
  if (places > 12) return false;
  const unit = BigInt(10) ** BigInt(places);
  const asInteger = (s: string) => {
    const [whole, frac = ""] = s.split(".");
    return BigInt(whole) * unit + BigInt(frac.padEnd(places, "0") || "0");
  };
  return asInteger(value) % asInteger(step) === BigInt(0);
}
export function gridLevels(grid: GridConfig): string[] {
  const lower = Number(grid.lower),
    upper = Number(grid.upper),
    tick = Number(grid.tick);
  if (
    !positive(grid.lower) ||
    !positive(grid.upper) ||
    !positive(grid.tick) ||
    !Number.isInteger(grid.intervals) ||
    grid.intervals < 1 ||
    grid.intervals > 100 ||
    upper <= lower
  )
    return [];
  const digits = (grid.tick.split(".")[1] ?? "").length;
  return Array.from({ length: grid.intervals + 1 }, (_, i) => {
    const raw =
      grid.mode === "arithmetic"
        ? lower + ((upper - lower) * i) / grid.intervals
        : lower * (upper / lower) ** (i / grid.intervals);
    return (Math.round(raw / tick) * tick).toFixed(digits);
  });
}
export function validate(config: Config): string | null {
  if (config.type === "regular") {
    if (config.data.instruments.length === 0) return "至少添加一个标的。";
    if (config.data.instruments.some((item) => !validInstrument(item)))
      return "请填写有效的标的代码和名称。";
    if (
      new Set(config.data.instruments.map((item) => item.symbol.trim().toUpperCase())).size !==
      config.data.instruments.length
    )
      return "同一个标的不能重复添加。";
    return null;
  }
  const g = config.data;
  if (!validInstrument(g.instrument)) return "请填写网格标的的代码和名称。";
  if (g.instrument.kind !== "etf") return "首期网格仅支持单只 ETF；其他产品请选择普通方案。";
  if (
    ![g.lower, g.upper, g.tick, g.quantityStep, g.quantityPerGrid, g.basePrice, g.maximum].every(
      positive,
    ) ||
    ![g.initialQuantity, g.reserve].every(decimal)
  )
    return "价格、数量单位、每档数量、最大投入须大于零；底仓和备用资金不能为负。";
  if (
    Number(g.upper) <= Number(g.lower) ||
    Number(g.basePrice) < Number(g.lower) ||
    Number(g.basePrice) > Number(g.upper)
  )
    return "上界须高于下界，基准价须处于区间内。";
  if (!Number.isInteger(g.intervals) || g.intervals < 1 || g.intervals > 100)
    return "区间数须为 1～100 的整数。";
  if (
    !Number.isSafeInteger(Number(g.quantityPerGrid)) ||
    !Number.isSafeInteger(Number(g.initialQuantity)) ||
    !Number.isSafeInteger(Number(g.quantityStep)) ||
    !multiple(g.quantityPerGrid, g.quantityStep) ||
    !multiple(g.initialQuantity, g.quantityStep)
  )
    return "每档数量和初始底仓须为交易数量单位的整数倍。";
  if (![g.lower, g.upper, g.basePrice].every((v) => multiple(v, g.tick)))
    return "上下边界和基准价须符合价格最小变动单位。";
  const levels = gridLevels(g);
  if (new Set(levels).size !== levels.length)
    return "按价格步长取整后出现重复档位，请减少区间数或调整边界。";
  // Conservative planning guard only; never used as a ledger or exact monetary calculation.
  const upperBound =
    Number(g.reserve) +
    Number(g.upper) * (Number(g.initialQuantity) + g.intervals * Number(g.quantityPerGrid));
  if (Number(g.maximum) < upperBound)
    return "最大投入不足以覆盖备用资金、初始底仓和全部网格档位的保守占用估算。";
  return null;
}
