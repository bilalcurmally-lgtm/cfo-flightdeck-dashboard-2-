import type { PeriodGrain } from "../finance/types";
import { exportDateStamp, safeExportStem } from "./filenames";

export function trendPngFilename(
  sourceName: string,
  generatedAt = new Date(),
  grain: PeriodGrain = "monthly"
): string {
  return `${safeExportStem(sourceName)}-visible-${grain}-trend-${exportDateStamp(generatedAt)}.png`;
}

export async function svgToPngBlob(svg: string, width = 1200, height = 720): Promise<Blob> {
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas rendering is not available.");

    context.fillStyle = "#fffaf2";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return await canvasToPngBlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load trend SVG for PNG export."));
    image.src = url;
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create PNG export."));
    }, "image/png");
  });
}
