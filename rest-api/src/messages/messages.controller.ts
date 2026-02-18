import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MessagesService } from '../messages/messages.service';

@Controller('messages')
export class MessagesController {
    constructor(private readonly messagesService: MessagesService) { }

    @Post()
    create(@Body() createMessageDto: any) {
        return this.messagesService.create(createMessageDto);
    }

    @Get()
    findAll() {
        return this.messagesService.findAll();
    }

    @Get('room/:roomId')
    findByRoom(@Param('roomId') roomId: string) {
        return this.messagesService.findByRoom(roomId);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.messagesService.remove(id);
    }
}
