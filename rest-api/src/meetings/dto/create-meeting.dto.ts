import { IsString, IsNotEmpty, IsArray, IsOptional, IsDateString, ValidateNested, IsBoolean, IsInt, Matches } from 'class-validator';
import { Type } from 'class-transformer';

class ParticipantDto {
    @IsString()
    @IsNotEmpty()
    user: string;

    @IsString()
    @IsNotEmpty()
    profession: string;

    @IsBoolean()
    @IsOptional()
    isVisible?: boolean;

    @IsBoolean()
    @IsOptional()
    showProfession?: boolean;
}

export class CreateMeetingDto {
    @IsString()
    @IsNotEmpty()
    subject: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsNotEmpty()
    patientFirstName: string;

    @IsString()
    @IsNotEmpty()
    patientLastName: string;

    @IsString()
    @IsNotEmpty()
    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'time must be in HH:mm format' })
    time: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ParticipantDto)
    participants: ParticipantDto[];

    @IsString()
    @IsNotEmpty()
    roomAdmin: string;

    @IsDateString()
    @IsNotEmpty()
    scheduledDate: string;

    @IsInt({ message: 'duration must be an integer (in minutes)' })
    @IsNotEmpty()
    @Type(() => Number)
    duration: number;
}
