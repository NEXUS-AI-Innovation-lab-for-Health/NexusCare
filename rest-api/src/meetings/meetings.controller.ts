import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { MarkFormFilledDto } from './dto/add-patient-record.dto';

@Controller('meetings')
export class MeetingsController {
    constructor(private readonly meetingsService: MeetingsService) {}

    @Post()
    create(@Body() createMeetingDto: CreateMeetingDto) {
        return this.meetingsService.create(createMeetingDto);
    }

    @Get()
    findAll() {
        return this.meetingsService.findAll();
    }

    @Get('pending')
    findPending() {
        return this.meetingsService.findPending();
    }

    @Get('room/:roomId')
    findByRoomId(@Param('roomId') roomId: string) {
        return this.meetingsService.findByRoomId(roomId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.meetingsService.findOne(id);
    }

    @Get('participant/:participantId')
    findByParticipant(@Param('participantId') participantId: string) {
        return this.meetingsService.findByParticipant(participantId);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() updateMeetingDto: UpdateMeetingDto,
        @Query('requesterId') requesterId?: string
    ) {
        return this.meetingsService.update(id, updateMeetingDto, requesterId);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.meetingsService.remove(id);
    }

    @Post(':id/form-filled')
    markFormFilled(
        @Param('id') id: string,
        @Body() markFormFilledDto: MarkFormFilledDto
    ) {
        return this.meetingsService.markFormFilled(id, markFormFilledDto);
    }

    @Get(':id/participants-status')
    getParticipantsStatus(@Param('id') id: string) {
        return this.meetingsService.getParticipantsStatus(id);
    }

    @Get(':id/patient-records')
    getPatientRecords(@Param('id') id: string) {
        return this.meetingsService.getPatientRecordsForMeeting(id);
    }

    @Patch(':id/start')
    startMeeting(@Param('id') id: string) {
        return this.meetingsService.startMeeting(id);
    }

    @Patch(':id/complete')
    completeMeeting(@Param('id') id: string) {
        return this.meetingsService.completeMeeting(id);
    }

    @Patch(':id/cancel')
    cancelMeeting(@Param('id') id: string) {
        return this.meetingsService.cancelMeeting(id);
    }

    @Post(':id/participants')
    addParticipant(
        @Param('id') id: string,
        @Body() body: { participantId: string; professionId: string }
    ) {
        return this.meetingsService.addParticipant(id, body.participantId, body.professionId);
    }

    @Delete(':id/participants/:participantId')
    removeParticipant(
        @Param('id') id: string,
        @Param('participantId') participantId: string
    ) {
        return this.meetingsService.removeParticipant(id, participantId);
    }

    @Patch(':id/participants/:participantId/visibility')
    updateParticipantVisibility(
        @Param('id') id: string,
        @Param('participantId') participantId: string,
        @Body() body: { isVisible: boolean; showProfession?: boolean }
    ) {
        return this.meetingsService.updateParticipantVisibility(
            id, 
            participantId, 
            body.isVisible, 
            body.showProfession
        );
    }
}
