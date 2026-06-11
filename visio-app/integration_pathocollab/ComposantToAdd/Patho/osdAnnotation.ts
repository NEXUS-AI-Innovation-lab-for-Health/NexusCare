import OpenSeadragon from "openseadragon";
import type { Annotation, CircleAnnotation, RectAnnotation } from "./types";

export function storageKey(imageKey: string): string {
  return `osd:ann:${imageKey}`;
}

export function loadAnnotations(imageKey: string): Annotation[] {
  try {
    const raw = localStorage.getItem(storageKey(imageKey));
    return raw ? (JSON.parse(raw) as Annotation[]) : [];
  } catch {
    return [];
  }
}

export function saveAnnotations(imageKey: string, annotations: Annotation[]): void {
  localStorage.setItem(storageKey(imageKey), JSON.stringify(annotations));
}

// Convertit un rectangle image (pixels image) en Rect viewport pour addOverlay
export function imageRectToViewportRect(
  viewer: OpenSeadragon.Viewer,
  rect: Pick<RectAnnotation, "x" | "y" | "w" | "h">,
): OpenSeadragon.Rect {
  // imageToViewportRectangle(x, y, w, h) attend des coords en pixels image
  return viewer.viewport.imageToViewportRectangle(rect.x, rect.y, rect.w, rect.h);
}

export function imagePointToViewportPoint(
  viewer: OpenSeadragon.Viewer,
  p: { x: number; y: number },
): OpenSeadragon.Point {
  return viewer.viewport.imageToViewportCoordinates(p.x, p.y);
}

export function imageEllipseToViewportRect(
  viewer: OpenSeadragon.Viewer,
  e: Pick<CircleAnnotation, "cx" | "cy" | "rx" | "ry">,
): OpenSeadragon.Rect {
  // bounding box ellipse
  return viewer.viewport.imageToViewportRectangle(
    e.cx - e.rx,
    e.cy - e.ry,
    e.rx * 2,
    e.ry * 2,
  );
}

export function uuid(): string {
  // suffisant pour debug/POC
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
