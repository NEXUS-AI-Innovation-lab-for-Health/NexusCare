import OpenSeadragon from "openseadragon";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  loadAnnotations,
  saveAnnotations,
  imageRectToViewportRect,
  imageEllipseToViewportRect,
} from "./osdAnnotation";

import type {
  Annotation,
  AnnotationType,
  AnnotationCategory,
  CircleAnnotation,
  RectAnnotation,
  PolygonAnnotation,
  PolygonPoint,
  BaseAnnotation,
} from "./types";

import {
  drawOnPressRect,
  drawOnDragRect,
  drawOnReleaseRect,
  type DragState as RectDragState,
} from "./drawRect";

import {
  drawOnPressCircle,
  drawOnDragCircle,
  drawOnReleaseCircle,
  type DragState as CircleDragState,
} from "./drawCircle";

import {
  polygonAddPoint,
  polygonMove,
  polygonFinish,
  polygonCancel,
} from "./drawPolygon";

const IMAGES_API = "http://localhost:18004";

const OLGA_API = "http://localhost:8082";

const INSTANSEG_API = "http://localhost:18010";


type SourceType = "dzi" | "image";
type DrawTool = AnnotationType;
type Severity = NonNullable<BaseAnnotation["severity"]>;

export type OpenSeadragonUrlViewerProps = {
  sourceType: SourceType;
  sourceUrl: string;
  imageKey?: string | null;
  imageId?: string | null;
  caseId?: string | null;
};

type DragRefState = (RectDragState | CircleDragState) & {
  polygon?: any;
};

type ApiAnnotationRow = {
  id: string;
  image_id: string;
  case_id: string;
  type: AnnotationType | string;
  label?: string | null;
  severity?: Severity | null;
  category?: AnnotationCategory | null;
  description?: string | null;
  recommendation?: string | null;
  tags?: string[] | null;
  user_id?: string | null;
  owner_id?: string | null;
  owner_name?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  updated_at?: string | null;
  updatedAt?: string | null;
  coordinates: Record<string, any>;
};

type OlgaFieldOption = {
  label?: string;
  value?: string;
};

type OlgaField = {
  unique_id?: string;
  field_key: string;
  field_label?: string;
  field_type: string;
  field_required?: boolean;
  field_hint?: string;
  field_mode?: string;
  field_events?: Record<string, any>;
  options?: Array<{ label?: string; value?: string }>;
  field_options?: {
    source?: string;
    values?: string[];
    options?: Array<{ label?: string; value?: string }>;
  };
};

type OlgaFormResponse = {
  form_version?: string;
  models?: string[];
  form_label?: string;
  last_updated?: string;
  form?: OlgaField[];
};

type ShapeHandle = {
  annotationId: string;
  index: number;
  x: number;
  y: number;
};


function hasTag(ann: Annotation | null, tag: string) {
  return !!ann && (ann.tags || []).some((t) => String(t).toLowerCase() === tag.toLowerCase());
}

function isInstantSegAnnotation(ann: Annotation | null) {
  return !!ann && hasTag(ann, "InstantSeg");
}

function isInstantSegPolygon(ann: Annotation | null) {
  return !!ann && ann.type === "polygon" && isInstantSegAnnotation(ann);
}

function isIaGroupRect(ann: Annotation | null) {
  return !!ann &&
    ann.type === "rect" &&
    isInstantSegAnnotation(ann) &&
    hasTag(ann, "group");
}

function getInstantSegAnnotations(list: Annotation[]) {
  return list.filter((a) => isInstantSegAnnotation(a));
}

function getInstantSegPersistedAnnotations(list: Annotation[]) {
  return list.filter(
    (a) => isInstantSegAnnotation(a) && !String(a.id).startsWith("tmp-")
  );
}

export default function OpenSeadragonUrlViewer(
  props: OpenSeadragonUrlViewerProps,
) {
  const { sourceType, sourceUrl, imageKey, imageId, caseId } = props;

  type AnnSource = BaseAnnotation["_source"];

  function normalizeSource(s: any): AnnSource {
    return s === "local" || s === "api" || s === "ia" ? s : "local";
  }

  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);

  const [freePanMode, setFreePanMode] = useState(true);

  const [pendingAnn, setPendingAnn] = useState<Annotation | null>(null);
  const [draftAnnotations, setDraftAnnotations] = useState<Annotation[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotateMode, setAnnotateMode] = useState<boolean>(false);
  const [drawTool, setDrawTool] = useState<DrawTool>("rect");
  
  const [drawSettingsOpen, setDrawSettingsOpen] = useState(false);
  const [drawStrokeColor, setDrawStrokeColor] = useState("#ff3b30");
  const [drawFillColor, setDrawFillColor] = useState("rgba(255,59,48,0.08)");
  const [drawStrokeWidth, setDrawStrokeWidth] = useState(2);

  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "view" | "edit">(
    "create",
  );

  const [moveMode, setMoveMode] = useState(false);
  const [reshapeMode, setReshapeMode] = useState(false);

  const [capturePreviewOpen, setCapturePreviewOpen] = useState(false);
  const [capturePreviewUrl, setCapturePreviewUrl] = useState<string | null>(null);

  const [aiSegmentationMode, setAiSegmentationMode] = useState(false);
  const [instansegLoading, setInstansegLoading] = useState(false);

  const [olgaForm, setOlgaForm] = useState<OlgaFormResponse | null>(null);
  const [olgaFormLoading, setOlgaFormLoading] = useState(false);
  const [olgaFormError, setOlgaFormError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  const [filterCategory, setFilterCategory] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterOwner, setFilterOwner] = useState("");

  const dragRef = useRef<DragRefState>({
    active: false,
    startImage: null,
    overlayEl: null,
  });

  const annotationsRef = useRef<Annotation[]>([]);
  const detailOpenRef = useRef(false);

  const isOwnedSelectedAnnotation = !!selectedAnnotation && canEditAnnotation(selectedAnnotation);

  const isDeletableSelectedAnnotation = !!selectedAnnotation && canDeleteAnnotation(selectedAnnotation);

  const isExistingAnnotationView = detailOpen && !!selectedAnnotation && formMode === "view";

  const isOwnedExistingAnnotationView = isExistingAnnotationView && isOwnedSelectedAnnotation;

  const isForeignExistingAnnotationView = isExistingAnnotationView && !isOwnedSelectedAnnotation;

  const IA_PALETTE = [
    { stroke: "#2563eb", fill: "rgba(37,99,235,0.16)" },
    { stroke: "#dc2626", fill: "rgba(220,38,38,0.16)" },
    { stroke: "#059669", fill: "rgba(5,150,105,0.16)" },
    { stroke: "#d97706", fill: "rgba(217,119,6,0.16)" },
    { stroke: "#7c3aed", fill: "rgba(124,58,237,0.16)" },
    { stroke: "#27db4e", fill: "rgba(219,39,119,0.16)" },
    { stroke: "#0891b2", fill: "rgba(8,145,178,0.16)" },
  ];

  function getIaVisual(idx: number) {
    return IA_PALETTE[idx % IA_PALETTE.length];
  }

  function buildIaGroupRect(polygons: Annotation[], now: string, ownerId: string | null, ownerName: string | null): Annotation | null {
    const onlyPolygons = polygons.filter((a) => a.type === "polygon");
    if (onlyPolygons.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const ann of onlyPolygons) {
      const b = polygonBounds(ann.points);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }

    return {
      id: `tmp-ia-group-${Date.now()}`,
      type: "rect",
      x: minX,
      y: minY,
      w: Math.max(1, maxX - minX),
      h: Math.max(1, maxY - minY),
      label: "Segmentation IA",
      severity: "Moyenne",
      category: "Zone suspecte",
      notes: "Rectangle englobant de segmentation IA",
      recommendation: null,
      tags: ["IA", "InstantSeg", "group"],
      ownerId,
      ownerName,
      createdAt: now,
      updatedAt: now,
      _source: "ia",
      strokeColor: "#f59e0b",
      fillColor: "rgba(0,0,0,0)",
      strokeWidth: 3,
      confidence: null,
    };
  }

  function buildIaGroupRectFromExisting(polygons: Annotation[]): Annotation | null {
    const onlyIaPolygons = polygons.filter((a) => isInstantSegPolygon(a));
    if (onlyIaPolygons.length === 0) return null;

    const newest = onlyIaPolygons
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];

    return buildIaGroupRect(
      onlyIaPolygons,
      newest.createdAt || new Date().toISOString(),
      newest.ownerId || null,
      newest.ownerName || null
    );
  }

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  useEffect(() => {
    detailOpenRef.current = detailOpen;
  }, [detailOpen]);

  type CaptureDragState = {
    active: boolean;
    startPx: { x: number; y: number } | null;
    overlayEl: HTMLDivElement | null;
  };

  type EditDragState = {
    active: boolean;
    annotationId: string | null;
    kind: "move" | "reshape" | null;
    handleIndex: number | null;
    startImage: { x: number; y: number } | null;
    original: Annotation | null;
  };

  const editDragRef = useRef<EditDragState>({
    active: false,
    annotationId: null,
    kind: null,
    handleIndex: null,
    startImage: null,
    original: null,
  });

  const [captureMode, setCaptureMode] = useState(false);

  const captureDragRef = useRef<CaptureDragState>({
    active: false,
    startPx: null,
    overlayEl: null,
  });

  const canAnnotate = useMemo(() => {
    const role = getCurrentUserRole();
    return Boolean(imageKey) && role !== "medecin_generaliste" && role !== "admin";
  }, [imageKey]);

  const scopedImageKey = useMemo(() => {
    if (!imageKey || !caseId) return null;
    return `${caseId}::${imageKey}`;
  }, [caseId, imageKey]);

  function getCurrentUser() {
    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken");

    if (!token) {
      return { id: null, name: null };
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const email = payload.sub || payload.email || null;
      const name = payload.full_name || payload.name || email || null;
      return { id: email, name };
    } catch {
      return { id: null, name: null };
    }
  }

  function getCurrentUserRole() {
    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken");

    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.role || null;
    } catch {
      return null;
    }
  }

  function switchToFreePanMode() {
    cleanupCaptureOverlay();
    setPendingAnn(null);
    setDraftAnnotations([]);
    setSelectedAnnotation(null);
    setDetailOpen(false);

    setAnnotateMode(false);
    setCaptureMode(false);
    setAiSegmentationMode(false);
    setMoveMode(false);
    setReshapeMode(false);

    setCapturePreviewOpen(false);
    setCapturePreviewUrl(null);
    setDrawSettingsOpen(false);

    setFreePanMode(true);
  }

  function finishTransientActionAndReturnToFreePan() {
    cleanupCaptureOverlay();
    setCaptureMode(false);
    setAiSegmentationMode(false);
    setFreePanMode(true);
  }

  function cleanupCaptureOverlay() {
    const viewer = viewerRef.current;
    const overlayEl = captureDragRef.current.overlayEl;

    if (viewer && overlayEl) {
      try {
        viewer.removeOverlay(overlayEl);
      } catch {
        // ignore
      }
    }

    captureDragRef.current.active = false;
    captureDragRef.current.startPx = null;
    captureDragRef.current.overlayEl = null;
  }

  function getViewerDrawerCanvas(): HTMLCanvasElement | null {
    const viewer = viewerRef.current;
    if (!viewer) return null;

    const anyViewer = viewer as any;
    const canvas =
      anyViewer?.drawer?.canvas ||
      anyViewer?.drawer?.context?.canvas ||
      containerRef.current?.querySelector("canvas");

    return canvas instanceof HTMLCanvasElement ? canvas : null;
  }

  function showCapturedImageInModal(dataUrl: string) {
    setCapturePreviewUrl(dataUrl);
    setCapturePreviewOpen(true);
  }

  function exportCaptureFromSelection(rectPx: {
    x: number;
    y: number;
    w: number;
    h: number;
  }) {
    const canvas = getViewerDrawerCanvas();
    const container = containerRef.current;

    if (!canvas || !container) {
      alert("Capture impossible : canvas OpenSeadragon introuvable.");
      return;
    }

    const displayW = container.clientWidth;
    const displayH = container.clientHeight;

    if (!displayW || !displayH) {
      alert("Capture impossible : dimensions du viewer invalides.");
      return;
    }

    const sx = canvas.width / displayW;
    const sy = canvas.height / displayH;

    const srcX = Math.max(0, Math.round(rectPx.x * sx));
    const srcY = Math.max(0, Math.round(rectPx.y * sy));
    const srcW = Math.max(1, Math.round(rectPx.w * sx));
    const srcH = Math.max(1, Math.round(rectPx.h * sy));

    const safeW = Math.min(srcW, canvas.width - srcX);
    const safeH = Math.min(srcH, canvas.height - srcY);

    if (safeW <= 0 || safeH <= 0) {
      alert("Zone de capture invalide.");
      return;
    }

    const out = document.createElement("canvas");
    out.width = safeW;
    out.height = safeH;

    const ctx = out.getContext("2d");
    if (!ctx) {
      alert("Capture impossible : contexte canvas indisponible.");
      return;
    }

    ctx.drawImage(
      canvas,
      srcX,
      srcY,
      safeW,
      safeH,
      0,
      0,
      safeW,
      safeH,
    );

    try {
      const dataUrl = out.toDataURL("image/jpeg", 0.95);
      showCapturedImageInModal(dataUrl);
    } catch (err) {
      console.error("Erreur export canvas:", err);
      alert("Capture impossible : le canvas est bloqué par la politique CORS des tiles.");
    }
  }

  function exportCaptureBlobFromSelection(rectPx: { x: number; y: number; w: number; h: number }) {
    const canvas = getViewerDrawerCanvas();
    const container = containerRef.current;

    if (!canvas || !container) {
      throw new Error("Canvas OpenSeadragon introuvable.");
    }

    const displayW = container.clientWidth;
    const displayH = container.clientHeight;

    const sx = canvas.width / displayW;
    const sy = canvas.height / displayH;

    const srcX = Math.max(0, Math.round(rectPx.x * sx));
    const srcY = Math.max(0, Math.round(rectPx.y * sy));
    const srcW = Math.max(1, Math.round(rectPx.w * sx));
    const srcH = Math.max(1, Math.round(rectPx.h * sy));

    const safeW = Math.min(srcW, canvas.width - srcX);
    const safeH = Math.min(srcH, canvas.height - srcY);

    if (safeW <= 0 || safeH <= 0) {
      throw new Error("Zone de capture invalide.");
    }

    const out = document.createElement("canvas");
    out.width = safeW;
    out.height = safeH;

    const ctx = out.getContext("2d");
    if (!ctx) {
      throw new Error("Contexte canvas indisponible.");
    }

    ctx.drawImage(canvas, srcX, srcY, safeW, safeH, 0, 0, safeW, safeH);

    return new Promise<Blob>((resolve, reject) => {
      out.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Impossible de convertir la capture en blob."));
          return;
        }
        resolve(blob);
      }, "image/png");
    });
  }

  function canEditAnnotation(ann: Annotation | null) {
    if (!ann) return false;
    if (isIaGroupRect(ann)) return false;

    const current = getCurrentUser();
    return !!current.id && ann.ownerId === current.id;
  }

  function canDeleteAnnotation(ann: Annotation | null) {
    if (!ann) return false;
    if (isIaGroupRect(ann)) return true;
    return canEditAnnotation(ann);
  }

  function getOlgaFieldLabel(field: OlgaField) {
    return field.field_label?.trim() || field.field_key;
  }

  function normalizeFieldKey(key: string) {
    return key.trim().toLowerCase();
  }

  function getFieldValue(key: string, fallback: any = "") {
    return formValues[key] ?? fallback;
  }

  function setFieldValue(key: string, value: any) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }

  function buildDefaultValuesFromOlgaForm(form?: OlgaFormResponse | null) {
    const values: Record<string, any> = {};

    for (const field of form?.form || []) {
      const type = field.field_type?.toLowerCase?.() || "";
      values[field.field_key] = type.includes("checkbox") ? false : "";
    }

    return values;
  }

  function extractAnnotationPayloadFromForm(values: Record<string, any>) {
    const entries = Object.entries(values).reduce<Record<string, any>>(
      (acc, [key, value]) => {
        acc[normalizeFieldKey(key)] = value;
        return acc;
      },
      {},
    );

    const label =
      entries.label ??
      entries.nom ??
      entries.title ??
      entries.titre ??
      "";

    const severity =
      entries.severity ??
      entries.severite ??
      entries["sévérité"] ??
      "Moyenne";

    const category =
      entries.category ??
      entries.categorie ??
      entries["catégorie"] ??
      "";

    const description =
      entries.description ??
      entries.commentaire ??
      entries.comment ??
      "";

    const recommendation =
      entries.recommendation ??
      entries.recommandation ??
      entries.conclusion ??
      "";

    const tagsRaw =
      entries.tags ??
      entries.tag ??
      entries.motscles ??
      entries["mots-clés"] ??
      entries["mot-clé"] ??
      "";

    const tags = Array.isArray(tagsRaw)
      ? tagsRaw
      : String(tagsRaw || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);

    return {
      label: String(label || "").trim() || null,
      severity: String(severity || "Moyenne") as Severity,
      category: (String(category || "") as AnnotationCategory) || null,
      description: String(description || "").trim() || null,
      recommendation: String(recommendation || "").trim() || null,
      tags,
    };
  }

  function resetFormFields() {
    setFormValues(buildDefaultValuesFromOlgaForm(olgaForm));
  }

  function fillFormFromAnnotation(ann: Annotation) {
    const base = buildDefaultValuesFromOlgaForm(olgaForm);
    const nextValues: Record<string, any> = { ...base };

    for (const field of olgaForm?.form || []) {
      const key = normalizeFieldKey(field.field_key);

      if (["label", "nom", "title", "titre"].includes(key)) {
        nextValues[field.field_key] = ann.label || "";
      } else if (["severity", "severite", "sévérité"].includes(key)) {
        nextValues[field.field_key] = ann.severity || "Moyenne";
      } else if (["category", "categorie", "catégorie"].includes(key)) {
        nextValues[field.field_key] = ann.category || "";
      } else if (["description", "commentaire", "comment"].includes(key)) {
        nextValues[field.field_key] = ann.description || "";
      } else if (
        ["recommendation", "recommandation", "conclusion"].includes(key)
      ) {
        nextValues[field.field_key] = ann.recommendation || "";
      } else if (["tags", "tag", "motscles", "mots-clés", "mot-clé"].includes(key)) {
        nextValues[field.field_key] = (ann.tags || []).join(", ");
      }
    }

    setFormValues(nextValues);
  }

  function openAnnotationDetails(ann: Annotation) {
    setSelectedAnnotation(ann);
    setFormMode("view");
    fillFormFromAnnotation(ann);
    setDetailOpen(true);
  }

  function closeDetailModal() {
    const viewer = viewerRef.current;

    if (viewer) {
      try {
        if (dragRef.current.overlayEl) {
          viewer.removeOverlay(dragRef.current.overlayEl);
        }
      } catch {
        // ignore
      }

      try {
        polygonCancel(viewer, dragRef as any);
      } catch {
        // ignore
      }

      clearRenderedOverlays(viewer);
    }

    dragRef.current.active = false;
    dragRef.current.startImage = null;
    dragRef.current.overlayEl = null;

    setDetailOpen(false);
    setSelectedAnnotation(null);
    setPendingAnn(null);
    setDraftAnnotations([]);
    setFormMode("create");
    resetFormFields();

    // redessine uniquement les annotations réellement sauvegardées
    if (viewer) {
      redrawAll(viewer, annotationsRef.current, {
        reshapeMode,
        selectedId: null,
      });
    }
  }

  function reshapeAnnotation(ann: Annotation, handleIndex: number, x: number, y: number): Annotation {
    if (ann.type === "rect") {
      const x1 = ann.x;
      const y1 = ann.y;
      const x2 = ann.x + ann.w;
      const y2 = ann.y + ann.h;

      let nx1 = x1, ny1 = y1, nx2 = x2, ny2 = y2;

      if (handleIndex === 0) { nx1 = x; ny1 = y; }
      if (handleIndex === 1) { nx2 = x; ny1 = y; }
      if (handleIndex === 2) { nx2 = x; ny2 = y; }
      if (handleIndex === 3) { nx1 = x; ny2 = y; }

      const rx = Math.min(nx1, nx2);
      const ry = Math.min(ny1, ny2);
      const rw = Math.max(1, Math.abs(nx2 - nx1));
      const rh = Math.max(1, Math.abs(ny2 - ny1));

      return { ...ann, x: rx, y: ry, w: rw, h: rh };
    }

    if (ann.type === "circle") {
      if (handleIndex === 0 || handleIndex === 1) {
        return { ...ann, rx: Math.max(1, Math.abs(x - ann.cx)) };
      }
      if (handleIndex === 2 || handleIndex === 3) {
        return { ...ann, ry: Math.max(1, Math.abs(y - ann.cy)) };
      }
      return ann;
    }

    if (ann.type === "polygon") {
      const nextPoints = ann.points.map((p, idx) =>
        idx === handleIndex ? { x, y } : p
      );
      return { ...ann, points: nextPoints };
    }

    return ann;
  }

  function polygonBounds(points: { x: number; y: number }[]) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  }

  useEffect(() => {
    let cancelled = false;

    async function loadOlgaForm() {
      try {
        setOlgaFormLoading(true);
        setOlgaFormError(null);

        const res = await fetch(
          `${OLGA_API}/forms/getFromID/creationLabelPatho`,
        );

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Olga form fetch failed: ${res.status} - ${txt}`);
        }

        const data = (await res.json()) as OlgaFormResponse;
        if (cancelled) return;

        setOlgaForm(data);
        setFormValues((prev) => {
          const defaults = buildDefaultValuesFromOlgaForm(data);
          return Object.keys(prev).length > 0 ? prev : defaults;
        });
      } catch (e: any) {
        if (cancelled) return;
        console.error("Erreur chargement formulaire Olga:", e);
        setOlgaFormError("Impossible de charger le formulaire Olga");
        setOlgaForm(null);
      } finally {
        if (!cancelled) setOlgaFormLoading(false);
      }
    }

    void loadOlgaForm();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !reshapeMode) return;

    const imagePointFromEvt = (evt: any) => {
      const webPoint = evt.position as OpenSeadragon.Point;
      return viewer.viewport.viewportToImageCoordinates(
        viewer.viewport.pointFromPixel(webPoint)
      );
    };

    const onPress = (evt: OpenSeadragon.OSDEvent<any>) => {
      if (!reshapeMode || detailOpenRef.current) return;
      evt.preventDefaultAction = true;

      const p = imagePointFromEvt(evt);
      const handle = findHandleAtPoint(annotationsRef.current, p.x, p.y);
      if (!handle) return;

      const ann = annotationsRef.current.find((a) => a.id === handle.annotationId);
      if (!ann) return;

      editDragRef.current.active = true;
      editDragRef.current.annotationId = ann.id;
      editDragRef.current.kind = "reshape";
      editDragRef.current.handleIndex = handle.index;
      editDragRef.current.startImage = { x: p.x, y: p.y };
      editDragRef.current.original = cloneAnnotation(ann);
      setSelectedAnnotation(ann);
    };

    const onDrag = (evt: OpenSeadragon.OSDEvent<any>) => {
      if (!editDragRef.current.active || editDragRef.current.kind !== "reshape") return;
      evt.preventDefaultAction = true;

      const annId = editDragRef.current.annotationId;
      const handleIndex = editDragRef.current.handleIndex;
      if (!annId || handleIndex == null) return;

      const p = imagePointFromEvt(evt);

      setAnnotations((prev) => {
        const next = prev.map((a) =>
          a.id === annId
            ? {
                ...reshapeAnnotation(a, handleIndex, p.x, p.y),
                updatedAt: new Date().toISOString(),
              }
            : a
        );

        const updatedAnn = next.find((a) => a.id === annId) || null;
        setSelectedAnnotation(updatedAnn);

        return next;
      });
    };

    const onRelease = async () => {
      if (!editDragRef.current.active) return;

      const annId = editDragRef.current.annotationId;

      editDragRef.current.active = false;
      editDragRef.current.annotationId = null;
      editDragRef.current.kind = null;
      editDragRef.current.handleIndex = null;
      editDragRef.current.startImage = null;
      editDragRef.current.original = null;

      if (!annId || !imageKey) return;

      const updated = annotationsRef.current.find((a) => a.id === annId);
      if (updated) {
        if (scopedImageKey) saveAnnotations(scopedImageKey, annotationsRef.current);
        await persistAnnotationGeometry(updated);
      }
    };

    viewer.addHandler("canvas-press", onPress);
    viewer.addHandler("canvas-drag", onDrag);
    viewer.addHandler("canvas-release", onRelease);

    return () => {
      viewer.removeHandler("canvas-press", onPress);
      viewer.removeHandler("canvas-drag", onDrag);
      viewer.removeHandler("canvas-release", onRelease);
    };
  }, [reshapeMode, imageKey]);

  async function fetchAnnotationsForImage(
    imgId: string,
    cId: string,
  ): Promise<ApiAnnotationRow[]> {
    const res = await fetch(
      `${IMAGES_API}/api/annotations/image/${imgId}/case/${cId}`,
      {
        headers: {
          ...authHeaders(),
        },
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        "GET /api/annotations/image/{image_id}/case/{case_id} error:",
        res.status,
        text,
      );
      throw new Error(`GET annotation failed: ${res.status} - ${text}`);
    }

    return (await res.json()) as ApiAnnotationRow[];
  }

  async function runInstantSegOnSelection(rectPx: { x: number; y: number; w: number; h: number }) {
    if (!scopedImageKey) return;

    setInstansegLoading(true);

    try {
      const viewer = viewerRef.current;
      if (!viewer) throw new Error("Viewer indisponible");

      const topLeftVp = viewer.viewport.pointFromPixel(
        new OpenSeadragon.Point(rectPx.x, rectPx.y),
        true
      );
      const bottomRightVp = viewer.viewport.pointFromPixel(
        new OpenSeadragon.Point(rectPx.x + rectPx.w, rectPx.y + rectPx.h),
        true
      );

      const topLeftImg = viewer.viewport.viewportToImageCoordinates(topLeftVp);
      const bottomRightImg = viewer.viewport.viewportToImageCoordinates(bottomRightVp);

      const x = Math.round(Math.min(topLeftImg.x, bottomRightImg.x));
      const y = Math.round(Math.min(topLeftImg.y, bottomRightImg.y));
      const w = Math.max(1, Math.round(Math.abs(bottomRightImg.x - topLeftImg.x)));
      const h = Math.max(1, Math.round(Math.abs(bottomRightImg.y - topLeftImg.y)));

      const formData = new FormData();
      formData.append("source_url", sourceUrl);
      formData.append("x", String(x));
      formData.append("y", String(y));
      formData.append("w", String(w));
      formData.append("h", String(h));

      const res = await fetch(`${INSTANSEG_API}/api/instanseg/segment-from-dzi`, {
        method: "POST",
        headers: {
          ...authHeaders(),
        },
        body: formData,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erreur InstantSeg");
      }

      const data = await res.json();

      const currentUser = getCurrentUser();
      const now = new Date().toISOString();

      const iaOwnerName =
        currentUser.name?.trim()
          ? `${currentUser.name.trim()} (IA)`
          : currentUser.id?.trim()
            ? `${currentUser.id.trim()} (IA)`
            : "Utilisateur (IA)";

      const aiAnnotations: Annotation[] = (data.annotations || [])
        .map((ann: any, idx: number) => {
          const visual = getIaVisual(idx);

          return {
            id: `tmp-ia-${Date.now()}-${idx}`,
            type: "polygon",
            points: (ann.points || []).map((p: any) => ({
              x: Array.isArray(p) ? p[0] : p.x,
              y: Array.isArray(p) ? p[1] : p.y,
            })),
            label:
              typeof ann.label === "string" && ann.label.trim()
                ? ann.label.trim()
                : `InstantSeg ${idx + 1}`,
            severity: "Moyenne",
            category: "Zone suspecte",
            description: "Annotation générée automatiquement par InstantSeg",
            recommendation: null,
            tags: ["IA", "InstantSeg"],
            ownerId: currentUser.id,
            ownerName: iaOwnerName,
            createdAt: now,
            updatedAt: now,
            _source: "ia",
            strokeColor: visual.stroke,
            fillColor: visual.fill,
            strokeWidth: 3,
            confidence: ann.confidence != null ? String(ann.confidence) : null,
            notes: "Segmentation automatique",
          };
        })
        .filter((ann) => {
          const b = polygonBounds(ann.points);
          return b.w >= 20 && b.h >= 20;
        });

      const iaGroupRect = buildIaGroupRect(aiAnnotations, now, currentUser.id, iaOwnerName);

      setAnnotations((prev) => {
        const cleaned = prev.filter((a) => !isIaGroupRect(a));

        const next = iaGroupRect
          ? [...cleaned, iaGroupRect, ...aiAnnotations]
          : [...cleaned, ...aiAnnotations];

        if (scopedImageKey) saveAnnotations(scopedImageKey, next);
        return next;
      });

      await persistAiAnnotations(aiAnnotations);
      finishTransientActionAndReturnToFreePan();
    } catch (e: any) {
      console.error("InstantSeg error:", e);
      alert(`Erreur InstantSeg: ${e.message || e}`);
      finishTransientActionAndReturnToFreePan();
    } finally {
      setInstansegLoading(false);
    }
  }

  async function putAnnotationToApi(args: {
    imageId: string;
    caseId: string;
    ann: Annotation;
  }) {
    const { imageId: imgId, caseId: cId, ann } = args;

    const payload = {
      image_id: imgId,
      case_id: cId,
      type: ann.type,
      label: ann.label ?? "",
      severity: ann.severity ?? "Moyenne",
      category: ann.category ?? null,
      description: ann.description ?? null,
      recommendation: ann.recommendation ?? null,
      tags: ann.tags ?? [],
      stroke_color: ann.strokeColor ?? "#ff3b30",
      fill_color: ann.fillColor ?? "rgba(255,59,48,0.08)",
      stroke_width: ann.strokeWidth ?? 2,
      confidence: ann.confidence ?? null,
      notes: ann.notes ?? null,
      coordinates: buildCoordinatesPayload(ann),
    };

    const res = await fetch(`${IMAGES_API}/api/annotations/${ann.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`PUT annotation failed: ${res.status} - ${text}`);
    }

    return await res.json();
  }

  async function persistAnnotationGeometry(ann: Annotation) {
    if (!imageId || !caseId || !ann.id || String(ann.id).startsWith("tmp-")) return;

    try {
      const saved = await putAnnotationToApi({ imageId, caseId, ann });

      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === ann.id
            ? {
                ...a,
                updatedAt: saved.updated_at ?? saved.updatedAt ?? new Date().toISOString(),
              }
            : a
        )
      );
    } catch (e) {
      console.error("Erreur persistance géométrie annotation:", e);
      alert("La mise à jour de la forme a échoué.");
    }
  }
  
  async function persistAiAnnotations(list: Annotation[]) {
    if (!imageId || !caseId || !imageKey) return;

    for (const ann of list) {
      try {
        const saved = await postAnnotationToApi({ imageId, caseId, ann });

        setAnnotations((prev) => {
          const next = prev.map((a) =>
            a.id === ann.id
              ? {
                  ...a,
                  id: saved.id || a.id,
                  _source: "ia",
                  createdAt: saved.created_at ?? a.createdAt,
                  updatedAt: saved.updated_at ?? a.updatedAt,
                }
              : a
          );
          if (scopedImageKey) saveAnnotations(scopedImageKey, next);
          return next;
        });
      } catch (e) {
        console.error("Erreur sauvegarde annotation IA:", e);
      }
    }
  }

  function getShapeHandles(ann: Annotation): ShapeHandle[] {
    if (ann.type === "rect") {
      return [
        { annotationId: ann.id, index: 0, x: ann.x, y: ann.y },
        { annotationId: ann.id, index: 1, x: ann.x + ann.w, y: ann.y },
        { annotationId: ann.id, index: 2, x: ann.x + ann.w, y: ann.y + ann.h },
        { annotationId: ann.id, index: 3, x: ann.x, y: ann.y + ann.h },
      ];
    }

    if (ann.type === "circle") {
      return [
        { annotationId: ann.id, index: 0, x: ann.cx - ann.rx, y: ann.cy },
        { annotationId: ann.id, index: 1, x: ann.cx + ann.rx, y: ann.cy },
        { annotationId: ann.id, index: 2, x: ann.cx, y: ann.cy - ann.ry },
        { annotationId: ann.id, index: 3, x: ann.cx, y: ann.cy + ann.ry },
      ];
    }

    if (ann.type === "polygon") {
      return ann.points.map((p, idx) => ({
        annotationId: ann.id,
        index: idx,
        x: p.x,
        y: p.y,
      }));
    }

    return [];
  }

  function findHandleAtPoint(list: Annotation[], x: number, y: number, tolerance = 80): ShapeHandle | null {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const ann = list[i];
      if (!canEditAnnotation(ann)) continue;
      const handles = getShapeHandles(ann);
      for (const h of handles) {
        const dx = h.x - x;
        const dy = h.y - y;
        if (dx * dx + dy * dy <= tolerance * tolerance) {
          return h;
        }
      }
    }
    return null;
  }

  function inferShapeTypeFromCoordinates(
    coords: Record<string, any> | null | undefined,
  ): AnnotationType {
    if (!coords || typeof coords !== "object") return "rect";

    if (coords.shape_type === "polygon" || Array.isArray(coords.points)) {
      return "polygon";
    }

    if (
      coords.shape_type === "circle" ||
      (
        typeof coords.cx === "number" &&
        typeof coords.cy === "number" &&
        typeof coords.rx === "number" &&
        typeof coords.ry === "number"
      )
    ) {
      return "circle";
    }

    return "rect";
  }

  function cloneAnnotation<T extends Annotation>(ann: T): T {
    return JSON.parse(JSON.stringify(ann));
  }

  function translateAnnotation(ann: Annotation, dx: number, dy: number): Annotation {
    if (ann.type === "rect") {
      return { ...ann, x: ann.x + dx, y: ann.y + dy };
    }
    if (ann.type === "circle") {
      return { ...ann, cx: ann.cx + dx, cy: ann.cy + dy };
    }
    if (ann.type === "polygon") {
      return {
        ...ann,
        points: ann.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      };
    }
    return ann;
  }

  function annotationContainsPoint(ann: Annotation, x: number, y: number): boolean {
    if (ann.type === "rect") {
      return x >= ann.x && x <= ann.x + ann.w && y >= ann.y && y <= ann.y + ann.h;
    }

    if (ann.type === "circle") {
      const dx = (x - ann.cx) / Math.max(ann.rx, 1);
      const dy = (y - ann.cy) / Math.max(ann.ry, 1);
      return dx * dx + dy * dy <= 1;
    }

    if (ann.type === "polygon") {
      let inside = false;
      const pts = ann.points;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i].x, yi = pts[i].y;
        const xj = pts[j].x, yj = pts[j].y;
        const intersect =
          yi > y !== yj > y &&
          x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    }

    return false;
  }

  function findTopAnnotationAtPoint(list: Annotation[], x: number, y: number): Annotation | null {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const ann = list[i];
      if (annotationContainsPoint(ann, x, y)) return ann;
    }
    return null;
  }

  function zoomToAnnotation(ann: Annotation) {
    const viewer = viewerRef.current;
    if (!viewer) return;

    let rect:
      | { x: number; y: number; w: number; h: number }
      | null = null;

    if (ann.type === "rect") {
      rect = { x: ann.x, y: ann.y, w: ann.w, h: ann.h };
    } else if (ann.type === "circle") {
      rect = {
        x: ann.cx - ann.rx,
        y: ann.cy - ann.ry,
        w: ann.rx * 2,
        h: ann.ry * 2,
      };
    } else if (ann.type === "polygon" && ann.points.length > 0) {
      const b = polygonBounds(ann.points);
      rect = {
        x: b.minX,
        y: b.minY,
        w: Math.max(1, b.w),
        h: Math.max(1, b.h),
      };
    }

    if (!rect) return;

    const paddingFactor = 0.15;
    const padX = rect.w * paddingFactor;
    const padY = rect.h * paddingFactor;

    const targetRect = imageRectToViewportRect(viewer, {
      x: rect.x - padX,
      y: rect.y - padY,
      w: Math.max(1, rect.w + padX * 2),
      h: Math.max(1, rect.h + padY * 2),
    });

    setSelectedAnnotation(ann);
    viewer.viewport.fitBounds(targetRect, true);
  }

  function mapApiAnnotationToFrontend(a: ApiAnnotationRow): Annotation | null {
    const coords =
      a.coordinates && typeof a.coordinates === "object" ? a.coordinates : {};

    const shapeType = inferShapeTypeFromCoordinates(coords);
    const tags = Array.isArray(a.tags) ? a.tags : [];

    const isInstantSeg =
      tags.some((t) => String(t).toLowerCase() === "instanseg");

    const rawOwnerId = (a as any).owner_id ?? (a as any).user_id ?? null;
    const rawOwnerName = a.owner_name ?? rawOwnerId ?? null;

    const displayOwnerName = isInstantSeg
      ? rawOwnerName
        ? rawOwnerName.endsWith("(IA)")
          ? rawOwnerName
          : `${rawOwnerName} (IA)`
        : rawOwnerId
          ? `${rawOwnerId} (IA)`
          : "Utilisateur (IA)"
      : rawOwnerName;

    const base: BaseAnnotation = {
      id: a.id,
      type: shapeType,
      label: a.label ?? null,
      category: a.category ?? null,
      severity: (a.severity ?? "Moyenne") as Severity,
      description: a.description ?? null,
      recommendation: a.recommendation ?? null,
      tags,
      ownerId: rawOwnerId,
      ownerName: displayOwnerName,
      strokeColor: (a as any).stroke_color ?? "#ff3b30",
      fillColor: (a as any).fill_color ?? "rgba(255,59,48,0.08)",
      strokeWidth:
        typeof (a as any).stroke_width === "number"
          ? (a as any).stroke_width
          : Number((a as any).stroke_width ?? 2),
      createdAt: (a.created_at ?? a.createdAt ?? new Date().toISOString()) as string,
      updatedAt: (a.updated_at ?? a.updatedAt ?? null) as string | null,
      _source: "api",
      confidence: null,
      notes: null,
    };

    if (shapeType === "rect") {
      if (
        typeof coords.x !== "number" ||
        typeof coords.y !== "number" ||
        typeof coords.w !== "number" ||
        typeof coords.h !== "number"
      ) return null;

      return {
        ...base,
        type: "rect",
        x: coords.x,
        y: coords.y,
        w: coords.w,
        h: coords.h,
      };
    }

    if (shapeType === "circle") {
      if (
        typeof coords.cx !== "number" ||
        typeof coords.cy !== "number" ||
        typeof coords.rx !== "number" ||
        typeof coords.ry !== "number"
      ) return null;

      return {
        ...base,
        type: "circle",
        cx: coords.cx,
        cy: coords.cy,
        rx: coords.rx,
        ry: coords.ry,
      };
    }

    if (shapeType === "polygon") {
      if (!Array.isArray(coords.points)) return null;

      return {
        ...base,
        type: "polygon",
        points: coords.points.map((p: any) => ({
          x: Array.isArray(p) ? p[0] : p.x,
          y: Array.isArray(p) ? p[1] : p.y,
        })),
      };
    }

    return null;
  }

  const deleteSelectedAnnotation = async () => {
    if (!selectedAnnotation || !scopedImageKey) return;

    const previous = [...annotationsRef.current];

    const next = isIaGroupRect(selectedAnnotation)
      ? previous.filter((a) => !isInstantSegAnnotation(a))
      : previous.filter((a) => a.id !== selectedAnnotation.id);

    const toDelete = isIaGroupRect(selectedAnnotation)
      ? getInstantSegPersistedAnnotations(previous)
      : previous.filter(
          (a) =>
            a.id === selectedAnnotation.id && !String(a.id).startsWith("tmp-")
        );

    const viewer = viewerRef.current;

    setAnnotations(next);
    annotationsRef.current = next;
    saveAnnotations(scopedImageKey, next);

    setSelectedAnnotation(null);
    setDetailOpen(false);
    setPendingAnn(null);
    setDraftAnnotations([]);

    if (viewer) {
      clearRenderedOverlays(viewer);
      redrawAll(viewer, next, {
        reshapeMode,
        selectedId: null,
      });
    }

    try {
      await deleteAnnotationsFromApi(toDelete.map((a) => a.id));
    } catch (e) {
      console.error("Erreur suppression annotation:", e);

      setAnnotations(previous);
      annotationsRef.current = previous;
      saveAnnotations(scopedImageKey, previous);

      if (viewer) {
        clearRenderedOverlays(viewer);
        redrawAll(viewer, previous, {
          reshapeMode,
          selectedId: null,
        });
      }

      alert("La suppression de l’annotation a échoué côté serveur.");
    }
  };

  const deleteAnnotationFromList = async (ann: Annotation) => {
    if (!scopedImageKey) return;
    if (!canDeleteAnnotation(ann)) return;

    const previous = [...annotationsRef.current];

    const next = isIaGroupRect(ann)
      ? previous.filter((a) => !isInstantSegAnnotation(a))
      : previous.filter((a) => a.id !== ann.id);

    const toDelete = isIaGroupRect(ann)
      ? getInstantSegPersistedAnnotations(previous)
      : previous.filter(
          (a) => a.id === ann.id && !String(a.id).startsWith("tmp-")
        );

    const viewer = viewerRef.current;

    setAnnotations(next);
    annotationsRef.current = next;
    saveAnnotations(scopedImageKey, next);

    setSelectedAnnotation(null);
    setDetailOpen(false);
    setPendingAnn(null);
    setDraftAnnotations([]);

    if (viewer) {
      clearRenderedOverlays(viewer);
      redrawAll(viewer, next, {
        reshapeMode,
        selectedId: null,
      });
    }

    try {
      await deleteAnnotationsFromApi(toDelete.map((a) => a.id));
    } catch (e) {
      console.error("Erreur suppression annotation depuis liste:", e);

      setAnnotations(previous);
      annotationsRef.current = previous;
      saveAnnotations(scopedImageKey, previous);

      if (viewer) {
        clearRenderedOverlays(viewer);
        redrawAll(viewer, previous, {
          reshapeMode,
          selectedId: null,
        });
      }

      alert("La suppression de l’annotation a échoué côté serveur.");
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!scopedImageKey || !imageId || !caseId) {
        setAnnotations([]);
        return;
      }

      try {
        const apiAnnotations = await fetchAnnotationsForImage(imageId, caseId);
        if (cancelled) return;

        const mapped: Annotation[] = apiAnnotations
          .map(mapApiAnnotationToFrontend)
          .filter(Boolean) as Annotation[];

        const iaGroupRect = buildIaGroupRectFromExisting(mapped);

        const merged = iaGroupRect ? [iaGroupRect, ...mapped] : mapped;

        setAnnotations(merged);
        if (scopedImageKey) saveAnnotations(scopedImageKey, merged);
      } catch (e) {
        console.error("Erreur chargement annotations API:", e);

        if (!cancelled) {
          setAnnotations([]);
          if (scopedImageKey) saveAnnotations(scopedImageKey, []);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [scopedImageKey, imageId, caseId]);

  useEffect(() => {
    if (!containerRef.current || !sourceUrl) return;

    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    const tileSources =
      sourceType === "dzi" ? sourceUrl : [{ type: "image", url: sourceUrl }];

    const viewer = OpenSeadragon({
      element: containerRef.current,
      prefixUrl: "/openseadragon/images/",
      showNavigator: true,
      tileSources,
      crossOriginPolicy: "Anonymous",
      ajaxWithCredentials: false,
    });

    viewerRef.current = viewer;

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [sourceType, sourceUrl]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const draw = () => {
      redrawAll(viewer, [...annotations, ...draftAnnotations], {
        reshapeMode,
        selectedId: selectedAnnotation?.id ?? null,
      });
    };

    if (viewer.world && viewer.world.getItemCount() > 0) {
      draw();
    } else {
      viewer.addOnceHandler("open", draw);
    }

    return () => {
      try {
        viewer.removeHandler("open", draw);
      } catch {
        // ignore
      }
    };
  }, [annotations, draftAnnotations, sourceUrl, reshapeMode, selectedAnnotation]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const interactionLocked =
      annotateMode || captureMode || aiSegmentationMode || moveMode || reshapeMode;

    const applyGestureLock = (settings: any) => ({
      ...settings,
      dragToPan: !interactionLocked,
      scrollToZoom: !interactionLocked,
      clickToZoom: !interactionLocked,
      dblClickToZoom: !interactionLocked,
      pinchToZoom: !interactionLocked,
      flickEnabled: !interactionLocked,
    });

    viewer.gestureSettingsMouse = applyGestureLock(viewer.gestureSettingsMouse);
    viewer.gestureSettingsTouch = applyGestureLock(viewer.gestureSettingsTouch);
    viewer.gestureSettingsPen = applyGestureLock(viewer.gestureSettingsPen);
    viewer.gestureSettingsUnknown = applyGestureLock(viewer.gestureSettingsUnknown);

  }, [annotateMode, captureMode, aiSegmentationMode, moveMode, reshapeMode]);


  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const blockClickZoom = (evt: OpenSeadragon.OSDEvent<any>) => {
      if (moveMode || reshapeMode || annotateMode || captureMode || aiSegmentationMode) {
        evt.preventDefaultAction = true;
      }
    };

    viewer.addHandler("canvas-click", blockClickZoom);
    viewer.addHandler("canvas-double-click", blockClickZoom);

    return () => {
      viewer.removeHandler("canvas-click", blockClickZoom);
      viewer.removeHandler("canvas-double-click", blockClickZoom);
    };
  }, [moveMode, reshapeMode, annotateMode, captureMode, aiSegmentationMode]);


  useEffect(() => {
    if (annotateMode) return;

    const viewer = viewerRef.current;
    if (!viewer) return;

    if (dragRef.current.overlayEl) {
      try {
        viewer.removeOverlay(dragRef.current.overlayEl);
      } catch {
        // ignore
      }
    }

    dragRef.current.active = false;
    dragRef.current.startImage = null;
    dragRef.current.overlayEl = null;

    try {
      polygonCancel(viewer, dragRef as any);
    } catch {
      // ignore
    }

    setPendingAnn(null);
    setDraftAnnotations([]);
  }, [annotateMode]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !canAnnotate || !annotateMode) return;

    let attached = false;

    const attach = () => {
      if (attached) return;
      attached = true;

      const onPress = (evt: OpenSeadragon.OSDEvent<any>) => {
        if (!annotateMode || detailOpen) return;

        evt.preventDefaultAction = true;

        if (drawTool === "rect") {
          const [el, imagePoint] = drawOnPressRect(
            evt,
            viewer,
            dragRef as any,
            drawStrokeColor,
            drawFillColor
          );
          el.style.borderWidth = `${drawStrokeWidth}px`;
          el.dataset.kind = "temp";
          viewer.addOverlay({
            element: el,
            location: imageRectToViewportRect(viewer, {
              x: imagePoint.x,
              y: imagePoint.y,
              w: 1,
              h: 1,
            }),
          });
        } else if (drawTool === "circle") {
          const [el, imagePoint] = drawOnPressCircle(
            evt,
            viewer,
            dragRef as any,
            drawStrokeColor,
            drawFillColor
          );
          el.style.borderWidth = `${drawStrokeWidth}px`;
          el.dataset.kind = "temp";
          viewer.addOverlay({
            element: el,
            location: imageRectToViewportRect(viewer, {
              x: imagePoint.x,
              y: imagePoint.y,
              w: 1,
              h: 1,
            }),
          });
        } else if (drawTool === "polygon") {
          polygonAddPoint(evt, viewer, dragRef as any, {
            strokeColor: drawStrokeColor,
            fillColor: drawFillColor,
            strokeWidth: drawStrokeWidth,
          });
        }
      };

      const onDrag = (evt: OpenSeadragon.OSDEvent<any>) => {
        if (!annotateMode || detailOpen) return;
        if (!dragRef.current.active) return;

        evt.preventDefaultAction = true;

        if (drawTool === "rect") {
          const [el, x, y, w, h] = drawOnDragRect(evt, viewer, dragRef as any);
          if (el) {
            viewer.updateOverlay(
              el,
              imageRectToViewportRect(viewer, { x, y, w, h }),
            );
          }
        } else if (drawTool === "circle") {
          const [el, x, y, w, h] = drawOnDragCircle(
            evt,
            viewer,
            dragRef as any,
          );
          if (el) {
            const cx = x + w / 2;
            const cy = y + h / 2;
            const rx = w / 2;
            const ry = h / 2;
            viewer.updateOverlay(
              el,
              imageRectToViewportRect(viewer, {
                x: cx - rx,
                y: cy - ry,
                w: rx * 2,
                h: ry * 2,
              }),
            );
          }
        }
      };

      const onMove = (evt: OpenSeadragon.OSDEvent<any>) => {
        if (!annotateMode || detailOpen) return;
        if (drawTool !== "polygon") return;
        polygonMove(evt, viewer, dragRef as any);
      };

      const onDblClick = (evt: OpenSeadragon.OSDEvent<any>) => {
        if (!annotateMode || detailOpen) return;
        if (drawTool !== "polygon") return;
        evt.preventDefaultAction = true;
        finalizePolygon();
      };

      const onRelease = (evt: OpenSeadragon.OSDEvent<any>) => {
        if (!annotateMode || detailOpen) return;
        if (!dragRef.current.active) return;

        evt.preventDefaultAction = true;

        let annotation: Annotation | null = null;

        if (drawTool === "rect") {
          annotation = drawOnReleaseRect(
            evt,
            viewer,
            "rect",
            null,
            dragRef as any,
          );
        } else if (drawTool === "circle") {
          annotation = drawOnReleaseCircle(
            evt,
            viewer,
            "circle",
            null,
            dragRef as any,
          );
        } else {
          return;
        }

        if (!annotation) return;

        setPendingAnn(annotation);
        setSelectedAnnotation(annotation);
        setDraftAnnotations([annotation]);
        setFormMode("create");
        resetFormFields();
        setDetailOpen(true);
      };

      viewer.addHandler("canvas-press", onPress);
      viewer.addHandler("canvas-drag", onDrag);
      viewer.addHandler("canvas-release", onRelease);
      viewer.addHandler("canvas-move", onMove);
      viewer.addHandler("canvas-double-click", onDblClick);

      (attach as any)._cleanup = () => {
        viewer.removeHandler("canvas-press", onPress);
        viewer.removeHandler("canvas-drag", onDrag);
        viewer.removeHandler("canvas-release", onRelease);
        viewer.removeHandler("canvas-move", onMove);
        viewer.removeHandler("canvas-double-click", onDblClick);
      };
    };

    if (viewer.world && viewer.world.getItemCount() > 0) {
      attach();
    } else {
      viewer.addOnceHandler("open", attach);
    }

    return () => {
      try {
        viewer.removeHandler("open", attach);
        const cleanup = (attach as any)._cleanup as undefined | (() => void);
        if (cleanup) cleanup();
      } catch {
        // ignore
      }
    };
  }, [annotateMode, canAnnotate, drawTool, detailOpen]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const container = containerRef.current;
    if (!viewer || !container) return;
    if (!captureMode && !aiSegmentationMode) return;

    let attached = false;

    const attach = () => {
      if (attached) return;
      attached = true;

      const makeOverlayRect = () => {
        const el = document.createElement("div");
        el.style.boxSizing = "border-box";
        el.style.border = "2px dashed #2563eb";
        el.style.background = "rgba(37,99,235,0.10)";
        el.style.pointerEvents = "none";
        el.style.borderRadius = "4px";
        el.dataset.kind = "capture";
        return el;
      };

      const getLocalPoint = (evt: any) => {
        const bounds = container.getBoundingClientRect();
        const p = evt.position as OpenSeadragon.Point | undefined;

        if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
          return {
            x: Math.max(0, Math.min(bounds.width, p.x)),
            y: Math.max(0, Math.min(bounds.height, p.y)),
          };
        }

        const oe = evt.originalEvent as MouseEvent | PointerEvent | undefined;
        const clientX = oe?.clientX ?? bounds.left;
        const clientY = oe?.clientY ?? bounds.top;

        return {
          x: Math.max(0, Math.min(bounds.width, clientX - bounds.left)),
          y: Math.max(0, Math.min(bounds.height, clientY - bounds.top)),
        };
      };

      const isSelectionModeActive = () => captureMode || aiSegmentationMode;

      const onPress = (evt: OpenSeadragon.OSDEvent<any>) => {
        if (!isSelectionModeActive() || detailOpen) return;

        evt.preventDefaultAction = true;

        cleanupCaptureOverlay();

        const start = getLocalPoint(evt);
        console.log("InstantSeg press", start);

        const el = makeOverlayRect();

        captureDragRef.current.active = true;
        captureDragRef.current.startPx = start;
        captureDragRef.current.overlayEl = el;

        viewer.addOverlay({
          element: el,
          location: new OpenSeadragon.Rect(0, 0, 0, 0),
        });
      };

      const onDrag = (evt: OpenSeadragon.OSDEvent<any>) => {
        if (!isSelectionModeActive() || !captureDragRef.current.active) return;

        evt.preventDefaultAction = true;

        const start = captureDragRef.current.startPx;
        const el = captureDragRef.current.overlayEl;
        if (!start || !el) return;

        const p = getLocalPoint(evt);
        console.log("InstantSeg drag", { start, current: p });

        const x = Math.min(start.x, p.x);
        const y = Math.min(start.y, p.y);
        const w = Math.abs(p.x - start.x);
        const h = Math.abs(p.y - start.y);

        const topLeftVp = viewer.viewport.pointFromPixel(
          new OpenSeadragon.Point(x, y),
          true
        );
        const bottomRightVp = viewer.viewport.pointFromPixel(
          new OpenSeadragon.Point(x + w, y + h),
          true
        );

        viewer.updateOverlay(
          el,
          new OpenSeadragon.Rect(
            topLeftVp.x,
            topLeftVp.y,
            bottomRightVp.x - topLeftVp.x,
            bottomRightVp.y - topLeftVp.y
          )
        );
      };

      const onRelease = (evt: OpenSeadragon.OSDEvent<any>) => {
        if (!isSelectionModeActive() || !captureDragRef.current.active) return;

        evt.preventDefaultAction = true;

        const start = captureDragRef.current.startPx;
        if (!start) {
          cleanupCaptureOverlay();
          return;
        }

        const p = getLocalPoint(evt);

        const x = Math.min(start.x, p.x);
        const y = Math.min(start.y, p.y);
        const w = Math.abs(p.x - start.x);
        const h = Math.abs(p.y - start.y);

        console.log("InstantSeg release", { x, y, w, h, aiSegmentationMode });

        cleanupCaptureOverlay();

        if (w < 8 || h < 8) {
          finishTransientActionAndReturnToFreePan();
          return;
        }

        if (aiSegmentationMode) {
          void runInstantSegOnSelection({ x, y, w, h });
          return;
        }

        exportCaptureFromSelection({ x, y, w, h });
        finishTransientActionAndReturnToFreePan();
      };

      viewer.addHandler("canvas-press", onPress);
      viewer.addHandler("canvas-drag", onDrag);
      viewer.addHandler("canvas-release", onRelease);

      (attach as any)._cleanup = () => {
        viewer.removeHandler("canvas-press", onPress);
        viewer.removeHandler("canvas-drag", onDrag);
        viewer.removeHandler("canvas-release", onRelease);
      };
    };

    if (viewer.world && viewer.world.getItemCount() > 0) {
      attach();
    } else {
      viewer.addOnceHandler("open", attach);
    }

    return () => {
      cleanupCaptureOverlay();
      try {
        viewer.removeHandler("open", attach);
        const cleanup = (attach as any)._cleanup as undefined | (() => void);
        if (cleanup) cleanup();
      } catch {
        // ignore
      }
    };
  }, [captureMode, aiSegmentationMode, detailOpen, sourceUrl]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !moveMode) return;

    const imagePointFromEvt = (evt: any) => {
      const webPoint = evt.position as OpenSeadragon.Point;
      return viewer.viewport.viewportToImageCoordinates(
        viewer.viewport.pointFromPixel(webPoint)
      );
    };

    const onPress = (evt: OpenSeadragon.OSDEvent<any>) => {
      if (!moveMode || detailOpenRef.current) return;
      evt.preventDefaultAction = true;

      const p = imagePointFromEvt(evt);
      const ann = findTopAnnotationAtPoint(annotationsRef.current, p.x, p.y);
      if (!ann || !canEditAnnotation(ann)) return;

      editDragRef.current.active = true;
      editDragRef.current.annotationId = ann.id;
      editDragRef.current.kind = "move";
      editDragRef.current.handleIndex = null;
      editDragRef.current.startImage = { x: p.x, y: p.y };
      editDragRef.current.original = cloneAnnotation(ann);
      setSelectedAnnotation(ann);
    };

    const onDrag = (evt: OpenSeadragon.OSDEvent<any>) => {
      if (!editDragRef.current.active || editDragRef.current.kind !== "move") return;
      evt.preventDefaultAction = true;

      const start = editDragRef.current.startImage;
      const original = editDragRef.current.original;
      if (!start || !original) return;

      const p = imagePointFromEvt(evt);
      const dx = p.x - start.x;
      const dy = p.y - start.y;

      const moved = translateAnnotation(original, dx, dy);

      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === original.id
            ? { ...moved, updatedAt: new Date().toISOString() }
            : a
        )
      );
      setSelectedAnnotation(moved);
    };

    const onRelease = async () => {
      if (!editDragRef.current.active) return;

      const annId = editDragRef.current.annotationId;

      editDragRef.current.active = false;
      editDragRef.current.annotationId = null;
      editDragRef.current.kind = null;
      editDragRef.current.handleIndex = null;
      editDragRef.current.startImage = null;
      editDragRef.current.original = null;

      if (!annId || !imageKey) return;

      const updated = annotationsRef.current.find((a) => a.id === annId);
      if (updated) {
        if (scopedImageKey) saveAnnotations(scopedImageKey, annotationsRef.current);
        await persistAnnotationGeometry(updated);
      }
    };

    viewer.addHandler("canvas-press", onPress);
    viewer.addHandler("canvas-drag", onDrag);
    viewer.addHandler("canvas-release", onRelease);

    return () => {
      viewer.removeHandler("canvas-press", onPress);
      viewer.removeHandler("canvas-drag", onDrag);
      viewer.removeHandler("canvas-release", onRelease);
    };
  }, [moveMode, imageKey]);

  const finalizePolygon = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const [ann] = polygonFinish(viewer, dragRef as any, null);
    if (!ann) return;

    setPendingAnn(ann);
    setSelectedAnnotation(ann);
    setDraftAnnotations([ann]);
    setFormMode("create");
    resetFormFields();
    setDetailOpen(true);
  };

  const cancelPolygonUi = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    polygonCancel(viewer, dragRef as any);
  };

  const onToggleAnnotate = () => {
    if (!canAnnotate) return;

    cleanupCaptureOverlay();
    setPendingAnn(null);
    setDraftAnnotations([]);
    setSelectedAnnotation(null);
    setDetailOpen(false);

    setCaptureMode(false);
    setAiSegmentationMode(false);
    setMoveMode(false);
    setReshapeMode(false);

    setAnnotateMode((prev) => {
      const next = !prev;
      setFreePanMode(!next);
      return next;
    });

    setCapturePreviewOpen(false);
    setCapturePreviewUrl(null);
  };

  const onToggleCapture = () => {
    cleanupCaptureOverlay();
    setPendingAnn(null);
    setDraftAnnotations([]);
    setSelectedAnnotation(null);
    setDetailOpen(false);

    setAnnotateMode(false);
    setAiSegmentationMode(false);
    setMoveMode(false);
    setReshapeMode(false);

    setCaptureMode((prev) => {
      const next = !prev;
      setFreePanMode(!next);
      return next;
    });

    setCapturePreviewOpen(false);
    setCapturePreviewUrl(null);
  };

  const onClear = async () => {
    if (!scopedImageKey) return;
    if (annotations.length === 0) return;

    const toDelete = [...annotationsRef.current];
    const viewer = viewerRef.current;

    setAnnotations([]);
    annotationsRef.current = [];
    saveAnnotations(scopedImageKey, []);

    setSelectedAnnotation(null);
    setDetailOpen(false);
    setPendingAnn(null);
    setDraftAnnotations([]);

    if (viewer) {
      clearRenderedOverlays(viewer);
      redrawAll(viewer, [], {
        reshapeMode,
        selectedId: null,
      });
    }

    switchToFreePanMode();

    try {
      await deleteAnnotationsFromApi(toDelete.map((a) => a.id));
    } catch (e) {
      console.error("Erreur suppression annotations API:", e);

      setAnnotations(toDelete);
      annotationsRef.current = toDelete;
      saveAnnotations(scopedImageKey, toDelete);

      if (viewer) {
        clearRenderedOverlays(viewer);
        redrawAll(viewer, toDelete, {
          reshapeMode,
          selectedId: null,
        });
      }

      alert("La suppression des annotations a échoué côté serveur.");
    }
  };

  function getToken() {
    return (
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      ""
    );
  }

  function makeTempAnnotationId() {
    return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function authHeaders(): HeadersInit {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function postAnnotationToApi(args: {
    imageId: string;
    caseId: string;
    ann: Annotation;
  }): Promise<any> {
    const { imageId: imgId, caseId: cId, ann } = args;

    const payload = {
      image_id: imgId,
      case_id: cId,
      type: ann.type,
      label: ann.label ?? "",
      severity: ann.severity ?? "Moyenne",
      category: ann.category ?? null,
      description: ann.description ?? null,
      recommendation: ann.recommendation ?? null,
      tags: ann.tags ?? [],
      stroke_color: ann.strokeColor ?? "#ff3b30",
      fill_color: ann.fillColor ?? "rgba(255,59,48,0.08)",
      stroke_width: ann.strokeWidth ?? 2,
      confidence: ann.confidence ?? null,
      notes: ann.notes ?? null,
      coordinates: buildCoordinatesPayload(ann),
    };

    const res = await fetch(`${IMAGES_API}/api/annotations/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("POST /api/annotations error:", res.status, text, payload);
      throw new Error(`POST annotation failed: ${res.status} - ${text}`);
    }

    return await res.json();
  }

  async function deleteAnnotationFromApi(annotationId: string) {
    const res = await fetch(`${IMAGES_API}/api/annotations/${annotationId}`, {
      method: "DELETE",
      headers: {
        ...authHeaders(),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`DELETE annotation failed: ${res.status} - ${text}`);
    }
  }

  async function deleteAnnotationsFromApi(annotationIds: string[]) {
    for (const id of annotationIds) {
      if (!id || String(id).startsWith("tmp-")) continue;
      await deleteAnnotationFromApi(id);
    }
  }

  function buildCoordinatesPayload(ann: Annotation): Record<string, any> {
    if (ann.type === "rect") {
      return {
        shape_type: "rect",
        x: ann.x,
        y: ann.y,
        w: ann.w,
        h: ann.h,
      };
    }

    if (ann.type === "circle") {
      return {
        shape_type: "circle",
        cx: ann.cx,
        cy: ann.cy,
        rx: ann.rx,
        ry: ann.ry,
      };
    }

    if (ann.type === "polygon") {
      return {
        shape_type: "polygon",
        points: ann.points,
      };
    }

    return {};
  }

  function resetAnnotationFilters() {
    setFilterCategory("");
    setFilterTag("");
    setFilterSeverity("");
    setFilterOwner("");
  }

  const commitPendingAnnotation = async () => {
    if (!pendingAnn || !imageKey) return;

    const currentUser = getCurrentUser();
    const extracted = extractAnnotationPayloadFromForm(formValues);
    const tempId = pendingAnn.id || makeTempAnnotationId();

    const localAnn: Annotation = {
      ...pendingAnn,
      id: tempId,
      _source: "local",
      label: extracted.label,
      severity: extracted.severity,
      category: extracted.category,
      description: extracted.description,
      recommendation: extracted.recommendation,
      tags: extracted.tags,
      notes: extracted.description,
      ownerId: currentUser.id,
      ownerName: currentUser.name,
      strokeColor: drawStrokeColor,
      fillColor: drawFillColor,
      strokeWidth: drawStrokeWidth,
      createdAt: pendingAnn.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // affichage immédiat optimiste
    setAnnotations((prev) => {
      const next = [...prev, localAnn];
      if (scopedImageKey) saveAnnotations(scopedImageKey, next);
      return next;
    });

    setPendingAnn(null);
    setDraftAnnotations([]);
    setSelectedAnnotation(localAnn);
    setFormMode("view");
    setDetailOpen(false);
    resetFormFields();

    // si pas d'identifiants backend, on garde seulement le local
    if (!imageId || !caseId) {
      return;
    }

    try {
      const saved = await postAnnotationToApi({
        imageId,
        caseId,
        ann: localAnn,
      });

      const savedAnn: Annotation = {
        ...localAnn,
        id: saved.id || localAnn.id,
        _source: "api",
        ownerId: saved.owner_id ?? saved.user_id ?? localAnn.ownerId,
        ownerName: saved.owner_name ?? localAnn.ownerName,
        createdAt: saved.created_at ?? saved.createdAt ?? localAnn.createdAt,
        updatedAt: saved.updated_at ?? saved.updatedAt ?? localAnn.updatedAt,
        severity: saved.severity ?? localAnn.severity,
        category: saved.category ?? localAnn.category,
        description: saved.description ?? localAnn.description,
        recommendation: saved.recommendation ?? localAnn.recommendation,
        tags: Array.isArray(saved.tags) ? saved.tags : localAnn.tags,
        strokeColor: saved.stroke_color ?? localAnn.strokeColor,
        fillColor: saved.fill_color ?? localAnn.fillColor,
        strokeWidth:
          typeof saved.stroke_width === "number"
            ? saved.stroke_width
            : Number(saved.stroke_width ?? localAnn.strokeWidth ?? 2),
      };

      setAnnotations((prev) => {
        const next = prev.map((a) => (a.id === tempId ? savedAnn : a));
        if (scopedImageKey) saveAnnotations(scopedImageKey, next);
        return next;
      });

      setSelectedAnnotation(savedAnn);
    } catch (e) {
      console.error("Erreur sauvegarde annotation API:", e);

      setAnnotations((prev) => {
        const next = prev.filter((a) => a.id !== tempId);
        if (scopedImageKey) saveAnnotations(scopedImageKey, next);
        return next;
      });

      setSelectedAnnotation(null);
      alert("La sauvegarde de l’annotation a échoué. Vérifie le backend /api/annotations et la console réseau.");
    }
  };

  const normalizeFilterValue = (value: unknown) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const matchesFilter = (candidate: unknown, filterValue: string) => {
    if (!filterValue) return true;
    return normalizeFilterValue(candidate) === normalizeFilterValue(filterValue);
  };

  const matchesTagFilter = (tags: string[] | null | undefined, filterValue: string) => {
    if (!filterValue) return true;
    return (tags || []).some((tag) => matchesFilter(tag, filterValue));
  };

  const availableCategories = useMemo(() => {
    return Array.from(
      new Set(
        annotations
          .map((a) => (a.category || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) =>
        String(a ?? "").localeCompare(String(b ?? ""), "fr", {
          sensitivity: "base", // ignore accents (é = e)
          ignorePunctuation: true,
        })
      );
  }, [annotations]);

  const availableTags = useMemo(() => {
    return Array.from(
      new Set(
        annotations.flatMap((a) =>
          (a.tags || []).map((tag) => String(tag || "").trim()).filter(Boolean)
        )
      )
    ).sort((a, b) =>
        String(a ?? "").localeCompare(String(b ?? ""), "fr", {
          sensitivity: "base", // ignore accents (é = e)
          ignorePunctuation: true,
        })
      );
  }, [annotations]);

  const availableSeverities = useMemo(() => {
    return Array.from(
      new Set(
        annotations
          .map((a) => (a.severity || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) =>
        String(a ?? "").localeCompare(String(b ?? ""), "fr", {
          sensitivity: "base", // ignore accents (é = e)
          ignorePunctuation: true,
        })
      );
  }, [annotations]);

  const availableOwners = useMemo(() => {
    return Array.from(
      new Set(
        annotations
          .map((a) => (a.ownerName || a.ownerId || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) =>
        String(a ?? "").localeCompare(String(b ?? ""), "fr", {
          sensitivity: "base", // ignore accents (é = e)
          ignorePunctuation: true,
        })
      );
  }, [annotations]);

  const annotationItems = useMemo(() => {
    return [...annotations]
      .filter((a) => {
        if (!a) return false;

        const isShape =
          a.type === "rect" || a.type === "circle" || a.type === "polygon";
        if (!isShape) return false;

        // masquer les petits segments InstantSeg
        if (isInstantSegPolygon(a)) return false;

        // pour InstantSeg, ne garder que le rectangle groupe
        if (isInstantSegAnnotation(a) && !isIaGroupRect(a)) {
          return false;
        }

        const owner = a.ownerName || a.ownerId || "";

        const categoryOk = matchesFilter(a.category || "", filterCategory);
        const tagOk = matchesTagFilter(a.tags, filterTag);
        const severityOk = matchesFilter(a.severity || "", filterSeverity);
        const ownerOk = matchesFilter(owner, filterOwner);

        return categoryOk && tagOk && severityOk && ownerOk;
      })
      .sort((a, b) => {
        const da = new Date(a.createdAt).getTime();
        const db = new Date(b.createdAt).getTime();
        return db - da;
      });
  }, [annotations, filterCategory, filterTag, filterSeverity, filterOwner]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        height: "100%",
      }}
    >
      <div style={styles.toolbar}>
        <div style={styles.group}>
          <ToolButton
            title="Déplacement libre"
            active={freePanMode}
            disabled={false}
            onClick={switchToFreePanMode}
            icon={IconMousePointer}
          />

          <ToolButton
            title={
              annotateMode ? "Mode annotation (ON)" : "Mode annotation (OFF)"
            }
            active={annotateMode}
            disabled={!canAnnotate}
            onClick={onToggleAnnotate}
            icon={IconPencil}
          />
          <ToolButton
            title={captureMode ? "Mode capture (ON)" : "Mode capture (OFF)"}
            active={captureMode}
            disabled={false}
            onClick={onToggleCapture}
            icon={IconCamera}
          />

          <ToolButton
            title={aiSegmentationMode ? "Segmentation IA (ON)" : "Segmentation IA (OFF)"}
            active={aiSegmentationMode}
            disabled={!canAnnotate}
            onClick={() => {
              cleanupCaptureOverlay();
              setPendingAnn(null);
              setDraftAnnotations([]);
              setSelectedAnnotation(null);
              setDetailOpen(false);
              setCapturePreviewOpen(false);
              setCapturePreviewUrl(null);

              setAnnotateMode(false);
              setCaptureMode(false);
              setMoveMode(false);
              setReshapeMode(false);

              setAiSegmentationMode((prev) => {
                const next = !prev;
                setFreePanMode(!next);
                return next;
              });
            }}
            icon={IconSparkles}
          />

          <ToolButton
            title={moveMode ? "Déplacement (ON)" : "Déplacement (OFF)"}
            active={moveMode}
            disabled={!canAnnotate}
            onClick={() => {
              cleanupCaptureOverlay();
              setPendingAnn(null);
              setDraftAnnotations([]);
              setSelectedAnnotation(null);
              setDetailOpen(false);

              setAnnotateMode(false);
              setCaptureMode(false);
              setAiSegmentationMode(false);
              setReshapeMode(false);

              setMoveMode((prev) => {
                const next = !prev;
                setFreePanMode(!next);
                return next;
              });
            }}
            icon={IconMove}
          />

          <ToolButton
            title={reshapeMode ? "Édition forme (ON)" : "Édition forme (OFF)"}
            active={reshapeMode}
            disabled={!canAnnotate}
            onClick={() => {
              cleanupCaptureOverlay();
              setPendingAnn(null);
              setDraftAnnotations([]);
              setSelectedAnnotation(null);
              setDetailOpen(false);

              setAnnotateMode(false);
              setCaptureMode(false);
              setAiSegmentationMode(false);
              setMoveMode(false);

              setReshapeMode((prev) => {
                const next = !prev;
                setFreePanMode(!next);
                return next;
              });
            }}
            icon={IconEditShape}
          />
        </div>

        {annotateMode && (
          <>
            <div style={styles.divider} />

            <div style={styles.group}>
              <ToolButton
                title="Rectangle"
                active={drawTool === "rect"}
                disabled={!canAnnotate}
                onClick={() => setDrawTool("rect")}
                icon={IconRect}
              />
              <ToolButton
                title="Cercle"
                active={drawTool === "circle"}
                disabled={!canAnnotate}
                onClick={() => setDrawTool("circle")}
                icon={IconCircle}
              />
              <ToolButton
                title="Polygone"
                active={drawTool === "polygon"}
                disabled={!canAnnotate}
                onClick={() => setDrawTool("polygon")}
                icon={IconPolygon}
              />
              <ToolButton
                title="Paramètres de dessin"
                active={drawSettingsOpen}
                disabled={!canAnnotate}
                onClick={() => setDrawSettingsOpen((v) => !v)}
                icon={IconSliders}
              />
            </div>
          </>
        )}

        {drawTool === "polygon" && annotateMode && (
          <>
            <div style={styles.divider} />
            <div style={styles.group}>
              <ToolButton
                title="Terminer polygone"
                active={false}
                disabled={!canAnnotate}
                onClick={finalizePolygon}
                icon={IconCheck}
              />
              <ToolButton
                title="Annuler polygone"
                active={false}
                disabled={!canAnnotate}
                onClick={cancelPolygonUi}
                icon={IconX}
              />
            </div>
          </>
        )}

        {annotateMode && drawSettingsOpen && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
              padding: 12,
              border: "1px solid #e6e6e6",
              borderRadius: 10,
              background: "#fff",
            }}
          >
            <label style={modalStyles.label}>
              Couleur ligne
              <input
                type="color"
                value={toColorInput(drawStrokeColor)}
                onChange={(e) => setDrawStrokeColor(e.target.value)}
                style={styles.colorInput}
              />
            </label>

            <label style={modalStyles.label}>
              Couleur fond
              <input
                type="color"
                value={toColorInput(drawFillColor)}
                onChange={(e) => {
                  const hex = e.target.value;
                  setDrawFillColor(hexToRgba(hex, 0.18));
                }}
                style={styles.colorInput}
              />
            </label>

            <label style={modalStyles.label}>
              Épaisseur ligne
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={drawStrokeWidth}
                onChange={(e) => setDrawStrokeWidth(Number(e.target.value))}
              />
              <span>{drawStrokeWidth}px</span>
            </label>
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={styles.group}>
          <div style={styles.counter}>{annotations.length} annotation(s)</div>
          <ToolButton
            title="Effacer toutes les annotations"
            active={false}
            disabled={!canAnnotate || annotations.length === 0}
            onClick={onClear}
            icon={IconTrash}
          />
        </div>
      </div>

      <div style={styles.contentLayout}>
        <div
          ref={containerRef}
          style={{
            flex: 1,
            minHeight: 320,
            border: "1px solid #e6e6e6",
            borderRadius: 10,
            overflow: "hidden",
            background: "#fafafa",
            position: "relative",
          }}
        />

        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <div style={styles.sidebarHeaderTop}>
              <div>Labels / annotations</div>

              <button
                type="button"
                onClick={resetAnnotationFilters}
                style={styles.filterResetBtn}
                disabled={
                  !filterCategory && !filterTag && !filterSeverity && !filterOwner
                }
              >
                Reset
              </button>
            </div>

            <div style={styles.filterGrid}>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="">Catégorie</option>
                {availableCategories.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>

              <select
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="">Tag</option>
                {availableTags.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>

              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="">Grade / sévérité</option>
                {availableSeverities.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>

              <select
                value={filterOwner}
                onChange={(e) => setFilterOwner(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="">Utilisateur</option>
                {availableOwners.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {annotationItems.length === 0 ? (
            <div style={styles.emptyState}>
              Aucune annotation ne correspond aux filtres
            </div>
          ) : (
            <div style={styles.annotationList}>
              {annotationItems.map((ann) => {
                const owner = ann.ownerName || ann.ownerId || "Inconnu";
                const title =
                  ann.label?.trim() ||
                  (ann._source === "ia"
                    ? "Segmentation InstantSeg"
                    : `${ann.type === "rect"
                        ? "Rectangle"
                        : ann.type === "circle"
                          ? "Cercle"
                          : "Polygone"
                      } sans label`);

                return (
                  <div
                    key={ann.id}
                    onClick={() => zoomToAnnotation(ann)}
                    style={{
                      ...styles.annotationCard,
                      ...(selectedAnnotation?.id === ann.id
                        ? styles.annotationCardActive
                        : null),
                      cursor: "pointer",
                    }}
                  >
                    <div style={styles.annotationCardTop}>
                      <div style={styles.annotationTitle}>{title}</div>
                      <div style={styles.annotationType}>{ann.type}</div>
                    </div>

                    <div style={styles.annotationMeta}>
                      <div>
                        <strong>Titre :</strong> {title}
                      </div>

                      <div>
                        <strong>Tags :</strong>{" "}
                        {(ann.tags || []).length > 0 ? ann.tags!.join(", ") : "—"}
                      </div>

                      <div>
                        <strong>Grade :</strong> {ann.severity || "—"}
                      </div>

                      <div>
                        <strong>Catégorie :</strong> {ann.category || "—"}
                      </div>

                      <div>
                        <strong>Propriétaire :</strong> {owner}
                      </div>
                    </div>

                    <div style={styles.annotationActions}>
                      <button
                        type="button"
                        style={modalStyles.secondaryBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          openAnnotationDetails(ann);
                        }}
                      >
                        View
                      </button>

                      {canDeleteAnnotation(ann) && (
                        <button
                          type="button"
                          style={{
                            ...modalStyles.secondaryBtn,
                            border: "1px solid #dc2626",
                            color: "#dc2626",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            void deleteAnnotationFromList(ann);
                          }}
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {detailOpen && (
        <div style={modalStyles.backdrop}>
          <div style={modalStyles.modalLarge}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                gap: 12,
              }}
            >
              <h3 style={{ margin: 0 }}>
                {formMode === "create"
                  ? "Nouvelle annotation"
                  : "Détail de l’annotation"}
              </h3>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {isOwnedExistingAnnotationView && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormMode("edit");
                    }}
                    style={modalStyles.secondaryBtn}
                  >
                    Modifier
                  </button>
                )}

                {isDeletableSelectedAnnotation && formMode === "view" && (
                  <button
                    type="button"
                    onClick={() => {
                      void deleteSelectedAnnotation();
                    }}
                    style={{
                      ...modalStyles.secondaryBtn,
                      border: "1px solid #dc2626",
                      color: "#dc2626",
                    }}
                  >
                    Supprimer
                  </button>
                )}

                {(isOwnedExistingAnnotationView || isForeignExistingAnnotationView) && (
                  <button
                    type="button"
                    onClick={() => {
                      closeDetailModal();
                    }}
                    style={modalStyles.secondaryBtn}
                  >
                    Fermer
                  </button>
                )}
              </div>
            </div>

            <div style={formGridStyles.scrollBody}>
              <div style={formGridStyles.grid}>
                {olgaFormLoading && (
                  <div style={{ gridColumn: "1 / -1", color: "#475569" }}>
                    Chargement du formulaire Olga...
                  </div>
                )}

                {!olgaFormLoading && olgaFormError && (
                  <div style={{ gridColumn: "1 / -1", color: "#dc2626" }}>
                    {olgaFormError}
                  </div>
                )}

                {!olgaFormLoading &&
                  !olgaFormError &&
                  (olgaForm?.form?.length ?? 0) > 0 && (
                    <>
                      {olgaForm!.form!.map((field) => {
                        const type = field.field_type?.toLowerCase?.() || "";
                        const label = getOlgaFieldLabel(field);
                        const value = getFieldValue(field.field_key, "");
                        const disabled = formMode === "view";

                        if (type.includes("textarea")) {
                          return (
                            <label
                              key={field.unique_id || field.field_key}
                              style={{ ...modalStyles.label, gridColumn: "1 / -1" }}
                            >
                              {label}
                              <textarea
                                value={value}
                                onChange={(e) =>
                                  setFieldValue(field.field_key, e.target.value)
                                }
                                style={modalStyles.textarea}
                                disabled={disabled}
                                placeholder={field.field_hint || ""}
                              />
                            </label>
                          );
                        }

                        if (type.includes("select")) {
                          const selectOptions =
                            field.options ||
                            field.field_options?.options ||
                            field.field_options?.values?.map((v: any) => ({
                              label: v,
                              value: v,
                            })) ||
                            [];

                          return (
                            <label key={field.unique_id || field.field_key} style={modalStyles.label}>
                              {label}
                              <select
                                value={value}
                                onChange={(e) => setFieldValue(field.field_key, e.target.value)}
                                style={modalStyles.input}
                                disabled={disabled}
                              >
                                <option value="">Sélectionner</option>

                                {selectOptions.map((opt: any, idx: number) => {
                                  const optionValue = opt.value ?? opt.label ?? "";
                                  const optionLabel = opt.label ?? opt.value ?? "";

                                  return (
                                    <option
                                      key={`${field.field_key}-${idx}`}
                                      value={optionValue}
                                    >
                                      {optionLabel}
                                    </option>
                                  );
                                })}
                              </select>
                            </label>
                          );
                        }

                        if (type.includes("checkbox")) {
                          return (
                            <label
                              key={field.unique_id || field.field_key}
                              style={{
                                ...modalStyles.label,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginTop: 24,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={!!value}
                                onChange={(e) =>
                                  setFieldValue(field.field_key, e.target.checked)
                                }
                                disabled={disabled}
                              />
                              {label}
                            </label>
                          );
                        }

                        return (
                          <label
                            key={field.unique_id || field.field_key}
                            style={modalStyles.label}
                          >
                            {label}
                            <input
                              type={type.includes("number") ? "number" : "text"}
                              value={value}
                              onChange={(e) =>
                                setFieldValue(field.field_key, e.target.value)
                              }
                              style={modalStyles.input}
                              disabled={disabled}
                              placeholder={field.field_hint || ""}
                            />
                          </label>
                        );
                      })}
                    </>
                  )}

                {!olgaFormLoading &&
                  !olgaFormError &&
                  (!olgaForm?.form || olgaForm.form.length === 0) && (
                    <div style={{ gridColumn: "1 / -1", color: "#64748b" }}>
                      Aucun champ retourné par Olga pour le formulaire
                      creationLabelPatho.
                    </div>
                  )}

                {selectedAnnotation && (
                  <div style={formGridStyles.metaBox}>
                    <div>
                      <strong>Type :</strong> {selectedAnnotation.type}
                    </div>
                    <div>
                      <strong>Créé le :</strong>{" "}
                      {new Date(selectedAnnotation.createdAt).toLocaleString(
                        "fr-FR",
                      )}
                    </div>
                    <div>
                      <strong>Propriétaire :</strong>{" "}
                      {selectedAnnotation.ownerName ||
                        selectedAnnotation.ownerId ||
                        "Inconnu"}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {(formMode === "create" || formMode === "edit") && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 14,
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (formMode === "edit" && selectedAnnotation) {
                      fillFormFromAnnotation(selectedAnnotation);
                      setFormMode("view");
                      return;
                    }

                    closeDetailModal();
                  }}
                  style={modalStyles.secondaryBtn}
                >
                  {formMode === "edit" ? "Annuler" : "Annuler"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (formMode === "create") {
                      void commitPendingAnnotation();
                      return;
                    }

                    if (!selectedAnnotation || !imageKey) return;

                    const extracted = extractAnnotationPayloadFromForm(formValues);

                    const updated: Annotation = {
                      ...selectedAnnotation,
                      label: extracted.label,
                      severity: extracted.severity,
                      category: extracted.category,
                      description: extracted.description,
                      recommendation: extracted.recommendation,
                      tags: extracted.tags,
                      updatedAt: new Date().toISOString(),
                    };

                    setAnnotations((prev) => {
                      const next = prev.map((a) =>
                        a.id === selectedAnnotation.id ? updated : a
                      );
                      if (scopedImageKey) saveAnnotations(scopedImageKey, next);
                      return next;
                    });

                    setSelectedAnnotation(updated);
                    setFormMode("view");

                    if (imageId && caseId && !String(updated.id).startsWith("tmp-")) {
                      void putAnnotationToApi({ imageId, caseId, ann: updated }).catch((e) => {
                        console.error("Erreur mise à jour annotation:", e);
                        alert("La mise à jour de l’annotation a échoué.");
                      });
                    }
                  }}
                  style={modalStyles.primaryBtn}
                >
                  {formMode === "edit" ? "Enregistrer les modifications" : "Enregistrer"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {capturePreviewOpen && capturePreviewUrl && (
        <div
          style={{
            ...modalStyles.backdrop,
            position: "fixed",
            zIndex: 300,
          }}
          onClick={() => setCapturePreviewOpen(false)}
        >
          <div
            style={{
              width: "min(1100px, 92vw)",
              maxHeight: "90vh",
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e6e6e6",
              boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                  Capture JPEG
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                  Aperçu de la zone capturée sans annotations visibles
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <a
                  href={capturePreviewUrl}
                  download="capture-zone.jpg"
                  style={modalStyles.primaryBtn}
                >
                  Télécharger
                </a>
                <button
                  type="button"
                  onClick={() => setCapturePreviewOpen(false)}
                  style={modalStyles.secondaryBtn}
                >
                  Fermer
                </button>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: "auto",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                background: "#0f172a",
                padding: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={capturePreviewUrl}
                alt="Capture WSI"
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  objectFit: "contain",
                  borderRadius: 8,
                  background: "white",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function clearRenderedOverlays(viewer: OpenSeadragon.Viewer) {
  const overlays = ((viewer as any).currentOverlays ?? []) as Array<{
    element?: HTMLElement;
  }>;

  overlays.forEach((o) => {
    const el = o?.element;
    if (!el) return;

    const kind = (el as any).dataset?.kind;
    if (
      kind === "persisted" ||
      kind === "label" ||
      kind === "temp" ||
      kind === "capture"
    ) {
      try {
        viewer.removeOverlay(el);
      } catch {
        // ignore
      }
    }
  });
}

function redrawAll(
  viewer: OpenSeadragon.Viewer,
  annotations: Annotation[],
  options?: { reshapeMode?: boolean; selectedId?: string | null }
): void {
  const overlays = ((viewer as any).currentOverlays ?? []) as Array<{
    element?: HTMLElement;
  }>;
  
  const shouldShowHandles = (ann: Annotation) => {
    if (!options?.reshapeMode) return false;
    if (options?.selectedId) return ann.id === options.selectedId;
    return true;
  };

  overlays.forEach((o) => {
    const el = o?.element;
    if (!el) return;

    const kind = (el as any).dataset?.kind;
    if (kind === "persisted" || kind === "label") {
      try {
        clearRenderedOverlays(viewer);
      } catch {
        // ignore
      }
    }
  });

  function shouldDrawOverlayLabel(ann: Annotation): boolean {
    if (!ann.label) return false;
    if (isInstantSegAnnotation(ann)) return false;
    return true;
  }

  annotations.forEach((ann) => {
    if (ann.type === "rect") {
      const el = document.createElement("div");
      el.style.boxSizing = "border-box";
      el.style.pointerEvents = "none";
      el.style.border = `${ann.strokeWidth ?? 2}px solid ${ann.strokeColor ?? "#ff3b30"}`;
      el.style.background = ann.fillColor ?? "rgba(224, 56, 47, 0.76)";
      el.dataset.kind = "persisted";

      viewer.addOverlay({
        element: el,
        location: imageRectToViewportRect(viewer, ann),
      });

      if (shouldShowHandles(ann)) {
        addResizeHandles(viewer, ann, [
          { annotationId: ann.id, index: 0, x: ann.x, y: ann.y },
          { annotationId: ann.id, index: 1, x: ann.x + ann.w, y: ann.y },
          { annotationId: ann.id, index: 2, x: ann.x + ann.w, y: ann.y + ann.h },
          { annotationId: ann.id, index: 3, x: ann.x, y: ann.y + ann.h },
        ]);
      }

      if (shouldDrawOverlayLabel(ann)) {
        addLabel(viewer, ann, ann.label!, "rect");
      }
      return;
    }

    if (ann.type === "circle") {
      const el = document.createElement("div");
      el.style.boxSizing = "border-box";
      el.style.pointerEvents = "none";
      el.style.border = `${ann.strokeWidth ?? 2}px solid ${ann.strokeColor ?? "#ff3b30"}`;
      el.style.background = ann.fillColor ?? "rgba(255,59,48,0.08)";
      el.style.borderRadius = "9999px";
      el.dataset.kind = "persisted";

      viewer.addOverlay({
        element: el,
        location: imageEllipseToViewportRect(viewer, ann),
      });

      if (shouldShowHandles(ann)) {
        addResizeHandles(viewer, ann, [
          { annotationId: ann.id, index: 0, x: ann.cx - ann.rx, y: ann.cy },
          { annotationId: ann.id, index: 1, x: ann.cx + ann.rx, y: ann.cy },
          { annotationId: ann.id, index: 2, x: ann.cx, y: ann.cy - ann.ry },
          { annotationId: ann.id, index: 3, x: ann.cx, y: ann.cy + ann.ry },
        ]);
      }

      if (shouldDrawOverlayLabel(ann)) {
        addLabel(viewer, ann, ann.label!, "circle");
      }
      return;
    }

    if (
      ann.type === "polygon" &&
      Array.isArray(ann.points) &&
      ann.points.length >= 3
    ) {
      const vpts = ann.points.map((p) =>
        viewer.viewport.imageToViewportCoordinates(p.x, p.y),
      );

      let vminX = Infinity;
      let vminY = Infinity;
      let vmaxX = -Infinity;
      let vmaxY = -Infinity;

      for (const p of vpts) {
        vminX = Math.min(vminX, p.x);
        vminY = Math.min(vminY, p.y);
        vmaxX = Math.max(vmaxX, p.x);
        vmaxY = Math.max(vmaxY, p.y);
      }

      const pad = 0.0005;
      const vbX = vminX - pad;
      const vbY = vminY - pad;
      const vbW = vmaxX - vminX + pad * 2;
      const vbH = vmaxY - vminY + pad * 2;

      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.style.pointerEvents = "none";
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.setAttribute("viewBox", "0 0 1 1");
      svg.style.overflow = "visible";
      (svg as any).dataset.kind = "persisted";

      const poly = document.createElementNS(svgNS, "polygon");

      // Bounding box IMAGE
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of ann.points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }

      const width = Math.max(1, maxX - minX);
      const height = Math.max(1, maxY - minY);

      // Points NORMALISÉS (0 → 1)
      const normalizedPoints = ann.points.map((p) => {
        const nx = (p.x - minX) / width;
        const ny = (p.y - minY) / height;
        return `${nx},${ny}`;
      });

      poly.setAttribute("points", normalizedPoints.join(" "));

      // style
      const fillInfo = (() => {
        const color = ann.fillColor ?? "rgba(255,59,48,0.18)";
        const match = color.match(
          /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/
        );
        if (!match) return { fill: color, fillOpacity: "0.18" };

        return {
          fill: `rgb(${match[1]},${match[2]},${match[3]})`,
          fillOpacity: match[4] ?? "1",
        };
      })();

      poly.setAttribute("fill", fillInfo.fill);
      poly.setAttribute("fill-opacity", fillInfo.fillOpacity);
      poly.setAttribute("stroke", ann.strokeColor ?? "#ff3b30");
      poly.setAttribute("stroke-width", String(ann.strokeWidth ?? 2));
      poly.setAttribute("vector-effect", "non-scaling-stroke");
      poly.setAttribute("stroke-linejoin", "round");
      poly.setAttribute("stroke-linecap", "round");

      svg.appendChild(poly);

      // Overlay position = bbox image
      viewer.addOverlay({
        element: svg,
        location: imageRectToViewportRect(viewer, {
          x: minX,
          y: minY,
          w: width,
          h: height,
        }),
      });

      if (shouldDrawOverlayLabel(ann)) {
        addLabel(
          viewer,
          { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
          ann.label!,
          "polygon",
        );
      }
    }
  });
}

function addLabel(
  viewer: OpenSeadragon.Viewer,
  shape:
    | RectAnnotation
    | CircleAnnotation
    | { x: number; y: number; w: number; h: number }
    | PolygonAnnotation,
  text: string,
  kind: "rect" | "circle" | "polygon",
): void {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.fontSize = "12px";
  el.style.padding = "2px 6px";
  el.style.borderRadius = "6px";
  el.style.background = "rgba(255,255,255,0.92)";
  el.style.border = "1px solid #ddd";
  el.style.pointerEvents = "none";
  el.style.whiteSpace = "nowrap";
  el.dataset.kind = "label";

  const x =
    kind === "circle"
      ? (shape as CircleAnnotation).cx - (shape as CircleAnnotation).rx
      : (shape as any).x;
  const y =
    kind === "circle"
      ? (shape as CircleAnnotation).cy - (shape as CircleAnnotation).ry
      : (shape as any).y;

  viewer.addOverlay({
    element: el,
    location: viewer.viewport.imageToViewportCoordinates(x, y),
  });
}

function addResizeHandles(
  viewer: OpenSeadragon.Viewer,
  ann: Annotation,
  handles: ShapeHandle[]
) {
  handles.forEach((h) => {
    const size = ann.type === "polygon" ? 14 : 12;

    const el = document.createElement("div");
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.borderRadius = "9999px";
    el.style.background = "#ffffff";
    el.style.border = "2px solid #2563eb";
    el.style.boxShadow = "0 0 0 2px rgba(255,255,255,0.85)";
    el.style.pointerEvents = "none";
    el.dataset.kind = "persisted";

    const half = size / 2;

    viewer.addOverlay({
      element: el,
      location: imageRectToViewportRect(viewer, {
        x: h.x - half,
        y: h.y - half,
        w: size,
        h: size,
      }),
    });
  });
}

function ToolButton(props: {
  title: string;
  icon: React.ComponentType;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const { title, icon: Icon, active, disabled, onClick } = props;
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles.toolBtn,
        ...(active ? styles.toolBtnActive : null),
        ...(disabled ? styles.toolBtnDisabled : null),
      }}
    >
      <Icon />
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    border: "1px solid #e6e6e6",
    borderRadius: 10,
    background: "#fff",
  },

  contentLayout: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) 300px",
    gap: 12,
    flex: 1,
    minHeight: 0,
  },

  sidebar: {
    border: "1px solid #e6e6e6",
    borderRadius: 10,
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    minHeight: 320,
    overflow: "hidden",
  },

  sidebarHeader: {
    padding: "12px 14px",
    borderBottom: "1px solid #eee",
    fontWeight: 600,
    fontSize: 14,
    display: "flex",
    flexDirection: "column",
  },

  scrollBody: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    paddingRight: 4,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    alignContent: "start",
  },

  emptyState: {
    padding: 14,
    color: "#666",
    fontSize: 13,
  },

  annotationList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 10,
    overflowY: "auto",
  },

  annotationCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 10,
    display: "grid",
    gap: 8,
    background: "#fff",
    cursor: "pointer",
    transition: "0.15s ease",
  },

  annotationCardActive: {
    borderColor: "#ff3b30",
    boxShadow: "0 0 0 2px rgba(255,59,48,0.08)",
  },

  annotationCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },

  annotationTitle: {
    fontWeight: 600,
    fontSize: 13,
    color: "#111827",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  annotationType: {
    fontSize: 11,
    padding: "2px 6px",
    borderRadius: 999,
    background: "#f3f4f6",
    color: "#374151",
    textTransform: "uppercase",
  },

  annotationMeta: {
    display: "grid",
    gap: 4,
    fontSize: 12,
    color: "#4b5563",
  },

  annotationActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  },

  group: { display: "flex", alignItems: "center", gap: 6 },
  divider: {
    width: 1,
    alignSelf: "stretch",
    background: "#eee",
    margin: "0 4px",
  },

  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#fff",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
  },

  toolBtnActive: {
    borderColor: "#ff3b30",
    background: "rgba(255,59,48,0.10)",
  },

  toolBtnDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },

  counter: {
    fontSize: 12,
    color: "#666",
    padding: "0 8px",
  },

  sidebarHeaderTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },

  filterGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },

  filterSelect: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#fff",
    fontSize: 12,
    color: "#111827",
  },

  filterResetBtn: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#fff",
    fontSize: 12,
    cursor: "pointer",
  },

  filterInfo: {
    marginTop: 8,
    fontSize: 12,
    color: "#6b7280",
  },
};

const modalStyles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  label: {
    fontSize: 12,
    color: "#444",
    display: "grid",
    gap: 6,
    marginBottom: 10,
  },
  input: {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #ddd",
  },
  primaryBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
  },
  secondaryBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#fff",
  },
  modalLarge: {
    width: "min(980px, 96vw)",
    height: "calc(100vh - 32px)",
    maxHeight: "calc(100vh - 32px)",
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #e6e6e6",
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  textarea: {
    width: "100%",
    minHeight: 110,
    padding: 10,
    borderRadius: 10,
    border: "1px solid #ddd",
    resize: "vertical",
  },
  colorInput: {
    width: "100%",
    height: 40,
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: 4,
    background: "#fff",
  },
};

const formGridStyles: Record<string, React.CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  metaBox: {
    gridColumn: "1 / -1",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: "#334155",
    display: "grid",
    gap: 6,
  },
};

function IconMousePointer() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M4 2.5v10.8l2.8-2 1.8 4.2 1.7-.7-1.8-4.2 3.5.1L4 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M6 5.5l1-1.5h4l1 1.5h2a1 1 0 0 1 1 1V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1h2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle
        cx="9"
        cy="9.5"
        r="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M9 2l1.2 3.3L13.5 6.5l-3.3 1.2L9 11 7.8 7.7 4.5 6.5l3.3-1.2L9 2Z"
        fill="currentColor"
      />
      <path
        d="M14.5 11.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconMove() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M9 2l2 2H9.8v3.2H13V6l2 2-2 2V8.8H9.8V12H11l-2 2-2-2h1.2V8.8H5V10L3 8l2-2v1.2h3.2V4H7L9 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconEditShape() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <rect x="3" y="4" width="9" height="8" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12.5" cy="12.5" r="1.5" fill="currentColor" />
      <circle cx="3" cy="4" r="1.2" fill="currentColor" />
      <circle cx="12" cy="4" r="1.2" fill="currentColor" />
      <circle cx="3" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}

function IconRect() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <rect
        x="3"
        y="4"
        width="12"
        height="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function IconCircle() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle
        cx="9"
        cy="9"
        r="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function IconPolygon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M4 12 L7 4 L14 7 L12 14 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function IconSliders() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M4 5h10M4 9h10M4 13h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="7" cy="5" r="1.6" fill="currentColor" />
      <circle cx="11" cy="9" r="1.6" fill="currentColor" />
      <circle cx="6" cy="13" r="1.6" fill="currentColor" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      {/* corps du crayon */}
      <path
        d="M3 17.5L14.5 6c1-1 2.5-1 3.5 0l1 1c1 1 1 2.5 0 3.5L7.5 22H3v-4.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* pointe */}
      <path
        d="M3 22l3-1 2-2-2-2-2 2-1 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M4 9.5l3 3L14 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M5 5l8 8M13 5l-8 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M6 6h8l-1 10H7L6 6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5 6h10M7 6V4h4v2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function toColorInput(color: string) {
  if (!color) return "#ff3b30";
  if (color.startsWith("#")) return color;

  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return "#ff3b30";

  const r = Number(match[1]).toString(16).padStart(2, "0");
  const g = Number(match[2]).toString(16).padStart(2, "0");
  const b = Number(match[3]).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}