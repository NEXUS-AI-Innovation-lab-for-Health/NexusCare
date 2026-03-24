import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { MarkFormFilledDto } from './dto/add-patient-record.dto';
import { serializeMeeting, serializePatientRecord, serializeMeetingParticipant, serializeUser, serializeProfession } from '../common/serializers/serializers';
import { v4 as uuidv4 } from 'uuid';

const MEETING_INCLUDE = {
    participants: {
        include: {
            user: { include: { profession: true } },
            profession: true,
            patientRecord: true,
        },
    },
    roomAdmin: { include: { profession: true } },
} as const;

@Injectable()
export class MeetingsService {
    constructor(
        private prisma: PrismaService,
        private groupsService: GroupsService,
    ) {}

    async create(createMeetingDto: CreateMeetingDto) {
        // 1. Create the meeting
        const meeting = await this.prisma.meeting.create({
            data: {
                roomId: uuidv4(),
                subject: createMeetingDto.subject,
                description: createMeetingDto.description,
                time: createMeetingDto.time,
                patientFirstName: createMeetingDto.patientFirstName,
                patientLastName: createMeetingDto.patientLastName,
                roomAdminId: createMeetingDto.roomAdmin,
                scheduledDate: new Date(createMeetingDto.scheduledDate),
                duration: createMeetingDto.duration,
                participants: {
                    create: createMeetingDto.participants.map(p => ({
                        userId: p.user,
                        professionId: p.profession,
                        isVisible: p.isVisible ?? true,
                        showProfession: p.showProfession ?? true,
                        formFilled: false,
                    })),
                },
            },
            include: MEETING_INCLUDE,
        });

        // 2. Create the group chat linked to this meeting
        const memberIds = createMeetingDto.participants.map(p => p.user);
        const group = await this.groupsService.create({
            name: createMeetingDto.subject,
            createdById: createMeetingDto.roomAdmin,
            memberIds,
            meetingId: meeting.id,
        });

        // 3. Link group chat to meeting
        const updatedMeeting = await this.prisma.meeting.update({
            where: { id: meeting.id },
            data: { groupChatId: group.id },
            include: MEETING_INCLUDE,
        });

        return serializeMeeting(updatedMeeting);
    }

    async findAll() {
        const meetings = await this.prisma.meeting.findMany({
            include: MEETING_INCLUDE,
        });
        return meetings.map(serializeMeeting);
    }

    async findOne(id: string) {
        const meeting = await this.prisma.meeting.findUnique({
            where: { id },
            include: MEETING_INCLUDE,
        });
        if (!meeting) {
            throw new NotFoundException(`Meeting with ID ${id} not found`);
        }
        return serializeMeeting(meeting);
    }

    async findByRoomId(roomId: string) {
        const meeting = await this.prisma.meeting.findUnique({
            where: { roomId },
            include: MEETING_INCLUDE,
        });
        if (!meeting) {
            throw new NotFoundException(`Meeting with roomId ${roomId} not found`);
        }
        return serializeMeeting(meeting);
    }

    async findByParticipant(participantId: string) {
        const meetings = await this.prisma.meeting.findMany({
            where: {
                participants: { some: { userId: participantId } },
            },
            include: MEETING_INCLUDE,
        });
        return meetings.map(serializeMeeting);
    }

    async findPending() {
        const meetings = await this.prisma.meeting.findMany({
            where: { status: 'pending' },
            include: MEETING_INCLUDE,
        });
        return meetings.map(serializeMeeting);
    }

    async update(id: string, updateMeetingDto: UpdateMeetingDto, requesterId?: string) {
        const meeting = await this.prisma.meeting.findUnique({
            where: { id },
            include: { participants: true, groupChat: true },
        });

        if (!meeting) {
            throw new NotFoundException(`Meeting with ID ${id} not found`);
        }

        if (requesterId && meeting.roomAdminId !== requesterId) {
            throw new ForbiddenException('Only the room admin can update this meeting');
        }

        // Construire données mise à jour (exclut participants)
        const { participants: dtoParticipants, ...scalarFields } = updateMeetingDto;
        const updateData: any = {}; 
        if (scalarFields.subject) updateData.subject = scalarFields.subject;
        if (scalarFields.description !== undefined) updateData.description = scalarFields.description;
        if (scalarFields.time) updateData.time = scalarFields.time;
        if (scalarFields.patientFirstName !== undefined) updateData.patientFirstName = scalarFields.patientFirstName;
        if (scalarFields.patientLastName !== undefined) updateData.patientLastName = scalarFields.patientLastName;
        if (scalarFields.roomAdmin) updateData.roomAdminId = scalarFields.roomAdmin;
        if (scalarFields.status) updateData.status = scalarFields.status;
        if (scalarFields.scheduledDate) updateData.scheduledDate = new Date(scalarFields.scheduledDate);
        if (scalarFields.startedAt) updateData.startedAt = new Date(scalarFields.startedAt);
        if (scalarFields.duration) updateData.duration = scalarFields.duration;

        // Si nom patient modifié, propager aux dossiers liés
        if (scalarFields.patientFirstName !== undefined || scalarFields.patientLastName !== undefined) {
            const participantsWithRecords = meeting.participants.filter(p => p.patientRecordId);
            for (const p of participantsWithRecords) {
                const record = await this.prisma.patientRecord.findUnique({ where: { id: p.patientRecordId! } });
                if (record) {
                    const data = (typeof record.data === 'object' && record.data !== null ? record.data : {}) as Record<string, any>;
                    if (scalarFields.patientFirstName !== undefined) data.firstName = scalarFields.patientFirstName;
                    if (scalarFields.patientLastName !== undefined) data.lastName = scalarFields.patientLastName;
                    await this.prisma.patientRecord.update({
                        where: { id: p.patientRecordId! },
                        data: { data },
                    });
                }
            }
        }

        if (dtoParticipants) {
            // Remplacer participants : supprimer puis recréer
            await this.prisma.meetingParticipant.deleteMany({ where: { meetingId: id } });
            updateData.participants = {
                create: dtoParticipants.map(p => {
                    const existing = meeting.participants.find(ep => ep.userId === p.user);
                    return {
                        userId: p.user,
                        professionId: p.profession || existing?.professionId,
                        isVisible: p.isVisible ?? existing?.isVisible ?? true,
                        showProfession: p.showProfession ?? existing?.showProfession ?? true,
                        formFilled: p.formFilled ?? existing?.formFilled ?? false,
                        filledAt: existing?.filledAt,
                        patientRecordId: existing?.patientRecordId,
                    };
                }),
            };

            // Sync group chat members with updated participants (creates group if none exists)
            await this.syncGroupChatMembers(meeting, dtoParticipants.map(p => p.user));
        }

        const updated = await this.prisma.meeting.update({
            where: { id },
            data: updateData,
            include: MEETING_INCLUDE,
        });
        return serializeMeeting(updated);
    }

    async remove(id: string) {
        const meeting = await this.prisma.meeting.findUnique({ where: { id } });
        if (!meeting) {
            throw new NotFoundException(`Meeting with ID ${id} not found`);
        }
        await this.prisma.meeting.delete({ where: { id } });
        return serializeMeeting(meeting);
    }

    async markFormFilled(meetingId: string, markFormFilledDto: MarkFormFilledDto) {
        const participant = await this.prisma.meetingParticipant.findFirst({
            where: {
                meetingId,
                userId: markFormFilledDto.participantId,
            },
        });

        if (!participant) {
            throw new NotFoundException('Participant not found in this meeting');
        }

        await this.prisma.meetingParticipant.update({
            where: { id: participant.id },
            data: {
                formFilled: true,
                patientRecordId: markFormFilledDto.patientRecordId,
                filledAt: new Date(),
            },
        });

        const meeting = await this.prisma.meeting.findUnique({
            where: { id: meetingId },
            include: MEETING_INCLUDE,
        });
        return serializeMeeting(meeting);
    }

    async getParticipantsStatus(meetingId: string) {
        const meeting = await this.prisma.meeting.findUnique({
            where: { id: meetingId },
            include: {
                participants: {
                    include: {
                        user: { include: { profession: true } },
                        profession: true,
                        patientRecord: true,
                    },
                },
            },
        });
        if (!meeting) {
            throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
        }
        return meeting.participants.map(serializeMeetingParticipant);
    }

    async getPatientRecordsForMeeting(meetingId: string) {
        const meeting = await this.prisma.meeting.findUnique({
            where: { id: meetingId },
            include: {
                participants: {
                    where: { formFilled: true, patientRecordId: { not: null } },
                    include: {
                        user: { include: { profession: true } },
                        profession: true,
                        patientRecord: true,
                    },
                },
            },
        });
        if (!meeting) {
            throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
        }
        return meeting.participants.map(p => ({
            user: p.user ? serializeUser(p.user) : p.userId,
            profession: p.profession ? serializeProfession(p.profession) : p.professionId,
            patientRecord: p.patientRecord ? serializePatientRecord(p.patientRecord) : null,
            filledAt: p.filledAt,
        }));
    }

    async startMeeting(id: string) {
        const meeting = await this.prisma.meeting.findUnique({ where: { id } });
        if (!meeting) {
            throw new NotFoundException(`Meeting with ID ${id} not found`);
        }
        const updated = await this.prisma.meeting.update({
            where: { id },
            data: { status: 'in-progress', startedAt: new Date() },
            include: MEETING_INCLUDE,
        });
        return serializeMeeting(updated);
    }

    async completeMeeting(id: string) {
        const updated = await this.prisma.meeting.update({
            where: { id },
            data: { status: 'completed' },
            include: MEETING_INCLUDE,
        });
        return serializeMeeting(updated);
    }

    async cancelMeeting(id: string) {
        const updated = await this.prisma.meeting.update({
            where: { id },
            data: { status: 'cancelled' },
            include: MEETING_INCLUDE,
        });
        return serializeMeeting(updated);
    }

    async addParticipant(meetingId: string, participantId: string, professionId: string) {
        const meeting = await this.prisma.meeting.findUnique({
            where: { id: meetingId },
            include: { participants: true },
        });
        if (!meeting) {
            throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
        }

        const alreadyExists = meeting.participants.some(p => p.userId === participantId);
        if (!alreadyExists) {
            await this.prisma.meetingParticipant.create({
                data: {
                    meetingId,
                    userId: participantId,
                    professionId,
                    isVisible: true,
                    showProfession: true,
                    formFilled: false,
                },
            });

            // Add to group chat, or create group if none exists
            if (meeting.groupChatId) {
                await this.groupsService.addMember(meeting.groupChatId, participantId);
            } else {
                const allParticipantIds = [...meeting.participants.map(p => p.userId), participantId];
                await this.createGroupChatForMeeting(meeting, allParticipantIds);
            }
        }

        return this.findOne(meetingId);
    }

    async removeParticipant(meetingId: string, participantId: string) {
        const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
        if (!meeting) {
            throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
        }

        await this.prisma.meetingParticipant.deleteMany({
            where: { meetingId, userId: participantId },
        });

        // Remove from group chat, or create group with remaining participants if none exists
        if (meeting.groupChatId) {
            await this.groupsService.removeMember(meeting.groupChatId, participantId);
        } else {
            const remainingMeeting = await this.prisma.meeting.findUnique({
                where: { id: meetingId },
                include: { participants: true },
            });
            if (remainingMeeting) {
                const remainingIds = remainingMeeting.participants.map(p => p.userId);
                await this.createGroupChatForMeeting(remainingMeeting, remainingIds);
            }
        }

        return this.findOne(meetingId);
    }

    /**
     * Create a group chat for a meeting that doesn't have one yet.
     * Returns the created group's ID.
     */
    private async createGroupChatForMeeting(meeting: { id: string; subject: string; roomAdminId: string }, memberIds: string[]): Promise<string> {
        const group = await this.groupsService.create({
            name: meeting.subject,
            createdById: meeting.roomAdminId,
            memberIds,
            meetingId: meeting.id,
        });

        await this.prisma.meeting.update({
            where: { id: meeting.id },
            data: { groupChatId: group.id },
        });

        return group.id;
    }

    /**
     * Sync group chat members to match the given participant user IDs.
     * If no group chat exists, create one.
     */
    private async syncGroupChatMembers(meeting: { id: string; subject: string; roomAdminId: string; groupChatId: string | null }, newParticipantIds: string[]) {
        if (!meeting.groupChatId) {
            await this.createGroupChatForMeeting(meeting, newParticipantIds);
            return;
        }

        const group = await this.groupsService.findById(meeting.groupChatId);
        if (!group) {
            await this.createGroupChatForMeeting(meeting, newParticipantIds);
            return;
        }

        const currentMemberIds = group.members.map((m: any) => m.userId);
        const toAdd = newParticipantIds.filter(id => !currentMemberIds.includes(id));
        const toRemove = currentMemberIds.filter((id: string) => !newParticipantIds.includes(id));

        await Promise.all([
            ...toAdd.map(id => this.groupsService.addMember(meeting.groupChatId!, id)),
            ...toRemove.map(id => this.groupsService.removeMember(meeting.groupChatId!, id)),
        ]);
    }

    async updateParticipantVisibility(
        meetingId: string,
        participantId: string,
        isVisible: boolean,
        showProfession?: boolean,
    ) {
        const participant = await this.prisma.meetingParticipant.findFirst({
            where: { meetingId, userId: participantId },
        });

        if (!participant) {
            throw new NotFoundException('Participant not found in this meeting');
        }

        await this.prisma.meetingParticipant.update({
            where: { id: participant.id },
            data: {
                isVisible,
                ...(showProfession !== undefined && { showProfession }),
            },
        });

        return this.findOne(meetingId);
    }
}
