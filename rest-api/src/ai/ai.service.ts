import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);

    constructor(private readonly http: HttpService) {}

    async generateReport(data: any): Promise<any> {
        const { data: result } = await firstValueFrom(
            this.http.post('/generate-report', data),
        );
        return result;
    }

    async analyzeImage(data: any): Promise<any> {
        const { data: result } = await firstValueFrom(
            this.http.post('/analyze', data),
        );
        return result;
    }

    async healthCheck(): Promise<any> {
        const { data: result } = await firstValueFrom(
            this.http.get('/health'),
        );
        return result;
    }
}
