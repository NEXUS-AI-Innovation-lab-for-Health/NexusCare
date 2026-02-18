import { Controller, Post, Get, Body } from '@nestjs/common';
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
}
