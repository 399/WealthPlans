import type { Instrument, Plan } from "./plans";

export type Purpose = "liquid" | "steady" | "longterm" | "insurance";
export const purposes: Record<Purpose, string> = {
  liquid: "活期",
  steady: "稳健",
  longterm: "长期",
  insurance: "保险",
};
export type Asset = {
  id: string;
  instrument: Instrument;
  purpose: Purpose;
  note: string;
  createdAt: string;
};
export type Portfolio = {
  id: string;
  name: string;
  goal: string;
  risk: string;
  purpose?: Purpose;
  currency: "CNY";
  createdAt: string;
  assetIds: string[];
  planIds: string[];
};
const assetKey = "wealthplans:assets:v1";
const portfolioKey = "wealthplans:portfolios:v1";
const isPurpose = (value: unknown): value is Purpose =>
  typeof value === "string" && Object.hasOwn(purposes, value);
export function readAssets(): Asset[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(assetKey) ?? "[]");
    return Array.isArray(value)
      ? value.filter(
          (item): item is Asset =>
            typeof item?.id === "string" &&
            typeof item?.instrument?.symbol === "string" &&
            typeof item?.instrument?.name === "string" &&
            isPurpose(item?.purpose) &&
            typeof item?.note === "string" &&
            typeof item?.createdAt === "string",
        )
      : [];
  } catch {
    return [];
  }
}
export function readPortfolios(): Portfolio[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(portfolioKey) ?? "[]");
    return Array.isArray(value)
      ? value.filter(
          (item): item is Portfolio =>
            typeof item?.id === "string" &&
            typeof item?.name === "string" &&
            typeof item?.goal === "string" &&
            typeof item?.risk === "string" &&
            item?.currency === "CNY" &&
            (item?.purpose === undefined || isPurpose(item.purpose)) &&
            Array.isArray(item?.assetIds) &&
            Array.isArray(item?.planIds) &&
            item.assetIds.every((id: unknown) => typeof id === "string") &&
            item.planIds.every((id: unknown) => typeof id === "string"),
        )
      : [];
  } catch {
    return [];
  }
}
export function saveAssets(value: Asset[]) {
  localStorage.setItem(assetKey, JSON.stringify(value));
  window.dispatchEvent(new Event("portfolio-changed"));
}
export function savePortfolios(value: Portfolio[]) {
  localStorage.setItem(portfolioKey, JSON.stringify(value));
  window.dispatchEvent(new Event("portfolio-changed"));
}
export function validateMembership(
  candidate: Portfolio,
  all: Portfolio[],
  assets: Asset[],
  plans: Plan[],
): string | null {
  if (!candidate.name.trim()) return "请填写组合名称。";
  if (!candidate.purpose || !isPurpose(candidate.purpose)) return "请选择组合的资金用途。";
  if (
    new Set(candidate.assetIds).size !== candidate.assetIds.length ||
    new Set(candidate.planIds).size !== candidate.planIds.length
  )
    return "组合成员不能重复。";
  if (
    candidate.assetIds.some((id) => !assets.some((asset) => asset.id === id)) ||
    candidate.planIds.some((id) => !plans.some((plan) => plan.id === id))
  )
    return "组合包含不存在的资产或方案，请重新选择。";
  if (
    candidate.assetIds.some(
      (id) => assets.find((asset) => asset.id === id)?.purpose !== candidate.purpose,
    )
  )
    return "组合中的资产必须与组合属于同一资金用途。";
  if (
    candidate.planIds.some(
      (id) => plans.find((plan) => plan.id === id)?.purpose !== candidate.purpose,
    )
  )
    return "组合中的方案必须与组合属于同一资金用途。";
  if (
    all.some(
      (other) =>
        other.id !== candidate.id &&
        (candidate.assetIds.some((id) => other.assetIds.includes(id)) ||
          candidate.planIds.some((id) => other.planIds.includes(id))),
    )
  )
    return "资产或方案已归属其他组合，不能重复纳入统计范围；请先从原组合移除。";
  return null;
}
export function planPurpose(
  planId: string,
  portfolios: Portfolio[],
  assets: Asset[],
): Purpose | null {
  const portfolio = portfolios.find((item) => item.planIds.includes(planId));
  if (!portfolio) return null;
  const members = portfolio.assetIds
    .map((id) => assets.find((asset) => asset.id === id)?.purpose)
    .filter(Boolean);
  return members.length === 1 ? (members[0] ?? null) : null;
}
