import { IsString, IsNotEmpty } from 'class-validator';

export class MarkFormFilledDto {
    @IsString()
    @IsNotEmpty()
    participantId: string;

    @IsString()
    @IsNotEmpty()
    patientRecordId: string;
}
