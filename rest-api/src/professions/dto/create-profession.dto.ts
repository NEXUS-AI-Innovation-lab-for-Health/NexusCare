import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateProfessionDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    color?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
