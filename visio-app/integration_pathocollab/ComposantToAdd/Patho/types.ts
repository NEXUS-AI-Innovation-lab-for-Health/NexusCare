export type AnnotationType = "rect" | "circle" | "polygon";
export type Severity = "Faible" | "Moyenne" | "Élevée";
export type AnnotationCategory =
    | "Zone suspecte"
    | "Nécrose"
    | "Inflammation"
    | "Tumeur"
    | "Artefact"
    | "Autre";

export interface DrawStyle {
    strokeColor?: string | null;
    fillColor?: string | null;
    strokeWidth?: number | null;
}

export interface BaseAnnotation extends DrawStyle {
    id: string;
    type: AnnotationType;

    label?: string | null;
    category?: AnnotationCategory | null;
    severity?: Severity;
    description?: string | null;
    recommendation?: string | null;
    tags?: string[];

    ownerId?: string | null;
    ownerName?: string | null;

    confidence?: string | null;
    notes?: string | null;

    createdAt: string;
    updatedAt?: string | null;

    _source?: "api" | "local" | "ia";
}

export interface RectAnnotation extends BaseAnnotation {
    type: "rect";
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface CircleAnnotation extends BaseAnnotation {
    type: "circle";
    cx: number;
    cy: number;
    rx: number;
    ry: number;
}

export interface PolygonPoint {
    x: number;
    y: number;
}

export interface PolygonAnnotation extends BaseAnnotation {
    type: "polygon";
    points: PolygonPoint[];
}

export type Annotation = RectAnnotation | CircleAnnotation | PolygonAnnotation;