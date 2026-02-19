import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
    constructor(private prisma: PrismaService) {}

    async create(createMeetingDto: CreateMeetingDto) {
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
        return serializeMeeting(meeting);
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
            include: { participants: true },
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

        return this.findOne(meetingId);
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
