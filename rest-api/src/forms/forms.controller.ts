import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { FormsService } from './forms.service';

@Controller('forms')
export class FormsController {
    constructor(private readonly formsService: FormsService) {}

    @Get(':id')
    getForm(@Param('id') id: string) {
        return this.formsService.getFormById(id);
    }

    @Post('extract')
    extractFromTranscript(
        @Body() body: { form: { fields: Array<{ name: string; label: string; type: string; required: boolean; semantic_hint?: string }> }; text: string },
    ) {
        return this.formsService.extractFromTranscript(body.form, body.text);
    }
}
