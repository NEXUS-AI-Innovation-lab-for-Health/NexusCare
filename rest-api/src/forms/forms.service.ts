import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class FormsService {
    constructor(private readonly http: HttpService) {}

    async getFormById(id: string): Promise<any> {
        try {
            const response = await firstValueFrom(
                this.http.get(`/forms/getFromID/${id}`),
            );
            return response.data;
        } catch (error: any) {
            if (error?.response?.status === 404) {
                throw new NotFoundException(`Formulaire "${id}" introuvable`);
            }
            throw new ServiceUnavailableException('Service de formulaires inaccessible');
        }
    }
}
