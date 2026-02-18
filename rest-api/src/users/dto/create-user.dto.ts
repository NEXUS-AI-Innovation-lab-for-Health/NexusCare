import { IsString, IsNotEmpty, IsEmail, IsBoolean, IsOptional, MinLength } from 'class-validator';

export class CreateUserDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    firstName: string;

    @IsString()
    @IsNotEmpty()
    lastName: string;

    @IsString()
    @IsNotEmpty()
    profession: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;

    @IsBoolean()
    @IsOptional()
    isAdmin?: boolean;
}
