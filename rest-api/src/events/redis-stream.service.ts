import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisStreamService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RedisStreamService.name);
    private redis: Redis;
    private running = true;
    private readonly consumerGroup = 'nestjs-api';
    private readonly consumerName = 'worker-1';

    constructor(private configService: ConfigService) {}

    async onModuleInit() {
        const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://redis:6379';
        this.redis = new Redis(redisUrl);

        try {
            await this.redis.xgroup(
                'CREATE',
                'stream:chat:message_sent',
                this.consumerGroup,
                '0',
                'MKSTREAM',
            );
            this.logger.log('Consumer group created for stream:chat:message_sent');
        } catch {
            // Group already exists
        }

        this.startListening();
    }

    async onModuleDestroy() {
        this.running = false;
        if (this.redis) {
            await this.redis.quit();
        }
    }

    private async startListening() {
        while (this.running) {
            try {
                const results = await this.redis.xreadgroup(
                    'GROUP',
                    this.consumerGroup,
                    this.consumerName,
                    'COUNT',
                    10,
                    'BLOCK',
                    5000,
                    'STREAMS',
                    'stream:chat:message_sent',
                    '>',
                );

                if (results) {
                    for (const [, entries] of results as any[]) {
                        for (const [id, fields] of entries as [string, string[]][]) {
                            const data: Record<string, string> = {};
                            for (let i = 0; i < fields.length; i += 2) {
                                data[fields[i]] = fields[i + 1];
                            }
                            await this.handleMessageSent(data);
                            await this.redis.xack(
                                'stream:chat:message_sent',
                                this.consumerGroup,
                                id,
                            );
                        }
                    }
                }
            } catch (err) {
                if (this.running) {
                    this.logger.error('Error reading from Redis Stream', err);
                    await new Promise((r) => setTimeout(r, 1000));
                }
            }
        }
    }

    private async handleMessageSent(data: Record<string, string>) {
        this.logger.debug(`[Redis Stream] Message sent event: ${JSON.stringify(data)}`);
        // Future: trigger AI analysis, notifications, audit logging, etc.
    }
}
