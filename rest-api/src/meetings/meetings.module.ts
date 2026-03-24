import { Module } from '@nestjs/common';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { GroupsModule } from '../groups/groups.module';

@Module({
    imports: [GroupsModule],
    controllers: [MeetingsController],
    providers: [MeetingsService],
    exports: [MeetingsService],
})
export class MeetingsModule {}
