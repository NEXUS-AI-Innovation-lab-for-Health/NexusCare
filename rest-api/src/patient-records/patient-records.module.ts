import { Module } from '@nestjs/common';
import { PatientRecordsController } from './patient-records.controller';
import { PatientRecordsService } from './patient-records.service';

@Module({
  controllers: [PatientRecordsController],
  providers: [PatientRecordsService],
  exports: [PatientRecordsService],
})
export class PatientRecordsModule {}
