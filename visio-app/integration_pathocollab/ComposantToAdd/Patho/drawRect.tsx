import OpenSeadragon from "openseadragon";
import type React from "react";
import { uuid } from "./osdAnnotation";
import { RectAnnotation } from "./types";

export type DragState = {
  active: boolean;
  startImage: { x: number; y: number } | null;
  overlayEl: HTMLElement | null;
};

export function drawOnPressRect(
  event: OpenSeadragon.OSDEvent<any>,
  viewer: OpenSeadragon.Viewer,
  dragRef: React.MutableRefObject<DragState>,
  color = "#ff3b30",
  fillColor = "rgba(255,59,48,0.08)"
): [HTMLElement, { x: number; y: number }] {
  event.preventDefaultAction = true;

  const webPoint = event.position;
  const viewportPoint = viewer.viewport.pointFromPixel(webPoint);
  const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

  dragRef.current.active = true;
  dragRef.current.startImage = { x: imagePoint.x, y: imagePoint.y };

  const el = document.createElement("div");
  el.style.border = `2px solid ${color}`;
  el.style.background = fillColor;
  el.style.pointerEvents = "none";
  dragRef.current.overlayEl = el;

  return [el, { x: imagePoint.x, y: imagePoint.y }];
}

export function drawOnDragRect(
  event: OpenSeadragon.OSDEvent<any>,
  viewer: OpenSeadragon.Viewer,
  dragRef: React.MutableRefObject<DragState>,
): [HTMLElement | null, number, number, number, number] {
  event.preventDefaultAction = true;

  const webPoint = event.position;
  const viewportPoint = viewer.viewport.pointFromPixel(webPoint);
  const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

  const start = dragRef.current.startImage;
  if (!start) return [null, imagePoint.x, imagePoint.y, 0, 0];
  const x = Math.min(start.x, imagePoint.x);
  const y = Math.min(start.y, imagePoint.y);
  const w = Math.abs(imagePoint.x - start.x);
  const h = Math.abs(imagePoint.y - start.y);

  return [dragRef.current.overlayEl, x, y, w, h];
}

export function drawOnReleaseRect(
  event: OpenSeadragon.OSDEvent<any>,
  viewer: OpenSeadragon.Viewer,
  drawTool: "rect",
  label: string | null,
  dragRef: React.MutableRefObject<DragState>,
): RectAnnotation | null {
  event.preventDefaultAction = true;

  const webPoint = event.position;
  const viewportPoint = viewer.viewport.pointFromPixel(webPoint);
  const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

  const start = dragRef.current.startImage;
  if (!start) return null;
  const x = Math.min(start.x, imagePoint.x);
  const y = Math.min(start.y, imagePoint.y);
  const w = Math.abs(imagePoint.x - start.x);
  const h = Math.abs(imagePoint.y - start.y);

  const tmpEl = dragRef.current.overlayEl;
  if (tmpEl) viewer.removeOverlay(tmpEl);

  dragRef.current.active = false;
  dragRef.current.startImage = null;
  dragRef.current.overlayEl = null;

  // ignore petites zones
  if (w < 5 || h < 5) return null;

  const ann: RectAnnotation = {
    id: uuid(),
    type: drawTool, // "rect"
    // Coordinates en pixels image
    x,
    y,
    w,
    h,
    label: label?.trim() || null,
    createdAt: new Date().toISOString(),
  };

  return ann;
}
