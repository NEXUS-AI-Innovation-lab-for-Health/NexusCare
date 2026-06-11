import { Shape } from './shapes';

export type DrawingActionType = 'shape_create' | 'shape_delete' | 'shape_edit';

export interface DrawingAction {
    readonly type: DrawingActionType;
    toJson(): string;
}

export class ShapeCreateAction implements DrawingAction {
    readonly type = 'shape_create' as const;
    readonly imageId: string;
    readonly shapes: Shape[];
    constructor(imageId: string, shapes: Shape[]) {
        this.imageId = imageId;
        this.shapes = shapes;
    }
    toJson(): string {
        return JSON.stringify({ type: this.type, imageId: this.imageId, shapes: this.shapes });
    }
    static fromJson(json: string): ShapeCreateAction {
        const data = JSON.parse(json);
        return new ShapeCreateAction(data.imageId, Shape.fromRawArray(data.shapes));
    }
}

export class ShapeDeleteAction implements DrawingAction {
    readonly type = 'shape_delete' as const;
    readonly imageId: string;
    readonly shapes: Shape[];
    constructor(imageId: string, shapes: Shape[]) {
        this.imageId = imageId;
        this.shapes = shapes;
    }
    toJson(): string {
        return JSON.stringify({ type: this.type, imageId: this.imageId, shapes: this.shapes });
    }
    static fromJson(json: string): ShapeDeleteAction {
        const data = JSON.parse(json);
        return new ShapeDeleteAction(data.imageId, Shape.fromRawArray(data.shapes));
    }
}

export class ShapeEditAction implements DrawingAction {
    readonly type = 'shape_edit' as const;
    readonly imageId: string;
    readonly previousShape: Shape;
    readonly shape: Shape;
    constructor(imageId: string, previousShape: Shape, shape: Shape) {
        this.imageId = imageId;
        this.previousShape = previousShape;
        this.shape = shape;
    }
    toJson(): string {
        return JSON.stringify({ type: this.type, imageId: this.imageId, previousShape: this.previousShape, shape: this.shape });
    }
    static fromJson(json: string): ShapeEditAction {
        const data = JSON.parse(json);
        return new ShapeEditAction(data.imageId, Shape.fromRaw(data.previousShape), Shape.fromRaw(data.shape));
    }
}

export function drawingActionFromJson(json: string): DrawingAction {
    const data = JSON.parse(json) as { type: DrawingActionType };
    switch (data.type) {
        case 'shape_create': return ShapeCreateAction.fromJson(json);
        case 'shape_delete': return ShapeDeleteAction.fromJson(json);
        case 'shape_edit':   return ShapeEditAction.fromJson(json);
        default: throw new Error(`Unknown drawing action type: ${(data as any).type}`);
    }
}

export function drawingActionToRaw(action: DrawingAction): object {
    return JSON.parse(action.toJson()) as object;
}

export function drawingActionFromRaw(raw: object): DrawingAction {
    return drawingActionFromJson(JSON.stringify(raw));
}
