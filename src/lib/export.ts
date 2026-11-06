export type SvgSize = {
  height: number;
  width: number;
};

type SvgSizeAttributes = {
  height: string | null;
  viewBox: string | null;
  width: string | null;
};

export type PngExport = {
  dataUrl: string;
  // True when the diagram was too large for the preferred scale, so its detail is reduced.
  wasReduced: boolean;
};

const PREFERRED_SCALE = 2;
// Chromium's own canvas limits are higher, but a canvas this size already needs about 400 MB.
const MAX_CANVAS_SIDE = 16_384;
const MAX_CANVAS_PIXELS = 100_000_000;

// Only absolute lengths count. Mermaid often writes width="100%", which isn't 100 pixels.
function parseAbsoluteLength(rawValue: string | null): number | null {
  if (!rawValue || !/^\s*[\d.]+\s*(px)?\s*$/.test(rawValue)) {
    return null;
  }

  const value = Number.parseFloat(rawValue);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function parseSvgSize({ height, viewBox, width }: SvgSizeAttributes): SvgSize | null {
  const viewBoxParts = viewBox?.trim().split(/[\s,]+/).map(Number) ?? [];
  if (viewBoxParts.length === 4 && viewBoxParts[2] > 0 && viewBoxParts[3] > 0) {
    return { height: viewBoxParts[3], width: viewBoxParts[2] };
  }

  const absoluteWidth = parseAbsoluteLength(width);
  const absoluteHeight = parseAbsoluteLength(height);
  return absoluteWidth && absoluteHeight ? { height: absoluteHeight, width: absoluteWidth } : null;
}

export function getPngScale(size: SvgSize): number {
  return Math.min(
    PREFERRED_SCALE,
    MAX_CANVAS_SIDE / size.width,
    MAX_CANVAS_SIDE / size.height,
    Math.sqrt(MAX_CANVAS_PIXELS / (size.width * size.height))
  );
}

// Mermaid's markup comes from HTML serialization, which isn't always valid XML, so it's read as HTML.
function parseSvgElement(svgMarkup: string): SVGSVGElement | null {
  return new DOMParser().parseFromString(svgMarkup, "text/html").querySelector("svg");
}

export function getSvgSize(svgMarkup: string): SvgSize | null {
  const svgElement = svgMarkup ? parseSvgElement(svgMarkup) : null;
  if (!svgElement) {
    return null;
  }

  return parseSvgSize({
    height: svgElement.getAttribute("height"),
    viewBox: svgElement.getAttribute("viewBox"),
    width: svgElement.getAttribute("width")
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The diagram couldn't be turned into an image."));
    image.src = url;
  });
}

// The browser engine draws the image, so HTML labels and modern CSS come out as they do in the preview.
export async function renderSvgToPng(svgMarkup: string, background: string): Promise<PngExport> {
  const svgElement = parseSvgElement(svgMarkup);
  const size = svgElement ? getSvgSize(svgMarkup) : null;
  if (!svgElement || !size) {
    throw new Error("The diagram has no size to export.");
  }

  const scale = getPngScale(size);
  const canvasWidth = Math.ceil(size.width * scale);
  const canvasHeight = Math.ceil(size.height * scale);

  svgElement.setAttribute("width", String(canvasWidth));
  svgElement.setAttribute("height", String(canvasHeight));
  // Mermaid's max-width would otherwise cap the image at the diagram's unscaled width.
  svgElement.style.removeProperty("max-width");

  // A data URL rather than a blob URL, because a blob URL with HTML labels makes the canvas unreadable.
  const serialized = new XMLSerializer().serializeToString(svgElement);
  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`);

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("The diagram is too large to turn into an image.");
  }

  context.fillStyle = background;
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  context.drawImage(image, 0, 0, canvasWidth, canvasHeight);

  const dataUrl = canvas.toDataURL("image/png");
  if (!dataUrl.startsWith("data:image/png")) {
    throw new Error("The diagram is too large to turn into an image.");
  }

  return { dataUrl, wasReduced: scale < PREFERRED_SCALE };
}
