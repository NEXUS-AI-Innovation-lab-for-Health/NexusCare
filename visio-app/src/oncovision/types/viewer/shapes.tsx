import type { ReactNode } from "react";

export interface Point {
    x: number;
    y: number;
}

interface DetailContext {
    imageWidth?: number;
    imageHeight?: number;
}

function getScales(properties: any, context?: DetailContext): { sx: number; sy: number } {
    const { width, height } = properties.canva.dimension;
    const imageWidth = context?.imageWidth;
    const imageHeight = context?.imageHeight;
    if (!imageWidth || !imageHeight || imageWidth <= 0 || imageHeight <= 0) return { sx: 1, sy: 1 };
    return { sx: width / imageWidth, sy: height / imageHeight };
}

export abstract class Shape {
    private readonly id: string;
    private readonly type: string;

    constructor(type: string, id?: string) {
        this.type = type;
        this.id = id ?? crypto.randomUUID();
    }

    abstract render(): ReactNode;

    details(_properties: any, _context?: DetailContext): Record<string, { label: ReactNode; value: ReactNode }> {
        return {};
    }

    getId(): string { return this.id; }
    getType(): string { return this.type; }

    static fromRaw(raw: any): Shape {
        return Shape.fromJson(JSON.stringify(raw));
    }

    static fromRawArray(raw: any[]): Shape[] {
        return raw.map((item) => Shape.fromJson(JSON.stringify(item)));
    }

    static fromJsonArray(json: string): Shape[] {
        const data = JSON.parse(json) as { type: string }[];
        return data.map((item) => Shape.fromJson(JSON.stringify(item)));
    }

    static fromJson(json: string): Shape {
        const data = JSON.parse(json) as { type: string };
        switch (data.type) {
            case "line":      return Line.fromJson(json);
            case "circle":    return Circle.fromJson(json);
            case "ellipse":   return Ellipse.fromJson(json);
            case "rectangle": return Rectangle.fromJson(json);
            case "polygon":   return Polygon.fromJson(json);
            case "polyline":  return Polyline.fromJson(json);
            default: throw new Error(`Unknown shape type: ${data.type}`);
        }
    }
}

export interface Bordered {
    borderColor: string;
    borderWidth: number;
}

const SW = 2;

export class Line extends Shape implements Bordered {
    start: Point; end: Point; borderColor: string; borderWidth: number;
    constructor(start: Point, end: Point, borderColor: string, borderWidth: number, id?: string) {
        super("line", id);
        this.start = start; this.end = end; this.borderColor = borderColor; this.borderWidth = borderWidth;
    }
    static fromJson(json: string): Line {
        const d = JSON.parse(json);
        return new Line(d.start, d.end, d.borderColor || "black", d.borderWidth || 1, d.id);
    }
    render(): ReactNode {
        return <line x1={this.start.x} y1={this.start.y} x2={this.end.x} y2={this.end.y} stroke={this.borderColor} strokeWidth={SW} vectorEffect="non-scaling-stroke" />;
    }
    details(properties: any, context?: DetailContext): Record<string, { label: ReactNode; value: ReactNode }> {
        const { sx, sy } = getScales(properties, context);
        const dx = (this.end.x - this.start.x) * sx;
        const dy = (this.end.y - this.start.y) * sy;
        const length = Math.sqrt(dx * dx + dy * dy);
        const unit = properties.canva.dimension.unit;
        return { length: { label: "Longueur", value: `${length.toFixed(2)} ${unit}` } };
    }
}

export class Circle extends Shape implements Bordered {
    center: Point; radius: number; borderColor: string; borderWidth: number;
    constructor(center: Point, radius: number, borderColor: string, borderWidth: number, id?: string) {
        super("circle", id);
        this.center = center; this.radius = radius; this.borderColor = borderColor; this.borderWidth = borderWidth;
    }
    static fromJson(json: string): Circle {
        const d = JSON.parse(json);
        return new Circle(d.center, d.radius, d.borderColor || "black", d.borderWidth || 1, d.id);
    }
    render(): ReactNode {
        return <circle cx={this.center.x} cy={this.center.y} r={this.radius} stroke={this.borderColor} strokeWidth={SW} vectorEffect="non-scaling-stroke" fill="none" />;
    }
    details(properties: any, context?: DetailContext): Record<string, { label: ReactNode; value: ReactNode }> {
        const { sx, sy } = getScales(properties, context);
        const avgScale = (sx + sy) / 2;
        const radius = this.radius * avgScale;
        const area = Math.PI * this.radius * this.radius * sx * sy;
        const unit = properties.canva.dimension.unit;
        return {
            radius: { label: "Rayon", value: `${radius.toFixed(2)} ${unit}` },
            area: { label: "Aire", value: `${area.toFixed(2)} ${unit}²` },
        };
    }
}

export class Ellipse extends Shape implements Bordered {
    center: Point; radiusX: number; radiusY: number; borderColor: string; borderWidth: number;
    constructor(center: Point, radiusX: number, radiusY: number, borderColor: string, borderWidth: number, id?: string) {
        super("ellipse", id);
        this.center = center; this.radiusX = radiusX; this.radiusY = radiusY; this.borderColor = borderColor; this.borderWidth = borderWidth;
    }
    static fromJson(json: string): Ellipse {
        const d = JSON.parse(json);
        return new Ellipse(d.center, d.radiusX, d.radiusY, d.borderColor || "black", d.borderWidth || 1, d.id);
    }
    render(): ReactNode {
        return <ellipse cx={this.center.x} cy={this.center.y} rx={this.radiusX} ry={this.radiusY} stroke={this.borderColor} strokeWidth={SW} vectorEffect="non-scaling-stroke" fill="none" />;
    }
    details(properties: any, context?: DetailContext): Record<string, { label: ReactNode; value: ReactNode }> {
        const { sx, sy } = getScales(properties, context);
        const area = this.radiusX * this.radiusY * sx * sy;
        const unit = properties.canva.dimension.unit;
        return {
            radiusX: { label: "Rayon X", value: `${(this.radiusX * sx).toFixed(2)} ${unit}` },
            radiusY: { label: "Rayon Y", value: `${(this.radiusY * sy).toFixed(2)} ${unit}` },
            area: { label: "Aire", value: `${area.toFixed(2)} ${unit}²` },
        };
    }
}

export class Rectangle extends Shape implements Bordered {
    origin: Point; width: number; height: number; borderColor: string; borderWidth: number;
    constructor(origin: Point, width: number, height: number, borderColor: string, borderWidth: number, id?: string) {
        super("rectangle", id);
        this.origin = origin; this.width = width; this.height = height; this.borderColor = borderColor; this.borderWidth = borderWidth;
    }
    static fromJson(json: string): Rectangle {
        const d = JSON.parse(json);
        return new Rectangle(d.origin, d.width, d.height, d.borderColor || "black", d.borderWidth || 1, d.id);
    }
    render(): ReactNode {
        return <rect x={this.origin.x} y={this.origin.y} width={this.width} height={this.height} stroke={this.borderColor} strokeWidth={SW} vectorEffect="non-scaling-stroke" fill="none" />;
    }
    details(properties: any, context?: DetailContext): Record<string, { label: ReactNode; value: ReactNode }> {
        const { sx, sy } = getScales(properties, context);
        const scaledWidth = this.width * sx;
        const scaledHeight = this.height * sy;
        const area = scaledWidth * scaledHeight;
        const unit = properties.canva.dimension.unit;
        return {
            width: { label: "Largeur", value: `${scaledWidth.toFixed(2)} ${unit}` },
            height: { label: "Hauteur", value: `${scaledHeight.toFixed(2)} ${unit}` },
            area: { label: "Aire", value: `${area.toFixed(2)} ${unit}²` },
        };
    }
}

export class Polygon extends Shape implements Bordered {
    points: Point[]; borderColor: string; borderWidth: number;
    constructor(points: Point[], borderColor: string, borderWidth: number, id?: string) {
        super("polygon", id);
        this.points = points; this.borderColor = borderColor; this.borderWidth = borderWidth;
    }
    static fromJson(json: string): Polygon {
        const d = JSON.parse(json);
        return new Polygon(d.points || [], d.borderColor || "black", d.borderWidth || 1, d.id);
    }
    render(): ReactNode {
        return <polygon points={this.points.map(p => `${p.x},${p.y}`).join(" ")} stroke={this.borderColor} strokeWidth={SW} vectorEffect="non-scaling-stroke" fill="none" />;
    }
    private calculateArea(): number {
        let area = 0;
        const n = this.points.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += this.points[i].x * this.points[j].y;
            area -= this.points[j].x * this.points[i].y;
        }
        return Math.abs(area / 2);
    }
    details(properties: any, context?: DetailContext): Record<string, { label: ReactNode; value: ReactNode }> {
        const { sx, sy } = getScales(properties, context);
        const area = this.points.length > 2 ? this.calculateArea() * sx * sy : 0;
        const unit = properties.canva.dimension.unit;
        return {
            points: { label: "Points", value: `${this.points.length}` },
            area: { label: "Aire", value: `${area.toFixed(2)} ${unit}²` },
        };
    }
}

export class Polyline extends Shape implements Bordered {
    points: Point[]; borderColor: string; borderWidth: number;
    constructor(points: Point[], borderColor: string, borderWidth: number, id?: string) {
        super("polyline", id);
        this.points = points; this.borderColor = borderColor; this.borderWidth = borderWidth;
    }
    static fromJson(json: string): Polyline {
        const d = JSON.parse(json);
        return new Polyline(d.points || [], d.borderColor || "black", d.borderWidth || 1, d.id);
    }
    render(): ReactNode {
        return <polyline points={this.points.map(p => `${p.x},${p.y}`).join(" ")} stroke={this.borderColor} strokeWidth={SW} vectorEffect="non-scaling-stroke" fill="none" />;
    }
    details(properties: any, context?: DetailContext): Record<string, { label: ReactNode; value: ReactNode }> {
        const { sx, sy } = getScales(properties, context);
        const length = this.points.reduce((acc, p, i) => {
            if (i === 0) return acc;
            const prev = this.points[i - 1];
            return acc + Math.hypot((p.x - prev.x) * sx, (p.y - prev.y) * sy);
        }, 0);
        const unit = properties.canva.dimension.unit;
        return {
            points: { label: "Points", value: `${this.points.length}` },
            length: { label: "Longueur", value: `${length.toFixed(2)} ${unit}` },
        };
    }
}
