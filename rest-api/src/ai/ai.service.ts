import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import FormData from 'form-data';

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

    /** Transcribe audio via Whisper (returns JSON) */
    async transcribe(
        file: Express.Multer.File,
        whisperModel: string,
        language: string,
    ): Promise<any> {
        const form = new FormData();
        form.append('audio', file.buffer, {
            filename: file.originalname,
            contentType: file.mimetype,
        });
        form.append('whisper_model', whisperModel);
        form.append('language', language);

        const { data: result } = await firstValueFrom(
            this.http.post('/transcribe', form, {
                headers: form.getHeaders(),
                timeout: 120000,
            }),
        );
        return result;
    }

    /** Generate PDF report from text */
    async generateFromText(
        text: string,
        meetingType: string,
        organizationName: string,
    ): Promise<Buffer> {
        const form = new FormData();
        form.append('text', text);
        form.append('meeting_type', meetingType);
        form.append('organization_name', organizationName);

        const { data } = await firstValueFrom(
            this.http.post('/generate/text', form, {
                headers: form.getHeaders(),
                responseType: 'arraybuffer',
                timeout: 120000,
            }),
        );
        return Buffer.from(data);
    }
}
