import { Controller, Get, Param } from '@nestjs/common';
import { FormsService } from './forms.service';

@Controller('forms')
export class FormsController {
    constructor(private readonly formsService: FormsService) {}

    @Get(':id')
    getForm(@Param('id') id: string) {
        return this.formsService.getFormById(id);
    }
}
