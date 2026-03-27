import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class FormsService {
    constructor(
        private readonly http: HttpService,
        private readonly config: ConfigService,
    ) {}

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

    async extractFromTranscript(
        form: { fields: Array<{ name: string; label: string; type: string; required: boolean; semantic_hint?: string }> },
        text: string,
    ): Promise<any> {
        const completionUrl = this.config.get<string>('FORM_COMPLETION_API_URL', 'http://completion-formulaire:8001');

        try {
            const response = await axios.post(
                `${completionUrl}/extract`,
                { form, text },
                { timeout: 180000 },
            );
            return response.data;
        } catch (error: any) {
            const upstreamStatus = error?.response?.status;
            const upstreamDetail = String(error?.response?.data?.detail || error?.message || '').trim();

            if (
                upstreamStatus === 400
                && /(connecterror|all connection attempts failed|connection refused|network is unreachable)/i.test(upstreamDetail)
            ) {
                throw new ServiceUnavailableException(
                    `Completion-formulaire ne peut pas joindre Ollama. Vérifiez OLLAMA_HOST côté completion-formulaire et que Ollama est démarré. Endpoint completion: ${completionUrl}.`,
                );
            }

            if (upstreamDetail) {
                throw new ServiceUnavailableException(`Erreur completion-formulaire: ${upstreamDetail}`);
            }

            throw new ServiceUnavailableException('Service completion-formulaire inaccessible');
        }
    }
}
