import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateGroupDto) {
    const allMemberIds = Array.from(new Set([dto.createdById, ...dto.memberIds]));

    const group = await this.prisma.group.create({
      data: {
        name: dto.name,
        createdById: dto.createdById,
        members: {
          create: allMemberIds.map((userId) => ({ userId })),
        },
      },
      include: {
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return group;
  }

  async findByUser(userId: string) {
    return this.prisma.group.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.group.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async addMember(groupId: string, userId: string) {
    return this.prisma.groupMember.create({
      data: { groupId, userId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  async removeMember(groupId: string, userId: string) {
    return this.prisma.groupMember.deleteMany({
      where: { groupId, userId },
    });
  }
}
