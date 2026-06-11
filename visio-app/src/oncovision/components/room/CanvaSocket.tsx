import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { Canva } from "oncovision";
import type { CanvaHandle, CanvaProps } from "oncovision";
import { useRest } from "../../RestProvider";
import { WebSocketBus } from "../../utils/websocket";
import { Shape } from "../../types/viewer/shapes";
import { drawingActionFromRaw, drawingActionToRaw } from "../../types/viewer/action";
import type { DrawingAction } from "../../types/viewer/action";

export type CanvaSocketProps = CanvaProps & {
    roomId: string;
    authorId?: string | null;
    authorName?: string;
    onHandshaked?: (authorId: string, color: string) => void;
    leaveRef?: MutableRefObject<(() => Promise<void>) | null>;
};

const CanvaSocket = forwardRef<CanvaHandle, CanvaSocketProps>(function CanvaSocket(props, ref) {
    const { roomId, authorId: initialAuthorId, authorName = "Anonymous", onHandshaked, leaveRef, ...canvaProps } = props;

    const handleRef = useRef<CanvaHandle | null>(null);
    const { useWebSocket } = useRest();
    const webSocket = useWebSocket({ url: "draw/join_draw" });
    const { setOnConnect } = webSocket;
    const webSocketBus = useRef<WebSocketBus>(new WebSocketBus(webSocket));

    const roomIdRef = useRef(roomId);
    const authorIdRef = useRef<string | null>(initialAuthorId ?? null);
    const [_shapes, setShapes] = useState<Shape[]>([]);
    const pendingHistoryRef = useRef<{ past: DrawingAction[]; future: DrawingAction[] } | null>(null);

    const leave = async (): Promise<void> => {
        webSocketBus.current.publish({ type: "leave", roomId: roomIdRef.current });
        await new Promise<void>((resolve) => setTimeout(resolve, 150));
        webSocket.disconnect();
    };

    useEffect(() => {
        if (leaveRef) {
            leaveRef.current = leave;
            return () => { leaveRef.current = null; };
        }
    }, [leaveRef]);

    useEffect(() => {
        if (handleRef.current) {
            handleRef.current.setShapes(_shapes);
            if (pendingHistoryRef.current) {
                const { past, future } = pendingHistoryRef.current;
                pendingHistoryRef.current = null;
                handleRef.current.restoreHistory(past, future);
            }
        }
    }, [_shapes]);

    useImperativeHandle(ref, () => ({
        addShape: (shape) => handleRef.current?.addShape(shape),
        removeShape: (shape) => handleRef.current?.removeShape(shape),
        applyAction: (action) => handleRef.current?.applyAction(action),
        setListener: (listener) => handleRef.current?.setListener(listener),
        setShapes: (shapes) => handleRef.current?.setShapes(shapes),
        undo: () => handleRef.current?.undo(),
        redo: () => handleRef.current?.redo(),
        restoreHistory: (past, future) => handleRef.current?.restoreHistory(past, future),
    }), []);

    useEffect(() => {
        roomIdRef.current = roomId;
    }, [roomId]);

    useEffect(() => {
        const bus = webSocketBus.current;
        bus.clean();

        bus.subscribe("handshaked", (_socket: any, rawMessage: any) => {
            authorIdRef.current = rawMessage.authorId;
            sessionStorage.setItem(`authorId:${roomIdRef.current}`, rawMessage.authorId);
            const imageShapes = rawMessage.shapes?.[props.imageId] || [];
            const shapes = Shape.fromRawArray(imageShapes);
            const past = (rawMessage.pastActions ?? []).map(drawingActionFromRaw);
            const future = (rawMessage.futureActions ?? []).map(drawingActionFromRaw);
            pendingHistoryRef.current = { past, future };
            setShapes(shapes);
            onHandshaked?.(rawMessage.authorId, rawMessage.color);
        });

        bus.subscribe("propagate_shape_action", (_socket: any, rawMessage: any) => {
            const action = drawingActionFromRaw(rawMessage.action);
            handleRef.current?.applyAction(action);
        });

        setOnConnect(() => {
            bus.publish({ type: "handshake", roomId: roomIdRef.current, authorId: authorIdRef.current, authorName });
        });

        let detach: (() => void) | null = null;
        const timeoutId = setTimeout(() => { detach = bus.attach(); }, 200);
        return () => {
            clearTimeout(timeoutId);
            detach?.();
            bus.clean();
        };
    }, []);

    const handleAction = (action: DrawingAction, source: "action" | "undo" | "redo") => {
        if (!roomIdRef.current) return;
        webSocketBus.current.publish({ type: "shape_action", roomId: roomIdRef.current, action: drawingActionToRaw(action), source });
    };

    return (
        <div style={{ width: "100%", height: "100%" }}>
            <Canva
                {...canvaProps}
                ref={handleRef}
                onAction={(action) => handleAction(action, "action")}
                onUndoAction={(action) => handleAction(action, "undo")}
                onRedoAction={(action) => handleAction(action, "redo")}
            />
        </div>
    );
});

export default CanvaSocket;
