import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import Redis from 'ioredis';

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

const CACHE_TTL = 3600;
const MAX_CACHED_MESSAGES = 50;

/* Stockage : PostgreSQL (source) + cache Redis + stream d'événements écrit en parallèle. */
export async function saveMessage(content: string, senderId: string, roomId: string) {
    const cacheKey = `chat:room:${roomId}:messages`;
    const now = new Date();

    const messagePayload = JSON.stringify({
        content,
        sender: senderId,
        room: roomId,
        createdAt: now.toISOString(),
    });

    const [pgResult] = await Promise.all([
        // 1. PostgreSQL source de vérité
        prisma.message.create({
            data: { content, senderId, room: roomId },
        }),

        // 2. Cache Redis derniers messages
        redis.rpush(cacheKey, messagePayload)
            .then(() => redis.ltrim(cacheKey, -MAX_CACHED_MESSAGES, -1))
            .then(() => redis.expire(cacheKey, CACHE_TTL))
            .catch(err => console.error('[Redis cache write failed]', err)),

        // 3. Stream Redis événement pour consommateurs asynchrones
        redis.xadd(
            'stream:chat:message_sent',
            '*',
            'content', content,
            'senderId', senderId,
            'roomId', roomId,
            'timestamp', now.toISOString(),
        ).catch(err => console.error('[Redis stream publish failed]', err)),
    ]);

    return pgResult;
}

/* Lecture via cache puis Postgres, backfill si besoin. */
export async function getMessagesForRoom(roomId: string) {
    const cacheKey = `chat:room:${roomId}:messages`;

    // 1. Redis cache
    const cached = await redis.lrange(cacheKey, 0, -1);
    if (cached && cached.length > 0) {
        return cached.map(raw => {
            const m = JSON.parse(raw);
            return {
                id: m.id || undefined,
                content: m.content,
                sender: m.sender,
                room: m.room,
                createdAt: m.createdAt,
            };
        });
    }

    // 2. Fall back to Postgres
    const messages = await prisma.message.findMany({
        where: { room: roomId },
        orderBy: { createdAt: 'asc' },
        take: MAX_CACHED_MESSAGES,
    });

    // 3. Backfill Redis cache
    if (messages.length > 0) {
        const pipeline = redis.pipeline();
        for (const m of messages) {
            pipeline.rpush(cacheKey, JSON.stringify({
                id: m.id,
                content: m.content,
                sender: m.senderId,
                room: m.room,
                createdAt: m.createdAt.toISOString(),
            }));
        }
        pipeline.ltrim(cacheKey, -MAX_CACHED_MESSAGES, -1);
        pipeline.expire(cacheKey, CACHE_TTL);
        pipeline.exec().catch(err => console.error('[Redis backfill failed]', err));
    }

    return messages.map(m => ({
        id: m.id,
        content: m.content,
        sender: m.senderId,
        room: m.room,
        createdAt: m.createdAt,
    }));
}

export async function disconnect() {
    await prisma.$disconnect();
    redis.disconnect();
}
