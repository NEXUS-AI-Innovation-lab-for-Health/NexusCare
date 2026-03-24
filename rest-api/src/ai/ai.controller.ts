import {
    Controller,
    Post,
    Get,
    Body,
    Res,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
    constructor(private readonly aiService: AiService) {}

    @Post('generate-report')
    async generateReport(@Body() body: any) {
        return this.aiService.generateReport(body);
    }

    @Post('analyze')
    async analyze(@Body() body: any) {
        return this.aiService.analyzeImage(body);
    }

    @Get('health')
    async health() {
        return this.aiService.healthCheck();
    }

    /** Proxy: transcribe audio via Whisper */
    @Post('transcribe')
    @UseInterceptors(FileInterceptor('audio'))
    async transcribe(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: { whisper_model?: string; language?: string },
    ) {
        return this.aiService.transcribe(
            file,
            body.whisper_model || 'small',
            body.language || 'fr',
        );
    }

    /** Proxy: generate PDF report from text */
    @Post('generate/text')
    async generateFromText(
        @Body() body: { text: string; meeting_type?: string; organization_name?: string },
        @Res() res: Response,
    ) {
        const pdf = await this.aiService.generateFromText(
            body.text,
            body.meeting_type || 'medical',
            body.organization_name || 'OncoCollab',
        );
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="rapport_reunion.pdf"',
            'Content-Length': pdf.length,
        });
        res.send(pdf);
    }
}
