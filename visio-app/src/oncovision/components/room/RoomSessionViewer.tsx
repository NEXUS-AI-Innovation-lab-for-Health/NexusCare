import { useState, useRef } from "react";
import type { RoomInfo, AuthorInfo } from "./types";
import { ImageViewer } from "oncovision";
import CanvaSocket from "./CanvaSocket";

export interface RoomSessionViewerProps {
    room: RoomInfo;
    author: AuthorInfo;
    onLeaveRoom: () => void;
}

export default function RoomSessionViewer({ room, author, onLeaveRoom }: RoomSessionViewerProps) {
    const [selectedImageId, setSelectedImageId] = useState<string>(room.imageIds[0] || "");
    const leaveRef = useRef<(() => Promise<void>) | null>(null);

    const handleLeave = async () => {
        await leaveRef.current?.();
        onLeaveRoom();
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-[#111]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleLeave}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                    >
                        ← Quitter
                    </button>
                    <span className="text-white font-semibold">{room.roomName}</span>
                </div>

                {room.imageIds.length > 1 && (
                    <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-sm">Image :</span>
                        <select
                            value={selectedImageId}
                            onChange={(e) => setSelectedImageId(e.target.value)}
                            className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                            {room.imageIds.map((id) => (
                                <option key={id} value={id}>
                                    Image {id.slice(0, 8)}…
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {room.imageIds.length === 0 && (
                    <span className="text-slate-400 text-sm italic">Aucune image dans cette session</span>
                )}
            </div>

            {/* Viewer */}
            <div className="flex-1 relative overflow-hidden">
                {selectedImageId ? (
                    <ImageViewer
                        key={selectedImageId}
                        imageId={selectedImageId}
                        canva={{
                            type: CanvaSocket,
                            props: {
                                roomId: room.roomId,
                                authorId: author.authorId,
                                authorName: author.name,
                                leaveRef,
                                onHandshaked: (_authorId: string, color: string) => {
                                    author.color = color;
                                },
                            },
                        }}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">
                        Aucune image disponible dans cette session de collaboration.
                    </div>
                )}
            </div>
        </div>
    );
}
