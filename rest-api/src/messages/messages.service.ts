import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { serializeMessage } from '../common/serializers/serializers';

@Injectable()
export class MessagesService {
    constructor(private prisma: PrismaService) {}

    async create(createMessageDto: CreateMessageDto) {
        const message = await this.prisma.message.create({
            data: {
                content: createMessageDto.content,
                senderId: createMessageDto.sender,
                room: createMessageDto.room,
            },
        });
        return serializeMessage(message);
    }

    findAll() {
        // à faire si on veut un panel admin
        return;
    }

    async findByRoom(roomId: string) {
        const messages = await this.prisma.message.findMany({
            where: { room: roomId },
            orderBy: { createdAt: 'asc' },
        });
        return messages.map(serializeMessage);
    }

    remove(id: string) {
        // à faire si on veut un panel admin
        return;
    }
}
