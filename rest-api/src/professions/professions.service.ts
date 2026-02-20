import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfessionDto } from './dto/create-profession.dto';
import { UpdateProfessionDto } from './dto/update-profession.dto';
import { serializeProfession } from '../common/serializers/serializers';

@Injectable()
export class ProfessionsService {
    constructor(private prisma: PrismaService) {}

    async create(createProfessionDto: CreateProfessionDto) {
        const existing = await this.prisma.profession.findUnique({
            where: { name: createProfessionDto.name },
        });
        if (existing) {
            throw new ConflictException('Cette profession existe déjà');
        }
        const profession = await this.prisma.profession.create({
            data: createProfessionDto,
        });
        return serializeProfession(profession);
    }

    async findAll() {
        const professions = await this.prisma.profession.findMany({
            orderBy: { name: 'asc' },
        });
        return professions.map(serializeProfession);
    }

    async findActive() {
        const professions = await this.prisma.profession.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });
        return professions.map(serializeProfession);
    }

    async findOne(id: string) {
        const profession = await this.prisma.profession.findUnique({
            where: { id },
        });
        if (!profession) {
            throw new NotFoundException('Profession non trouvée');
        }
        return serializeProfession(profession);
    }

    async update(id: string, updateProfessionDto: UpdateProfessionDto) {
        try {
            const profession = await this.prisma.profession.update({
                where: { id },
                data: updateProfessionDto,
            });
            return serializeProfession(profession);
        } catch {
            throw new NotFoundException('Profession non trouvée');
        }
    }

    async remove(id: string): Promise<void> {
        try {
            await this.prisma.profession.delete({ where: { id } });
        } catch {
            throw new NotFoundException('Profession non trouvée');
        }
    }

    async seed(): Promise<void> {
        const professions = [
            { name: 'Oncologue', description: 'Spécialiste en oncologie', color: '#ef4444', idForm: 'oncologistForm' },
            { name: 'Chirurgien', description: 'Chirurgien spécialisé', color: '#3b82f6', idForm: 'surgeonForm' },
            { name: 'Radiologue', description: 'Spécialiste en imagerie médicale', color: '#8b5cf6', idForm: 'radiologistForm' },
            { name: 'Anatomopathologiste', description: 'Spécialiste en anatomie pathologique', color: '#10b981', idForm: 'pathologistForm' },
            { name: 'Radiothérapeute', description: 'Spécialiste en radiothérapie', color: '#f59e0b', idForm: 'radiotherapistForm' },
            { name: 'Infirmier(ère)', description: 'Personnel infirmier', color: '#ec4899', idForm: 'nurseForm' },
            { name: 'Psychologue', description: 'Accompagnement psychologique', color: '#6366f1', idForm: 'psychologistForm' },
            { name: 'Médecin généraliste', description: 'Médecin traitant', color: '#14b8a6', idForm: 'general_practitionerForm' },
        ];

        for (const profession of professions) {
            await this.prisma.profession.upsert({
                where: { name: profession.name },
                update: { idForm: profession.idForm },
                create: profession,
            });
        }
    }
}
