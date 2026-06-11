import { useEffect, useState } from "react";
import type { AuthorInfo, RoomInfo } from "./room/types";
import { useRest } from "../RestProvider";
import RoomSessionViewer from "./room/RoomSessionViewer";
import { api } from "../../services/api";

export type CollaborativeAnnotationProps = {
    roomId: string;
    meetingId?: string;
};

export default function CollaborativeAnnotation({ roomId: initialRoomId, meetingId }: CollaborativeAnnotationProps) {
    const [currentRoom, setCurrentRoom] = useState<RoomInfo | null>(null);
    const [currentAuthor, setCurrentAuthor] = useState<AuthorInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { get } = useRest();

    useEffect(() => {
        const fetchRoom = async () => {
            setIsLoading(true);
            setError(null);
            let roomId = initialRoomId;
            try {
                // Try to fetch the room directly first
                let room = (await get<RoomInfo>({ endpoint: `room/rooms/${roomId}` })) as RoomInfo | null;

                // Room missing → ask NestJS to recreate it (in-memory sessions are volatile), then retry
                if (!room?.roomId && meetingId) {
                    const ensure = await api.ensureCollaborationRoom(meetingId);
                    if (ensure?.collaborationId) roomId = ensure.collaborationId;
                    room = (await get<RoomInfo>({ endpoint: `room/rooms/${roomId}` })) as RoomInfo | null;
                }

                if (!room?.roomId) {
                    setError("Session de collaboration introuvable.");
                    return;
                }
                setCurrentRoom(room);
                const storedUser = localStorage.getItem('user');
                const user = storedUser ? JSON.parse(storedUser) : null;
                setCurrentAuthor({
                    authorId: user?.id ?? `user-${Math.random().toString(36).substr(2, 9)}`,
                    name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || "Utilisateur" : "Utilisateur",
                    color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
                });
            } catch {
                setError("Impossible de rejoindre la session de collaboration.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchRoom();
    }, [initialRoomId, meetingId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full bg-[#111]">
                <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full bg-[#111] text-slate-400">
                {error}
            </div>
        );
    }

    if (!currentRoom || !currentAuthor) return null;

    return (
        <RoomSessionViewer
            room={currentRoom}
            author={currentAuthor}
            onLeaveRoom={() => {
                setCurrentRoom(null);
                setCurrentAuthor(null);
            }}
        />
    );
}
