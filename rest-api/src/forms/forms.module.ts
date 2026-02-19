import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FormsService } from './forms.service';
import { FormsController } from './forms.controller';

@Module({
    imports: [
        HttpModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                baseURL: config.get<string>('FORMS_API_URL', 'http://localhost:9091'),
                timeout: 5000,
            }),
        }),
    ],
    controllers: [FormsController],
    providers: [FormsService],
    exports: [FormsService],
})
export class FormsModule {}
