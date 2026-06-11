import OpenSeadragon from "openseadragon";
import type React from "react";
import { uuid, imageRectToViewportRect } from "./osdAnnotation";
import type { PolygonAnnotation, PolygonPoint } from "./types";

type PolygonLiveState = {
  active: boolean;
  points: PolygonPoint[]; // coordonnées image
  svgEl: SVGSVGElement | null;
  polyEl: SVGPolygonElement | null;
  previewEl: SVGPolylineElement | null;
  _overlayAdded?: boolean;
};

export type DragStateWithPolygon = {
  polygon?: PolygonLiveState;
};

function ensurePolygonState(
  dragRef: React.MutableRefObject<any>,
): PolygonLiveState {
  if (!dragRef.current.polygon) {
    dragRef.current.polygon = {
      active: false,
      points: [],
      svgEl: null,
      polyEl: null,
      previewEl: null,
      _overlayAdded: false,
    } satisfies PolygonLiveState;
  }
  return dragRef.current.polygon as PolygonLiveState;
}

function imagePointsToViewportPoints(
  viewer: OpenSeadragon.Viewer,
  pts: PolygonPoint[],
): OpenSeadragon.Point[] {
  return pts.map((p) => viewer.viewport.imageToViewportCoordinates(p.x, p.y));
}

function colorToSvgFill(color?: string): { fill: string; fillOpacity: string } {
  if (!color) {
    return { fill: "#ff3b30", fillOpacity: "0.18" };
  }

  if (color.startsWith("#")) {
    return { fill: color, fillOpacity: "0.18" };
  }

  const match = color.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)/i
  );

  if (!match) {
    return { fill: color, fillOpacity: "0.18" };
  }

  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);
  const a = match[4] != null ? String(match[4]) : "1";

  return {
    fill: `rgb(${r},${g},${b})`,
    fillOpacity: a,
  };
}

function bboxOfImagePoints(pts: PolygonPoint[]): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function setSvgViewBoxToViewportBBox(
  svgEl: SVGSVGElement,
  vpts: OpenSeadragon.Point[],
): void {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of vpts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  // petite marge (unités viewport)
  const pad = 0.0005;
  const x = minX - pad,
    y = minY - pad;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;

  svgEl.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
  svgEl.setAttribute("width", "100%");
  svgEl.setAttribute("height", "100%");
}

function createPolygonOverlaySvg(style?: {
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
}): {
  svgEl: SVGSVGElement;
  polyEl: SVGPolygonElement;
  previewEl: SVGPolylineElement;
} {
  const svgNS = "http://www.w3.org/2000/svg";

  const svg = document.createElementNS(svgNS, "svg");
  svg.style.pointerEvents = "none";
  svg.style.overflow = "visible";

  const poly = document.createElementNS(svgNS, "polygon");
  const { fill, fillOpacity } = colorToSvgFill(style?.fillColor);

  poly.setAttribute("vector-effect", "non-scaling-stroke");
  poly.setAttribute("stroke-width", String(style?.strokeWidth ?? 2));
  poly.setAttribute("stroke-linejoin", "round");
  poly.setAttribute("stroke-linecap", "round");
  poly.setAttribute("stroke", style?.strokeColor ?? "#ff3b30");
  poly.setAttribute("fill", fill);
  poly.setAttribute("fill-opacity", fillOpacity);

  const preview = document.createElementNS(svgNS, "polyline");
  preview.setAttribute("vector-effect", "non-scaling-stroke");
  preview.setAttribute("stroke-width", String(style?.strokeWidth ?? 2));
  preview.setAttribute("stroke-linecap", "round");
  preview.setAttribute("stroke-dasharray", "6 6");
  preview.setAttribute("stroke", style?.strokeColor ?? "#ff3b30");
  preview.setAttribute("fill", "none");

  svg.appendChild(poly);
  svg.appendChild(preview);

  return { svgEl: svg, polyEl: poly, previewEl: preview };
}

function updateOverlay(
  viewer: OpenSeadragon.Viewer,
  polygonState: PolygonLiveState,
  mouseImagePoint: PolygonPoint | null = null,
): void {
  const pts = polygonState.points;
  if (!polygonState.svgEl || !polygonState.polyEl || !polygonState.previewEl)
    return;
  if (pts.length === 0) return;

  const vpts = imagePointsToViewportPoints(viewer, pts);
  polygonState.polyEl.setAttribute(
    "points",
    vpts.map((p) => `${p.x},${p.y}`).join(" "),
  );

  // preview : pts + point courant (si on a une souris)
  if (mouseImagePoint && pts.length >= 1) {
    const vMouse = viewer.viewport.imageToViewportCoordinates(
      mouseImagePoint.x,
      mouseImagePoint.y,
    );
    polygonState.previewEl.setAttribute(
      "points",
      [...vpts, vMouse].map((p) => `${p.x},${p.y}`).join(" "),
    );
    polygonState.previewEl.style.display = "block";
  } else {
    polygonState.previewEl.setAttribute("points", "");
    polygonState.previewEl.style.display = "none";
  }

  if (pts.length < 3) {
    polygonState.polyEl.setAttribute("fill-opacity", "0");
  } else {
    const currentFill = polygonState.polyEl.getAttribute("fill-opacity");
    if (!currentFill || currentFill === "0") {
      const { fillOpacity } = colorToSvgFill();
      polygonState.polyEl.setAttribute("fill-opacity", fillOpacity);
    }
  }

  // l’overlay OSD doit être positionné avec un rect viewport
  const bboxImg = bboxOfImagePoints(pts);
  const rect = imageRectToViewportRect(viewer, bboxImg);

  // viewBox du SVG = bbox viewport des points (pour que stroke stable)
  setSvgViewBoxToViewportBBox(polygonState.svgEl, vpts);

  // crée overlay si pas encore ajouté
  if (!polygonState._overlayAdded) {
    viewer.addOverlay({
      element: polygonState.svgEl,
      location: rect,
      placement: OpenSeadragon.Placement.CENTER,
    });
    polygonState._overlayAdded = true;
  } else {
    viewer.updateOverlay(polygonState.svgEl, rect);
  }
}

export function polygonStartIfNeeded(
  viewer: OpenSeadragon.Viewer,
  dragRef: React.MutableRefObject<any>,
  style?: {
    strokeColor?: string;
    fillColor?: string;
    strokeWidth?: number;
  }
): PolygonLiveState {
  const poly = ensurePolygonState(dragRef);
  if (poly.active) return poly;

  const { svgEl, polyEl, previewEl } = createPolygonOverlaySvg(style);
  poly.active = true;
  poly.points = [];
  poly.svgEl = svgEl;
  poly.polyEl = polyEl;
  poly.previewEl = previewEl;
  poly._overlayAdded = false;

  return poly;
}

export function polygonAddPoint(
  event: OpenSeadragon.OSDEvent<any>,
  viewer: OpenSeadragon.Viewer,
  dragRef: React.MutableRefObject<any>,
  style?: {
    strokeColor?: string;
    fillColor?: string;
    strokeWidth?: number;
  }
): void {
  const poly = polygonStartIfNeeded(viewer, dragRef, style);

  event.preventDefaultAction = true;

  const webPoint = event.position;
  const viewportPoint = viewer.viewport.pointFromPixel(webPoint);
  const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

  poly.points.push({ x: imagePoint.x, y: imagePoint.y });

  updateOverlay(viewer, poly, { x: imagePoint.x, y: imagePoint.y });
}

export function polygonMove(
  event: OpenSeadragon.OSDEvent<any>,
  viewer: OpenSeadragon.Viewer,
  dragRef: React.MutableRefObject<any>,
): void {
  const poly = ensurePolygonState(dragRef);
  if (!poly.active) return;

  event.preventDefaultAction = true;

  const webPoint = event.position;
  const viewportPoint = viewer.viewport.pointFromPixel(webPoint);
  const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

  updateOverlay(viewer, poly, { x: imagePoint.x, y: imagePoint.y });
}

export function polygonCancel(
  viewer: OpenSeadragon.Viewer,
  dragRef: React.MutableRefObject<any>,
): void {
  const poly = ensurePolygonState(dragRef);
  if (!poly.active) return;

  // enlever overlay
  if (poly.svgEl) viewer.removeOverlay(poly.svgEl);

  dragRef.current.polygon = {
    active: false,
    points: [],
    svgEl: null,
    polyEl: null,
    previewEl: null,
    _overlayAdded: false,
  } satisfies PolygonLiveState;
}

export function polygonFinish(
  viewer: OpenSeadragon.Viewer,
  dragRef: React.MutableRefObject<any>,
  label: string | null,
): [PolygonAnnotation | null] {
  const poly = ensurePolygonState(dragRef);
  if (!poly.active) return [null];

  if (!poly.points || poly.points.length < 3) {
    polygonCancel(viewer, dragRef);
    return [null];
  }

  const ann: PolygonAnnotation = {
    id: uuid(),
    type: "polygon",
    points: poly.points,
    label: label?.trim() || null,
    createdAt: new Date().toISOString(),
  };

  // cleanup overlay live
  if (poly.svgEl) {
    try {
      viewer.removeOverlay(poly.svgEl);
    } catch {
      // ignore
    }
  }

  dragRef.current.polygon = {
    active: false,
    points: [],
    svgEl: null,
    polyEl: null,
    previewEl: null,
    _overlayAdded: false,
  } satisfies PolygonLiveState;

  return [ann];
}
