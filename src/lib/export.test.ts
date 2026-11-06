import { describe, expect, it } from "vitest";
import { getPngScale, parseSvgSize } from "./export";

describe("parseSvgSize", () => {
  it("prefers the viewBox over the width and height", () => {
    expect(parseSvgSize({ height: "10", viewBox: "-8 -8 812 1500", width: "20" }))
      .toEqual({ height: 1500, width: 812 });
  });

  it("does not read a percentage width as pixels", () => {
    expect(parseSvgSize({ height: "100%", viewBox: null, width: "100%" })).toBeNull();
    expect(parseSvgSize({ height: "400", viewBox: null, width: "100%" })).toBeNull();
  });

  it("falls back to absolute lengths", () => {
    expect(parseSvgSize({ height: "400px", viewBox: null, width: "812" }))
      .toEqual({ height: 400, width: 812 });
  });

  it("accepts a comma-separated viewBox and ignores an empty one", () => {
    expect(parseSvgSize({ height: null, viewBox: "0,0,30,40", width: null }))
      .toEqual({ height: 40, width: 30 });
    expect(parseSvgSize({ height: null, viewBox: "0 0 0 0", width: null })).toBeNull();
    expect(parseSvgSize({ height: null, viewBox: null, width: null })).toBeNull();
  });
});

describe("getPngScale", () => {
  it("uses double resolution for ordinary diagrams", () => {
    expect(getPngScale({ height: 900, width: 1400 })).toBe(2);
  });

  it("reduces the scale so a very long diagram still fits a canvas", () => {
    const scale = getPngScale({ height: 40_000, width: 300 });

    expect(scale).toBeCloseTo(0.4096);
    expect(40_000 * scale).toBeLessThanOrEqual(16_384);
  });

  it("reduces the scale so a very large diagram stays within the pixel budget", () => {
    const scale = getPngScale({ height: 12_000, width: 12_000 });

    expect(12_000 * scale * 12_000 * scale).toBeLessThanOrEqual(100_000_000 + 1);
  });
});
