import { IsString, IsNotEmpty } from 'class-validator';

export class CreateMessageDto {
    @IsString()
    @IsNotEmpty()
    content: string;

    @IsString()
    @IsNotEmpty()
    sender: string;

    @IsString()
    @IsNotEmpty()
    room: string;

    createdAt: Date;
}
