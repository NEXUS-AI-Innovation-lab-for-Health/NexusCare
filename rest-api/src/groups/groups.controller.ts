import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  create(@Body() dto: CreateGroupDto) {
    return this.groupsService.create(dto);
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.groupsService.findByUser(userId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.groupsService.findById(id);
  }

  @Post(':id/members/:userId')
  addMember(@Param('id') groupId: string, @Param('userId') userId: string) {
    return this.groupsService.addMember(groupId, userId);
  }

  @Delete(':id/members/:userId')
  removeMember(@Param('id') groupId: string, @Param('userId') userId: string) {
    return this.groupsService.removeMember(groupId, userId);
  }
}
