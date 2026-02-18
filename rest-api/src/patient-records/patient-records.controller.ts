import { Controller, Get, Post, Put, Delete, Param, HttpException, HttpStatus, Req } from '@nestjs/common';
import { PatientRecordsService } from './patient-records.service';
import type { Request } from 'express';

@Controller('patient-records')
export class PatientRecordsController {
  constructor(private readonly patientRecordsService: PatientRecordsService) {}

  @Get()
  async getAllPatientRecords() {
    return await this.patientRecordsService.getAll();
  }

  @Get(':id')
  async getPatientRecord(@Param('id') id: string) {
    return await this.patientRecordsService.findById(id);
  }

  @Post()
  async createPatientRecord(@Req() req: Request) {
    try {
      return await this.patientRecordsService.create(req.body);
    } catch (error) {
      console.error('Failed to create patient record:', error);
      const message = error instanceof Error ? error.message : 'Failed to create patient record';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(':id')
  async updatePatientRecord(@Param('id') id: string, @Req() req: Request) {
    try {
      return await this.patientRecordsService.update(id, req.body);
    } catch (error) {
      throw new HttpException('Failed to update patient record', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':id')
  async deletePatientRecord(@Param('id') id: string) {
    try {
      return await this.patientRecordsService.deleteById(id);
    } catch (error) {
      throw new HttpException('Failed to delete patient record', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
