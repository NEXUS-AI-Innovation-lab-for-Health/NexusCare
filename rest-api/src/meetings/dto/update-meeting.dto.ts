import { IsString, IsArray, IsOptional, IsDateString, IsEnum, ValidateNested, IsBoolean, IsNotEmpty, IsInt, Matches } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateParticipantDto {
    @IsString()
    @IsNotEmpty()
    user: string;

    @IsString()
    @IsOptional()
    profession?: string;

    @IsBoolean()
    @IsOptional()
    isVisible?: boolean;

    @IsBoolean()
    @IsOptional()
    showProfession?: boolean;

    @IsBoolean()
    @IsOptional()
    formFilled?: boolean;
}

export class UpdateMeetingDto {
    @IsString()
    @IsOptional()
    subject?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    patientFirstName?: string;

    @IsString()
    @IsOptional()
    patientLastName?: string;

    @IsString()
    @IsOptional()
    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'time must be in HH:mm format' })
    time?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateParticipantDto)
    @IsOptional()
    participants?: UpdateParticipantDto[];

    @IsString()
    @IsOptional()
    roomAdmin?: string;

    @IsEnum(['pending', 'in-progress', 'completed', 'cancelled'])
    @IsOptional()
    status?: string;

    @IsDateString()
    @IsOptional()
    scheduledDate?: string;

    @IsDateString()
    @IsOptional()
    startedAt?: string;

    @IsInt({ message: 'duration must be an integer (in minutes)' })
    @IsOptional()
    @Type(() => Number)
    duration?: number;
}
