export type WebSocketHandler = (socket: any, data: object) => void;

export interface WebSocketMessage {
    type: string;
}

export class WebSocketBus {

    private readonly socket: any;
    private handlers: Record<string, WebSocketHandler[]> = {};

    constructor(socket: any) {
        this.socket = socket;
    }

    attach(): () => void {
        this.socket.registerListener("websocket_bus", (message: string) => {
            this.dispatch(message);
        });
        this.socket.setOnDisconnect((event: CloseEvent) => {
            if (event.code === 1001) return;
        });
        this.socket.connect();
        return () => {
            this.socket.setOnDisconnect(undefined);
            this.socket.unregisterListener("websocket_bus");
            this.socket.disconnect();
        };
    }

    clean(): void {
        this.handlers = {};
        this.socket.unregisterListener("websocket_bus");
    }

    subscribe(type: string, handler: WebSocketHandler) {
        if (!this.handlers[type]) this.handlers[type] = [];
        this.handlers[type].push(handler);
    }

    publish(data: object | string): void {
        this.socket.sendMessage(data);
    }

    dispatch(rawMessage: string): number {
        const message = JSON.parse(rawMessage);
        if (!("type" in message)) return 0;
        const list = this.handlers[message.type] || [];
        for (const fn of list) fn(this.socket, message);
        return list.length;
    }
}
