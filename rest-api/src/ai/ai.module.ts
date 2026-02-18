import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';

@Module({
    imports: [
        HttpModule.registerAsync({
            useFactory: (config: ConfigService) => ({
                baseURL: config.get<string>('AI_SERVICE_URL') || 'http://generation_rapport:8000',
                timeout: 30000,
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [AiController],
    providers: [AiService],
    exports: [AiService],
})
export class AiModule {}
