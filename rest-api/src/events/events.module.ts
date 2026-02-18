import { Module } from '@nestjs/common';
import { RedisStreamService } from './redis-stream.service';

@Module({
    providers: [RedisStreamService],
})
export class EventsModule {}
