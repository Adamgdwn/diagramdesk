export type WheelGesture =
  | { deltaX: number; deltaY: number; kind: "pan" }
  | { factor: number; kind: "zoom" };

const MOUSE_WHEEL_ZOOM_RATE = 0.001;
const PINCH_ZOOM_RATE = 0.01;
const MIN_ZOOM_FACTOR = 0.75;
const MAX_ZOOM_FACTOR = 1.33;

type WheelInput = {
  ctrlKey: boolean;
  deltaX: number;
  deltaY: number;
  metaKey: boolean;
};

// Trackpads send many small scroll events where a mouse sends a few large ones, so zoom follows the
// distance scrolled rather than the number of events. Pinches arrive as ctrl+wheel on every platform.
// On a Mac, two-finger scrolling pans as it does everywhere else on the system; Command+scroll zooms.
export function resolveWheelGesture(input: WheelInput, platform: string): WheelGesture {
  if (platform === "darwin" && !input.ctrlKey && !input.metaKey) {
    return { deltaX: input.deltaX, deltaY: input.deltaY, kind: "pan" };
  }

  const rate = input.ctrlKey ? PINCH_ZOOM_RATE : MOUSE_WHEEL_ZOOM_RATE;
  const factor = Math.exp(-input.deltaY * rate);

  return {
    factor: Math.min(MAX_ZOOM_FACTOR, Math.max(MIN_ZOOM_FACTOR, factor)),
    kind: "zoom"
  };
}
