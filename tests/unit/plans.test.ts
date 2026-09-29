import { describe, expect, it } from "vitest";
import { type GridConfig, gridLevels, validate } from "../../src/web/lib/plans";

const grid: GridConfig = {
	instrument: { kind: "etf", name: "测试标的", symbol: "TEST.ETF" },
	mode: "arithmetic",
	lower: "10",
	upper: "12",
	intervals: 2,
	tick: "0.01",
	quantityStep: "100",
	quantityPerGrid: "100",
	initialQuantity: "0",
	reserve: "0",
	maximum: "2400",
	basePrice: "11",
	outOfRange: "pause",
};
describe("plan configuration", () => {
	it("requires a real instrument in a regular plan", () => {
		expect(
			validate({ type: "regular", data: { instruments: [] } }),
		).toBeTruthy();
		expect(
			validate({
				type: "regular",
				data: {
					instruments: [{ kind: "fund", symbol: "123456", name: "测试产品" }],
				},
			}),
		).toBeNull();
	});
	it("prevents duplicate symbols", () => {
		expect(
			validate({
				type: "regular",
				data: {
					instruments: [
						{ kind: "fund", symbol: "A1", name: "a" },
						{ kind: "fund", symbol: "a1", name: "b" },
					],
				},
			}),
		).toMatch(/重复/);
	});
	it("previews n+1 boundaries without treating them as fills", () => {
		expect(gridLevels(grid)).toEqual(["10.00", "11.00", "12.00"]);
		expect(validate({ type: "grid", data: grid })).toBeNull();
	});
	it("rejects duplicate rounded levels and insufficient capital", () => {
		expect(
			validate({
				type: "grid",
				data: {
					...grid,
					lower: "10",
					upper: "10.01",
					basePrice: "10",
					intervals: 3,
				},
			}),
		).toMatch(/重复/);
		expect(
			validate({ type: "grid", data: { ...grid, maximum: "100" } }),
		).toMatch(/最大投入/);
	});
});
