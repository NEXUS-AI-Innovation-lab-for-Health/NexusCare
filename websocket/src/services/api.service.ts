import axios, { AxiosInstance } from 'axios';

class ApiService {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: 'http://localhost:3000', // URL de l'API REST NestJS changeable
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    async getUser(id: string) {
        try {
            const response = await this.client.get(`/users/${id}`);
            return response.data;
        } catch (error: any) {
            console.error(`Erreur getUser ${id}:`, error.message);
            return null;
        }
    }

    async createRoom(roomData: any) {
        try {
            // roomData doit correspondre au CreateRoomDto (subject, requiredParticipants, roomAdmin, etc.)
            const response = await this.client.post('/rooms', roomData);
            return response.data;
        } catch (error: any) {
            console.error('Erreur createRoom:', error.message);
            throw error;
        }
    }

    async getRoom(id: string) {
        try {
            const response = await this.client.get(`/rooms/${id}`);
            return response.data;
        } catch (error: any) {
            console.error(`Erreur getRoom ${id}:`, error.message);
            return null;
        }
    }

    // --- MESSAGES ---

    async saveMessage(content: string, senderId: string, roomId: string) {
        try {
            const payload = {
                content,
                sender: senderId,
                room: roomId
            };
            const response = await this.client.post('/messages', payload);
            return response.data;
        } catch (error: any) {
            console.error('Erreur saveMessage:', error.message);
            return null;
        }
    }

    async getMessagesForRoom(roomId: string) {
        try {
            const response = await this.client.get(`/messages/room/${roomId}`);
            return response.data;
        } catch (error: any) {
            console.error(`Erreur getMessagesForRoom ${roomId}:`, error.message);
            return [];
        }
    }
}

export default new ApiService();
