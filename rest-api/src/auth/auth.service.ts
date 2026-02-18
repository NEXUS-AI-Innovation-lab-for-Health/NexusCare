import { BadRequestException, Injectable, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { AuthDto } from './dto/auth.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import * as argon2 from 'argon2';

@Injectable()
export class AuthService {
    constructor(private usersService: UsersService) {}

    async register(createUserDto: CreateUserDto) {
        const userExists = await this.usersService.findByEmail(createUserDto.email);
        if (userExists) {
            throw new BadRequestException('User already exists');
        }
        try {
            return await this.usersService.create(createUserDto);
        } catch (err: any) {
            // Handle Prisma unique constraint violation (P2002)
            if (err?.code === 'P2002') {
                throw new BadRequestException('User with provided email already exists');
            }
            throw new InternalServerErrorException('Failed to register user');
        }
    }

    async login(authDto: AuthDto) {
        const user = await this.usersService.findByEmail(authDto.email);
        if (!user) {
            throw new UnauthorizedException('Access Denied');
        }

        const passwordMatches = await argon2.verify(user.password, authDto.password);
        if (!passwordMatches) {
            throw new UnauthorizedException('Access Denied: Invalid password');
        }

        return user;
    }
}
