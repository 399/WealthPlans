import { describe, expect, it } from "vitest";
import type { Plan } from "../../src/web/lib/plans";
import { type Asset, type Portfolio, validateMembership } from "../../src/web/lib/portfolio";

const asset: Asset = {
  id: "asset-1",
  instrument: { kind: "wealth", symbol: "P001", name: "测试理财" },
  purpose: "steady",
  note: "",
  createdAt: "2026-09-28",
};
const plan: Plan = {
  id: "plan-1",
  name: "测试网格",
  purpose: "steady",
  description: "",
  createdAt: "2026-09-28",
  status: "draft",
  draft: { type: "regular", data: { instruments: [asset.instrument] } },
  versions: [],
};
const portfolio: Portfolio = {
  id: "p1",
  name: "测试组合",
  goal: "",
  risk: "",
  purpose: "steady",
  currency: "CNY",
  createdAt: "2026-09-28",
  assetIds: [asset.id],
  planIds: [plan.id],
};
describe("组合归属", () => {
  it("允许同组合同时引用资产和独立方案", () => {
    expect(validateMembership(portfolio, [], [asset], [plan])).toBeNull();
  });
  it("不允许同一资产或方案跨组合重复归属", () => {
    expect(validateMembership({ ...portfolio, id: "p2" }, [portfolio], [asset], [plan])).toMatch(
      /不能重复/,
    );
  });
  it("组合成员必须属于同一资金用途", () => {
    expect(validateMembership({ ...portfolio, purpose: "longterm" }, [], [asset], [plan])).toMatch(
      /同一资金用途/,
    );
    expect(
      validateMembership(
        portfolio,
        [],
        [{ ...asset, purpose: "steady" }],
        [{ ...plan, purpose: "longterm" }],
      ),
    ).toMatch(/方案必须/);
  });
  it("编辑原组合不视作重复，成员丢失时拒绝", () => {
    expect(validateMembership(portfolio, [portfolio], [asset], [plan])).toBeNull();
    expect(validateMembership(portfolio, [portfolio], [], [plan])).toMatch(/不存在/);
  });
});
