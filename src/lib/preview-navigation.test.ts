import { describe, expect, it } from "vitest";
import { resolveWheelGesture } from "./preview-navigation";

const scroll = { ctrlKey: false, deltaX: 3, deltaY: 40, metaKey: false };

describe("resolveWheelGesture", () => {
  it("pans on a plain Mac scroll", () => {
    expect(resolveWheelGesture(scroll, "darwin")).toEqual({ deltaX: 3, deltaY: 40, kind: "pan" });
  });

  it("zooms on a Mac pinch and on Command+scroll", () => {
    expect(resolveWheelGesture({ ...scroll, ctrlKey: true }, "darwin").kind).toBe("zoom");
    expect(resolveWheelGesture({ ...scroll, metaKey: true }, "darwin").kind).toBe("zoom");
  });

  it("zooms on a plain scroll on Windows and Linux", () => {
    expect(resolveWheelGesture(scroll, "win32").kind).toBe("zoom");
    expect(resolveWheelGesture(scroll, "linux").kind).toBe("zoom");
  });

  it("zooms in on scroll up and out on scroll down", () => {
    const zoomIn = resolveWheelGesture({ ...scroll, deltaY: -120 }, "win32");
    const zoomOut = resolveWheelGesture({ ...scroll, deltaY: 120 }, "win32");

    expect(zoomIn.kind === "zoom" && zoomIn.factor).toBeGreaterThan(1);
    expect(zoomOut.kind === "zoom" && zoomOut.factor).toBeLessThan(1);
  });

  it("keeps tiny trackpad scrolls gentle", () => {
    const gesture = resolveWheelGesture({ ...scroll, deltaY: -2 }, "win32");

    expect(gesture.kind === "zoom" && gesture.factor).toBeCloseTo(1.002, 3);
  });

  it("limits how far one event can zoom", () => {
    const gesture = resolveWheelGesture({ ...scroll, ctrlKey: true, deltaY: -500 }, "win32");

    expect(gesture.kind === "zoom" && gesture.factor).toBe(1.33);
  });
});
