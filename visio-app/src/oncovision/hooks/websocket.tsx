import { useCallback, useEffect, useRef, useState } from 'react';

export type UseWebSocketReturn = {
    isConnected: boolean;
    connect: () => void;
    disconnect: () => void;
    sendMessage: (message: string | object) => boolean;
    registerListener: (id: string, listener: (msg: string) => void) => void;
    unregisterListener: (id: string) => void;
    setOnConnect: (listener: (() => void) | undefined) => void;
    setOnDisconnect: (listener: ((event: CloseEvent) => void) | undefined) => void;
    autoConnect: boolean;
    setAutoConnect: (value: boolean) => void;
};

export const useWebSocket = (props: { url: string; params?: Record<string, string> | null; autoConnect?: boolean }): UseWebSocketReturn => {
    const { url, params, autoConnect: initialAutoConnect = false } = props;
    const [autoConnect, setAutoConnectState] = useState(initialAutoConnect);
    const [isConnected, setIsConnected] = useState(false);
    const [queue, setQueue] = useState<(object | string)[]>([]);
    const onConnectRef = useRef<(() => void) | undefined>(undefined);
    const onDisconnectRef = useRef<((event: CloseEvent) => void) | undefined>(undefined);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const connectionAttemptRef = useRef(false);
    const listenersRef = useRef<Record<string, (msg: string) => void>>({});
    const queueRef = useRef(queue);
    const autoConnectRef = useRef(autoConnect);

    useEffect(() => { queueRef.current = queue; }, [queue]);
    useEffect(() => { autoConnectRef.current = autoConnect; }, [autoConnect]);

    const connect = useCallback(() => {
        if (connectionAttemptRef.current) return;
        if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) return;
        if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
        if (wsRef.current) { try { wsRef.current.close(); } catch {} }
        connectionAttemptRef.current = true;
        const completeUrl = url + (params ? `?${new URLSearchParams(params).toString()}` : '');
        const ws = new WebSocket(completeUrl);
        ws.onopen = () => {
            connectionAttemptRef.current = false;
            setIsConnected(true);
            const q = queueRef.current;
            if (q.length > 0) {
                for (const msg of q) ws.send(typeof msg === 'object' ? JSON.stringify(msg) : msg);
                setQueue([]);
            }
            onConnectRef.current?.();
        };
        ws.onmessage = (event) => {
            for (const listener of Object.values(listenersRef.current)) listener(event.data);
        };
        ws.onerror = () => { connectionAttemptRef.current = false; };
        ws.onclose = (event) => {
            connectionAttemptRef.current = false;
            setIsConnected(false);
            if (event.code !== 1001) onDisconnectRef.current?.(event);
            if (!autoConnectRef.current) return;
            reconnectTimeoutRef.current = setTimeout(() => connect(), 3000);
        };
        wsRef.current = ws;
    }, [url, params]);

    const sendMessage = useCallback((message: string | object): boolean => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(typeof message === 'object' ? JSON.stringify(message) : message);
            return true;
        }
        setQueue(prev => [...prev, message]);
        if (!isConnected && autoConnect) connect();
        return false;
    }, [isConnected, autoConnect, connect]);

    const disconnect = useCallback(() => {
        try { wsRef.current?.close(1000, 'Manual disconnect'); wsRef.current = null; } catch {}
        if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
        connectionAttemptRef.current = false;
        setIsConnected(false);
    }, []);

    const setAutoConnect = useCallback((value: boolean) => {
        setAutoConnectState(value);
        if (!value) disconnect();
    }, [disconnect]);

    const registerListener = useCallback((id: string, listener: (msg: string) => void) => {
        listenersRef.current = { ...listenersRef.current, [id]: listener };
    }, []);

    const unregisterListener = useCallback((id: string) => {
        const next = { ...listenersRef.current };
        delete next[id];
        listenersRef.current = next;
    }, []);

    const setOnConnect = useCallback((listener: (() => void) | undefined) => { onConnectRef.current = listener; }, []);
    const setOnDisconnect = useCallback((listener: ((event: CloseEvent) => void) | undefined) => { onDisconnectRef.current = listener; }, []);

    useEffect(() => {
        return () => {
            if (!autoConnectRef.current && wsRef.current) {
                try { wsRef.current.close(1000, 'Component unmounting'); wsRef.current = null; } catch {}
            }
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        };
    }, []);

    return { isConnected, connect, disconnect, sendMessage, registerListener, unregisterListener, setOnConnect, setOnDisconnect, autoConnect, setAutoConnect };
};
