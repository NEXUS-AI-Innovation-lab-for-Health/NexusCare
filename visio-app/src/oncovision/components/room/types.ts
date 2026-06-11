export interface RoomInfo {
    roomId: string;
    roomName: string;
    imageIds: string[];
    participantCount: number;
    participants: { authorId: string; name: string; color: string }[];
}

export interface AuthorInfo {
    authorId: string;
    name: string;
    color: string;
}
