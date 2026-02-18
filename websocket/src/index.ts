import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import * as fs from 'fs';
import { ClientToServerEvents, ServerToClientEvents } from './types';
import { saveMessage, getMessagesForRoom } from './services/db.service';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const app = express();

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.use(cors({ origin: "*" }));

// Vérifier si les certificats SSL existent
const certPath = '/app/certs/cert.pem';
const keyPath = '/app/certs/key.pem';
let server: ReturnType<typeof createServer> | ReturnType<typeof createHttpsServer>;
let isHttps = false;

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const httpsOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
    };
    server = createHttpsServer(httpsOptions, app);
    isHttps = true;
    console.log('SSL certificates loaded, HTTPS enabled');
} else {
    server = createServer(app);
    console.log('SSL certificates not found, running in HTTP mode');
}

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket: AppSocket) => {
    console.log(`[CONNEXION] Nouvel utilisateur: ${socket.id}`);

    socket.on('join-room', async (roomId: string) => {
        socket.join(roomId);

        const activeUsers: string[] = [];
        const room = io.sockets.adapter.rooms.get(roomId);

        if (room) {
            room.forEach((socketId) => {
                if (socketId !== socket.id) {
                    activeUsers.push(socketId);
                }
            });
        }

        socket.emit('get-existing-users', activeUsers);

        const messages = await getMessagesForRoom(roomId);
        if (messages) {
            socket.emit('message-history', messages);
        }

        socket.broadcast.to(roomId).emit('user-joined', socket.id);
    });

    socket.on('disconnecting', () => {
        console.log(`[DECONNEXION] Utilisateur: ${socket.id}`);
        // 'disconnecting' fires before the socket leaves its rooms,
        // so we can broadcast to all rooms the socket was in
        for (const room of socket.rooms) {
            if (room !== socket.id) {
                socket.broadcast.to(room).emit('user-left', socket.id);
            }
        }
    });

    socket.on('sending-offer', (offer, toId) => {
        console.log(`[SIGNALING] Offer reçue de ${socket.id} à destination de ${toId}`);

        socket.to(toId).emit('receiving-offer', offer, socket.id);
    });

    socket.on('sending-answer', (answer, toId) => {
        console.log(`[SIGNALING] reponse reçue de ${socket.id} à ${toId}`);

        socket.to(toId).emit('receiving-answer', answer, socket.id);
    });

    socket.on('sending-ice-candidate', (candidate, toId) => {
        console.log(`[SIGNALING] ICE Candidate reçu de ${socket.id} à destination de ${toId}`);

        socket.to(toId).emit('receiving-ice-candidate', candidate, socket.id);
    });

    socket.on('announce-name', (name: string, roomId: string) => {
        socket.broadcast.to(roomId).emit('participant-announced-name', socket.id, name);
    });

    socket.on('leave-room', (roomId: string) => {
        socket.leave(roomId);
    });

    socket.on('send-chat-message', async (content, roomId, senderId) => {
        console.log(`[CHAT] Message de ${senderId} dans room ${roomId}: ${content}`);

        try {
            await saveMessage(content, senderId, roomId);
        } catch (err) {
            console.error('[CHAT] Failed to persist message:', err);
        }

        // Always broadcast even if persistence fails
        socket.broadcast.to(roomId).emit('receive-chat-message', content, senderId, new Date());
    });
}
);

const PORT = process.env.PORT || 4000;

server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Serveur de signalisation démarré sur ${isHttps ? 'https' : 'http'}://0.0.0.0:${PORT}`);
});
