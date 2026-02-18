import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { serializeUser } from '../common/serializers/serializers';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) {}

    async create(createUserDto: CreateUserDto) {
        createUserDto.password = await argon2.hash(createUserDto.password);
        const user = await this.prisma.user.create({
            data: {
                email: createUserDto.email,
                firstName: createUserDto.firstName,
                lastName: createUserDto.lastName,
                professionId: createUserDto.profession,
                isAdmin: createUserDto.isAdmin ?? false,
                password: createUserDto.password,
            },
            include: { profession: true },
        });
        return serializeUser(user);
    }

    async findAll() {
        const users = await this.prisma.user.findMany({
            include: { profession: true },
        });
        return users.map(serializeUser);
    }

    async findOne(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: { profession: true },
        });
        return serializeUser(user);
    }

    async findByEmail(email: string) {
        const user = await this.prisma.user.findUnique({
            where: { email },
            include: { profession: true },
        });
        return serializeUser(user);
    }

    async update(id: string, updateUserDto: UpdateUserDto) {
        const user = await this.prisma.user.update({
            where: { id },
            data: {
                ...(updateUserDto.email && { email: updateUserDto.email }),
                ...(updateUserDto.firstName && { firstName: updateUserDto.firstName }),
                ...(updateUserDto.lastName && { lastName: updateUserDto.lastName }),
                ...(updateUserDto.profession && { professionId: updateUserDto.profession }),
                ...(updateUserDto.isAdmin !== undefined && { isAdmin: updateUserDto.isAdmin }),
            },
            include: { profession: true },
        });
        return serializeUser(user);
    }

    async remove(id: string) {
        return this.prisma.user.delete({ where: { id } });
    }
}
