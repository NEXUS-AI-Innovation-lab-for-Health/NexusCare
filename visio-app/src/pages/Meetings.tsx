import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import CollaborativeAnnotation from '../oncovision/components/CollaborativeAnnotation';
import { useTranscription } from '../hooks/useTranscription';
import {
    Calendar,
    Users,
    Video,
    Plus,
    X,
    ChevronLeft,
    Mic,
    MicOff,
    FileText,
    AlertTriangle,
    CheckCircle,
    Clock,
    User,
    Edit2,
    Save,
    RefreshCw,
} from 'lucide-react';

interface Meeting {
    id: string;
    roomId: string;
    subject: string;
    description?: string;
    time: string;
    patientFirstName?: string;
    patientLastName?: string;
    collaborationId?: string;
    participants: {
        user: any;
        profession: any;
        isVisible: boolean;
        showProfession: boolean;
        formFilled: boolean;
        patientRecord?: any;
        filledAt?: string;
    }[];
    roomAdmin: any;
    status: string;
    scheduledDate: string;
    duration: number;
}

interface FormFieldSchema {
    field_required: boolean;
    unique_id: string;
    field_key?: string;
    // 'dicom' s'affiche comme un champ texte mais le type est conservé pour que le backend puisse le traiter comme du DICOM
    field_type: 'datepicker' | 'text' | 'input:text' | 'input:number' | 'number' | 'textarea' | 'select' | 'checkbox' | 'dicom' | 'notice' | 'file';
    field_mode?: 'edit' | 'view';
    field_label: string;
    field_hint?: string;
    field_options?: { options: { label: string }[]; source: string };
}

interface FormSchema {
    form_label: string;
    models: string[];
    last_updated: string;
    form: FormFieldSchema[];
}

interface CompletionFieldInput {
    name: string;
    label: string;
    type: string;
    required: boolean;
    semantic_hint?: string;
}

interface CompletionResponse {
    data?: Record<string, string | number | boolean | null>;
}

const MANDATORY_FIELDS = ['firstName', 'lastName', 'profession'];
const METADATA_FIELDS = ['id', 'createdAt', 'updatedAt'];

const MANDATORY_LABELS: Record<string, string> = {
    firstName: 'Prénom',
    lastName: 'Nom',
    profession: 'Profession',
};

const MIN_TRANSCRIPT_LENGTH_FOR_AUTOFILL = 20;

const Meetings: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = React.useState<any>(null);
    const [meetings, setMeetings] = React.useState<Meeting[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedMeeting, setSelectedMeeting] = React.useState<Meeting | null>(null);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [modalType, setModalType] = React.useState<'patient' | 'details'>('patient');
    const [editForm, setEditForm] = React.useState<Record<string, any>>({});
    const [formSchema, setFormSchema] = React.useState<FormSchema | null>(null);
    const [saveError, setSaveError] = React.useState('');

    const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
    const [createForm, setCreateForm] = React.useState({
        subject: '',
        description: '',
        scheduledDate: '',
        time: '',
        duration: 30,
        patientFirstName: '',
        patientLastName: '',
    });
    const [allUsers, setAllUsers] = React.useState<any[]>([]);
    const [selectedParticipants, setSelectedParticipants] = React.useState<string[]>([]);
    const [createError, setCreateError] = React.useState('');
    const [createLoading, setCreateLoading] = React.useState(false);

    const [detailsForm, setDetailsForm] = React.useState({
        subject: '',
        description: '',
        time: '',
        duration: 30,
        patientFirstName: '',
        patientLastName: '',
    });
    const [detailsSaving, setDetailsSaving] = React.useState(false);
    const [detailsError, setDetailsError] = React.useState('');
    const [editParticipants, setEditParticipants] = React.useState<string[]>([]);
    const [liveTranscript, setLiveTranscript] = React.useState('');
    const [autofillStatus, setAutofillStatus] = React.useState('');
    const [autofilledKeys, setAutofilledKeys] = React.useState<string[]>([]);
    const [oncovisionOpen, setOncovisionOpen] = React.useState(false);

    const autoFillTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoFillInFlightRef = React.useRef(false);
    const lastProcessedTranscriptRef = React.useRef('');

    const {
        transcript,
        isRecording,
        startRecording,
        stopRecording,
        clearTranscript,
        wsStatus,
    } = useTranscription();

    React.useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        } else {
            navigate('/login');
        }
    }, [navigate]);

    React.useEffect(() => {
        if (!user?.id) return;
        const fetchData = async () => {
            try {
                const [meetingsData, usersData] = await Promise.all([
                    api.getMeetingsByParticipant(user.id),
                    api.getUsers(),
                ]);
                setMeetings(meetingsData);
                setAllUsers(usersData);
            } catch (error) {
                console.error('Erreur chargement:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    React.useEffect(() => {
        setLiveTranscript(transcript);
    }, [transcript]);

    const isCurrentUserFormFilled = (meeting: Meeting): boolean => {
        if (!user?.id) return false;
        const participantInfo = meeting.participants.find(
            p => p.user?.id === user.id
        );
        return participantInfo?.formFilled || false;
    };

    const handleOpenPatientModal = async (meeting: Meeting) => {
        setSelectedMeeting(meeting);
        setModalType('patient');
        setSaveError('');
        setFormSchema(null);
        setAutofillStatus('');
        setAutofilledKeys([]);
        clearTranscript();

        // Recherche de l'entrée participant de l'utilisateur et de son dossier patient
        const myParticipant = meeting.participants.find(p => p.user?.id === user?.id);
        const myRecord = myParticipant?.patientRecord;
        // Préremplir avec le dossier utilisateur si déjà rempli, sinon vide
        const base: Record<string, any> = myRecord ? { ...myRecord } : {};
        // Auto remplissage champs verrouillés : nom patient depuis la réunion, profession depuis l'utilisateur
        base.firstName = meeting.patientFirstName || '';
        base.lastName = meeting.patientLastName || '';
        base.profession = user?.profession?.name || '';
        setEditForm(base);

        // Fetch du schema de formulaire lié à la profession de l'utilisateur
        const idForm = user?.profession?.idForm;
        if (idForm) {
            try {
                const schema = await api.getFormById(idForm);
                if (schema) setFormSchema(schema);
            } catch {
                // Pas de schema disponible, le formulaire s'affiche sans champs custom
            }
        }

        setIsModalOpen(true);
    };

    const handleOpenDetailsModal = (meeting: Meeting) => {
        setSelectedMeeting(meeting);
        setModalType('details');
        setDetailsForm({
            subject: meeting.subject,
            description: meeting.description || '',
            time: meeting.time,
            duration: meeting.duration,
            patientFirstName: meeting.patientFirstName || '',
            patientLastName: meeting.patientLastName || '',
        });
        const adminId = meeting.roomAdmin?.id || meeting.roomAdmin;
        const initialParticipants = (meeting.participants || [])
            .map(p => (p.user && typeof p.user === 'object' ? p.user.id : p.user))
            .filter((id): id is string => Boolean(id) && id !== adminId);
        setEditParticipants(initialParticipants);
        setDetailsError('');
        setIsModalOpen(true);
    };

    const isAdmin = (meeting: Meeting) => meeting.roomAdmin?.id === user?.id;

    const handleSaveDetails = async () => {
        if (!selectedMeeting || !user?.id) return;
        if (!detailsForm.subject.trim() || !detailsForm.time.trim()) {
            setDetailsError('Sujet et heure sont obligatoires');
            return;
        }
        setDetailsSaving(true);
        setDetailsError('');
        try {
            const adminId = selectedMeeting.roomAdmin?.id || selectedMeeting.roomAdmin;
            const currentParticipantIds = (selectedMeeting.participants || [])
                .map(p => (p.user && typeof p.user === 'object' ? p.user.id : p.user))
                .filter((id): id is string => Boolean(id));

            // 1. Mettre à jour les champs scalaires
            await api.updateMeeting(selectedMeeting.id, {
                subject: detailsForm.subject.trim(),
                description: detailsForm.description.trim(),
                time: detailsForm.time,
                duration: detailsForm.duration,
                patientFirstName: detailsForm.patientFirstName.trim(),
                patientLastName: detailsForm.patientLastName.trim(),
            }, user.id);

            // 2. Diff participants : ajouter les nouveaux, retirer les supprimés
            const toAdd = editParticipants.filter((id: string) => !currentParticipantIds.includes(id));
            const toRemove = currentParticipantIds.filter(
                (id: string) => id !== adminId && !editParticipants.includes(id)
            );

            await Promise.all([
                ...toAdd.map((id: string) => {
                    const u = allUsers.find((u: any) => u.id === id);
                    const professionId = u?.profession?.id || u?.profession || '';
                    return api.addParticipantToMeeting(selectedMeeting.id, id, professionId);
                }),
                ...toRemove.map((id: string) => api.removeParticipantFromMeeting(selectedMeeting.id, id)),
            ]);

            const updatedMeetings = await api.getMeetingsByParticipant(user.id);
            setMeetings(updatedMeetings);
            setIsModalOpen(false);
        } catch (error: any) {
            setDetailsError(error.message || 'Erreur lors de la sauvegarde');
        } finally {
            setDetailsSaving(false);
        }
    };

    const renderFormField = (field: FormFieldSchema) => {
        if (!field.field_key && field.field_type !== 'notice') return null;
        const fieldKey = field.field_key ?? '';
        const value = editForm[fieldKey] ?? '';
        const isReadOnly = field.field_mode === 'view';
        const baseClass = 'bg-white/6 border border-white/12 rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all duration-200 w-full';
        const readOnlyClass = 'bg-white/3 border border-white/6 rounded-xl px-4 py-2.5 text-slate-500 cursor-not-allowed w-full';
        const onChange = (val: any) => setEditForm((prev: Record<string, any>) => ({ ...prev, [fieldKey]: val }));

        switch (field.field_type) {
            case 'datepicker':
                return <input type="date" value={value} onChange={e => onChange(e.target.value)} readOnly={isReadOnly} className={isReadOnly ? readOnlyClass : baseClass} />;
            case 'number':
            case 'input:number':
                return <input type="number" value={value} onChange={e => onChange(e.target.value)} readOnly={isReadOnly} className={isReadOnly ? readOnlyClass : baseClass} />;
            case 'textarea':
                return <textarea value={value} onChange={e => onChange(e.target.value)} readOnly={isReadOnly} rows={3} className={isReadOnly ? readOnlyClass : `${baseClass} resize-none`} />;
            case 'checkbox':
                return (
                    <div className="flex items-center h-10">
                        <input
                            type="checkbox"
                            checked={!!value}
                            onChange={e => onChange(e.target.checked)}
                            disabled={isReadOnly}
                            className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
                        />
                    </div>
                );
            case 'select':
                return (
                    <select
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        disabled={isReadOnly}
                        className={isReadOnly ? readOnlyClass : baseClass}
                    >
                        <option value="">-- Sélectionner --</option>
                        {field.field_options?.options.map(opt => (
                            <option key={opt.label} value={opt.label}>{opt.label}</option>
                        ))}
                    </select>
                );
            case 'notice':
                return (
                    <div className="flex items-start gap-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-4 py-3 text-cyan-300 text-sm">
                        <FileText className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{field.field_label}</span>
                    </div>
                );
            case 'file':
            case 'dicom': {
                const accept = field.field_type === 'dicom' ? '.dcm,application/dicom' : undefined;
                if (isReadOnly) {
                    if (field.field_type === 'dicom' && selectedMeeting?.collaborationId) {
                        return (
                            <div className="flex items-center gap-3">
                                {value && <a href={api.getFileUrl(value)} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline text-sm truncate max-w-40">{value.split('/').pop()}</a>}
                                <button
                                    onClick={() => setOncovisionOpen(true)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-all duration-200 cursor-pointer shrink-0"
                                >
                                    Annotation collaborative
                                </button>
                            </div>
                        );
                    }
                    return value
                        ? <a href={api.getFileUrl(value)} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline text-sm">{value.split('/').pop()}</a>
                        : <div className={readOnlyClass}>—</div>;
                }
                return (
                    <div className="flex flex-col gap-1.5">
                        <input
                            type="file"
                            accept={accept}
                            onChange={e => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                api.uploadPatientFile(f).then(({ url }) => onChange(url)).catch(() => alert('Erreur upload'));
                                if (field.field_type === 'dicom' && selectedMeeting?.collaborationId) {
                                    api.uploadDicomToMeeting(selectedMeeting.id, f).catch(err =>
                                        console.error('[DICOM] OncoVision upload failed:', err)
                                    );
                                }
                            }}
                            className="block w-full text-slate-100 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-cyan-500/20 file:text-cyan-300 hover:file:bg-cyan-500/30 cursor-pointer"
                        />
                        {value && <span className="text-xs text-cyan-400">{value.split('/').pop()}</span>}
                    </div>
                );
            }
            default:
                return <input type="text" value={value} onChange={e => onChange(e.target.value)} readOnly={isReadOnly} className={isReadOnly ? readOnlyClass : baseClass} />;
        }
    };

    const normalizeCompletionValue = React.useCallback((fieldType: string, rawValue: unknown) => {
        if (rawValue === null || rawValue === undefined) return null;

        if (fieldType === 'checkbox') {
            if (typeof rawValue === 'boolean') return rawValue;
            const value = String(rawValue).trim().toLowerCase();
            if (['true', '1', 'oui', 'yes', 'vrai'].includes(value)) return true;
            if (['false', '0', 'non', 'no', 'faux'].includes(value)) return false;
            return null;
        }

        if (fieldType === 'number' || fieldType === 'input:number') {
            const parsed = Number(rawValue);
            return Number.isFinite(parsed) ? parsed : null;
        }

        if (fieldType === 'date' || fieldType === 'datepicker') {
            const s = String(rawValue).trim();
            // DD-MM-YYYY ou DD/MM/YYYY → YYYY-MM-DD
            const m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
            if (m) return `${m[3]}-${m[2]}-${m[1]}`;
            // Déjà YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
            return null;
        }

        return String(rawValue).trim();
    }, []);

    const runAutoCompletion = React.useCallback(async (transcriptText: string) => {
        if (!formSchema) return;

        const fieldsForCompletion: CompletionFieldInput[] = formSchema.form
            .filter((field): field is FormFieldSchema & { field_key: string } => !!field.field_key && field.field_type !== 'notice' && field.field_type !== 'dicom')
            .map((field) => ({
                name: field.field_key,
                label: field.field_label,
                type: field.field_type,
                required: !!field.field_required,
                semantic_hint: field.field_hint || field.field_label,
            }));

        if (!fieldsForCompletion.length) return;

        console.log('[AutoFill] champs envoyés:', fieldsForCompletion);
        console.log('[AutoFill] transcription:', transcriptText.slice(0, 200));

        const result = (await api.extractFormFromTranscript({
            form: { fields: fieldsForCompletion },
            text: transcriptText,
        })) as CompletionResponse;
        const extracted = result.data || {};

        console.log('[AutoFill] réponse LLM:', extracted);

        let appliedCount = 0;
        const changedKeys: string[] = [];
        setEditForm((prev: Record<string, any>) => {
            const next = { ...prev };

            if (!next.firstName) next.firstName = selectedMeeting?.patientFirstName || '';
            if (!next.lastName) next.lastName = selectedMeeting?.patientLastName || '';
            if (!next.profession) next.profession = user?.profession?.name || '';

            for (const field of fieldsForCompletion) {
                const rawValue = extracted[field.name];
                const normalized = normalizeCompletionValue(field.type, rawValue);
                console.log(`[AutoFill] champ="${field.name}" type="${field.type}" raw=${JSON.stringify(rawValue)} normalized=${JSON.stringify(normalized)}`);
                if (normalized === null || normalized === undefined || normalized === '') continue;

                const currentValue = next[field.name];
                const changed = String(currentValue ?? '') !== String(normalized);
                if (!changed) continue;

                next[field.name] = normalized;
                appliedCount += 1;
                changedKeys.push(field.name);
            }

            return next;
        });

        if (appliedCount > 0) {
            setAutofillStatus(`Auto-remplissage: ${appliedCount} champ(s) mis à jour.`);
            setAutofilledKeys(changedKeys);
        } else {
            setAutofillStatus('Transcription reçue, aucun nouveau champ détecté pour ce formulaire.');
            setAutofilledKeys([]);
        }
    }, [formSchema, selectedMeeting?.patientFirstName, selectedMeeting?.patientLastName, user?.profession?.name, normalizeCompletionValue]);

    React.useEffect(() => {
        if (modalType !== 'patient' || !isModalOpen) return;
        if (wsStatus === 'disconnected' || wsStatus === 'error') return;
        const transcriptText = liveTranscript.trim();
        if (!transcriptText || !formSchema) return;
        if (transcriptText.length < MIN_TRANSCRIPT_LENGTH_FOR_AUTOFILL) return;
        if (transcriptText === lastProcessedTranscriptRef.current) return;

        if (autoFillTimerRef.current) {
            clearTimeout(autoFillTimerRef.current);
        }

        autoFillTimerRef.current = setTimeout(async () => {
            if (autoFillInFlightRef.current) return;

            autoFillInFlightRef.current = true;
            try {
                await runAutoCompletion(transcriptText);
                lastProcessedTranscriptRef.current = transcriptText;
            } catch (error) {
                console.error('Erreur auto-remplissage formulaire:', error);
                setAutofillStatus('Auto-remplissage indisponible pour le moment.');
            } finally {
                autoFillInFlightRef.current = false;
            }
        }, 1800);

        return () => {
            if (autoFillTimerRef.current) clearTimeout(autoFillTimerRef.current);
        };
    }, [liveTranscript, formSchema, modalType, isModalOpen, runAutoCompletion, wsStatus]);

    const handleSaveForm = async () => {
        if (!selectedMeeting || !user?.id) return;

        // Vérifier champs obligatoires
        const missing = MANDATORY_FIELDS.filter(f => !editForm[f]?.toString().trim());
        if (missing.length > 0) {
            setSaveError(`Champs obligatoires manquants : ${missing.map(f => MANDATORY_LABELS[f] || f).join(', ')}`);
            return;
        }
        setSaveError('');

        // On retire les champs techniques avant d'envoyer
        const payload: Record<string, any> = {};
        for (const [k, v] of Object.entries(editForm)) {
            if (!METADATA_FIELDS.includes(k)) payload[k] = v;
        }

        const labels: Record<string, string> = {};
        MANDATORY_FIELDS.forEach(f => { labels[f] = MANDATORY_LABELS[f] || f; });
        if (formSchema) {
            for (const field of formSchema.form) {
                if (field.field_key) labels[field.field_key] = field.field_label;
            }
        }
        payload._labels = labels;
        payload.submittedBy = user.id;

        try {
            let patientRecordId = editForm.id;

            if (!patientRecordId) {
                const newRecord = await api.createPatientRecord(payload);
                patientRecordId = newRecord.id;
            } else {
                await api.updatePatientRecord(patientRecordId, payload);
            }

            await api.markFormFilled(selectedMeeting.id, user.id, patientRecordId);

            const updatedMeetings = await api.getMeetingsByParticipant(user.id);
            setMeetings(updatedMeetings);

            setIsModalOpen(false);
        } catch (error: any) {
            console.error('Erreur sauvegarde:', error);
            setSaveError(error.message || 'Erreur lors de la sauvegarde');
        }
    };

    const handleJoinMeeting = (meeting: Meeting) => {
        if (!isCurrentUserFormFilled(meeting)) {
            alert('Vous devez compléter les pré-requis avant de rejoindre la réunion.');
            return;
        }
        navigate(`/meeting/${meeting.id}/premeeting`);
    };

    const handleCreateMeeting = async () => {
        if (!user?.id) return;
        if (!createForm.subject || !createForm.scheduledDate || !createForm.time || !createForm.duration || !createForm.patientFirstName.trim() || !createForm.patientLastName.trim()) {
            setCreateError('Veuillez remplir tous les champs obligatoires');
            return;
        }
        setCreateLoading(true);
        setCreateError('');
        try {
            const participants = [
                { user: user.id, profession: user.profession?.id || user.profession },
                ...selectedParticipants
                    .filter(id => id !== user.id)
                    .map(id => {
                        const u = allUsers.find(u => u.id === id);
                        return { user: id, profession: u?.profession?.id || u?.profession };
                    }),
            ];
            const meetingData = {
                subject: createForm.subject,
                description: createForm.description,
                time: createForm.time,
                patientFirstName: createForm.patientFirstName.trim(),
                patientLastName: createForm.patientLastName.trim(),
                participants,
                roomAdmin: user.id,
                scheduledDate: new Date(createForm.scheduledDate).toISOString(),
                duration: createForm.duration,
            };
            await api.createMeeting(meetingData);
            const updatedMeetings = await api.getMeetingsByParticipant(user.id);
            setMeetings(updatedMeetings);
            setIsCreateModalOpen(false);
            setCreateForm({ subject: '', description: '', scheduledDate: '', time: '', duration: 30, patientFirstName: '', patientLastName: '' });
            setSelectedParticipants([]);
        } catch (error: any) {
            setCreateError(error.message || 'Erreur lors de la création');
        } finally {
            setCreateLoading(false);
        }
    };

    const handleToggleVoice = async () => {
        if (isRecording) {
            stopRecording();
            return;
        }
        setAutofillStatus('Dictée en cours...');
        await startRecording();
    };

    // ─── shared input classes ───────────────────────────────────────────────
    const inputClass = 'bg-white/6 border border-white/12 rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all duration-200 w-full';
    const labelClass = 'text-sm font-medium text-slate-300 mb-1.5 block';

    return (
        <div className="min-h-screen bg-[#080D1A] text-slate-100 font-sans">

            {/* ══════════════════════════════════════════════════════
                MODAL 1 & 2 — Patient Form (patient) / Meeting Details (details)
            ══════════════════════════════════════════════════════ */}
            {isModalOpen && selectedMeeting && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="relative w-full max-w-2xl backdrop-blur-2xl bg-[#0D1526] border border-white/10 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
                            <h2 className="text-lg font-semibold text-slate-50 flex items-center gap-2.5">
                                {modalType === 'patient' ? (
                                    <>
                                        <FileText className="w-5 h-5 text-cyan-400" />
                                        {isCurrentUserFormFilled(selectedMeeting) ? 'Dossier Patient' : 'Créer Dossier Patient'}
                                    </>
                                ) : (
                                    <>
                                        <Calendar className="w-5 h-5 text-cyan-400" />
                                        Détails de la Réunion
                                    </>
                                )}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                aria-label="Fermer"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/8 transition-all duration-200 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto px-6 py-5">

                            {/* ── DETAILS modal ─────────────────────────────────── */}
                            {modalType === 'details' ? (
                                <div className="space-y-4">
                                    {isAdmin(selectedMeeting) ? (
                                        <>
                                            {/* Subject */}
                                            <div>
                                                <label className={labelClass}>
                                                    Sujet <span className="text-red-400">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={detailsForm.subject}
                                                    onChange={(e) => setDetailsForm({ ...detailsForm, subject: e.target.value })}
                                                    className={inputClass}
                                                />
                                            </div>

                                            {/* Description */}
                                            <div>
                                                <label className={labelClass}>Description</label>
                                                <textarea
                                                    value={detailsForm.description}
                                                    onChange={(e) => setDetailsForm({ ...detailsForm, description: e.target.value })}
                                                    rows={3}
                                                    className={`${inputClass} resize-none`}
                                                />
                                            </div>

                                            {/* Patient section */}
                                            <div className="border-t border-white/8 pt-4">
                                                <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                                                    <User className="w-4 h-4" />
                                                    Patient concerné
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className={labelClass}>Nom du patient</label>
                                                        <input
                                                            type="text"
                                                            value={detailsForm.patientLastName}
                                                            onChange={(e) => setDetailsForm({ ...detailsForm, patientLastName: e.target.value })}
                                                            className={inputClass}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={labelClass}>Prénom du patient</label>
                                                        <input
                                                            type="text"
                                                            value={detailsForm.patientFirstName}
                                                            onChange={(e) => setDetailsForm({ ...detailsForm, patientFirstName: e.target.value })}
                                                            className={inputClass}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Time & Duration */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className={labelClass}>
                                                        Heure <span className="text-red-400">*</span>
                                                    </label>
                                                    <input
                                                        type="time"
                                                        value={detailsForm.time}
                                                        onChange={(e) => setDetailsForm({ ...detailsForm, time: e.target.value })}
                                                        className={inputClass}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Durée (min)</label>
                                                    <input
                                                        type="number"
                                                        min={5}
                                                        step={5}
                                                        value={detailsForm.duration}
                                                        onChange={(e) => setDetailsForm({ ...detailsForm, duration: parseInt(e.target.value) || 0 })}
                                                        className={inputClass}
                                                    />
                                                </div>
                                            </div>

                                            {/* Participants (admin edit) */}
                                            <div className="border-t border-white/8 pt-4">
                                                <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                                                    <Users className="w-4 h-4" />
                                                    Participants
                                                </h3>
                                                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                                                    {allUsers
                                                        .filter(u => u.id !== (selectedMeeting.roomAdmin?.id || selectedMeeting.roomAdmin))
                                                        .map(u => (
                                                            <label
                                                                key={u.id}
                                                                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/4 cursor-pointer transition-colors duration-150"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={editParticipants.includes(u.id)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) {
                                                                            setEditParticipants(prev => prev.includes(u.id) ? prev : [...prev, u.id]);
                                                                        } else {
                                                                            setEditParticipants(prev => prev.filter(id => id !== u.id));
                                                                        }
                                                                    }}
                                                                    className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
                                                                />
                                                                <span className="text-slate-200 text-sm">
                                                                    {u.firstName} {u.lastName}
                                                                </span>
                                                                {u.profession?.name && (
                                                                    <span className="text-xs text-slate-500 ml-auto">({u.profession.name})</span>
                                                                )}
                                                            </label>
                                                        ))}
                                                    {allUsers.filter(u => u.id !== (selectedMeeting.roomAdmin?.id || selectedMeeting.roomAdmin)).length === 0 && (
                                                        <p className="text-slate-500 text-sm px-3 py-2">Aucun autre utilisateur disponible</p>
                                                    )}
                                                </div>
                                            </div>

                                            {detailsError && (
                                                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                                                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                                    {detailsError}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        /* Non-admin read-only view */
                                        <>
                                            <div className="backdrop-blur-xl bg-white/4 border border-white/8 rounded-2xl p-4">
                                                <p className="text-xs text-slate-500 mb-1">Titre</p>
                                                <p className="text-slate-50 font-semibold text-base">{selectedMeeting.subject}</p>
                                            </div>
                                            {selectedMeeting.description && (
                                                <div className="backdrop-blur-xl bg-white/4 border border-white/8 rounded-2xl p-4">
                                                    <p className="text-xs text-slate-500 mb-1">Description</p>
                                                    <p className="text-slate-200">{selectedMeeting.description}</p>
                                                </div>
                                            )}
                                            {(selectedMeeting.patientLastName || selectedMeeting.patientFirstName) && (
                                                <div className="backdrop-blur-xl bg-white/4 border border-white/8 rounded-2xl p-4">
                                                    <p className="text-xs text-slate-500 mb-1">Patient concerné</p>
                                                    <p className="text-slate-50 font-semibold">
                                                        {selectedMeeting.patientLastName} {selectedMeeting.patientFirstName}
                                                    </p>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="backdrop-blur-xl bg-white/4 border border-white/8 rounded-2xl p-4">
                                                    <p className="text-xs text-slate-500 mb-1">Heure</p>
                                                    <p className="text-slate-50 font-semibold flex items-center gap-1.5">
                                                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                                                        {selectedMeeting.time}
                                                    </p>
                                                </div>
                                                <div className="backdrop-blur-xl bg-white/4 border border-white/8 rounded-2xl p-4">
                                                    <p className="text-xs text-slate-500 mb-1">Durée</p>
                                                    <p className="text-slate-50 font-semibold">{selectedMeeting.duration} min</p>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Participants list (always visible) */}
                                    <div className="backdrop-blur-xl bg-white/4 border border-white/8 rounded-2xl p-4">
                                        <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5" />
                                            Participants
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedMeeting.participants?.map((p, index) => (
                                                <span
                                                    key={index}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                                                        p.formFilled
                                                            ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                                            : 'bg-white/6 text-slate-300 border-white/8'
                                                    }`}
                                                >
                                                    {p.formFilled && <CheckCircle className="w-3 h-3" />}
                                                    {p.user?.firstName || p.user?.fistName} {p.user?.lastName}
                                                    {p.showProfession && p.profession?.name && ` (${p.profession.name})`}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                            ) : (
                                /* ── PATIENT FORM modal ───────────────────────────── */
                                <div className="space-y-4">

                                    {/* Voice recording panel */}
                                    <div className="backdrop-blur-xl bg-white/4 border border-white/8 rounded-2xl p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                                                Remplissage vocal
                                            </h3>
                                            <button
                                                onClick={handleToggleVoice}
                                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                                                    isRecording
                                                        ? 'bg-red-600 hover:bg-red-500 text-white focus:ring-red-500/50'
                                                        : 'bg-white/8 hover:bg-white/12 text-slate-200 border border-white/10 focus:ring-cyan-500/50'
                                                }`}
                                            >
                                                {isRecording ? (
                                                    <><MicOff className="w-3.5 h-3.5" /> Arrêter dictée</>
                                                ) : (
                                                    <><Mic className="w-3.5 h-3.5" /> Démarrer dictée</>
                                                )}
                                            </button>
                                        </div>

                                        <p className="text-[11px] text-slate-500">
                                            Statut transcription : <span className="text-slate-400">{wsStatus}</span>
                                        </p>

                                        {autofillStatus && (
                                            <p className="text-[11px] text-cyan-300 flex items-center gap-1.5">
                                                <RefreshCw className="w-3 h-3 shrink-0" />
                                                {autofillStatus}
                                            </p>
                                        )}

                                        {autofilledKeys.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {autofilledKeys.map((key) => (
                                                    <span
                                                        key={key}
                                                        className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-medium"
                                                    >
                                                        {key}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {liveTranscript && (
                                            <div className="backdrop-blur-xl bg-white/4 border border-white/8 rounded-xl p-3 max-h-32 overflow-y-auto">
                                                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                                                    {liveTranscript}
                                                </p>
                                            </div>
                                        )}

                                        {!!liveTranscript && !isRecording && (
                                            <button
                                                onClick={() => {
                                                    clearTranscript();
                                                    setLiveTranscript('');
                                                    setAutofillStatus('');
                                                    lastProcessedTranscriptRef.current = '';
                                                }}
                                                className="text-[11px] px-3 py-1.5 rounded-xl bg-white/6 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/8 transition-all duration-200 cursor-pointer"
                                            >
                                                Effacer transcription
                                            </button>
                                        )}
                                    </div>

                                    {/* Fixed pre-filled fields — Patient */}
                                    <div className="space-y-2">
                                        <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                                            Patient concerné
                                        </h3>
                                        <div className="backdrop-blur-xl bg-white/4 border border-white/8 rounded-xl px-4 py-3 flex items-center gap-2">
                                            <User className="w-4 h-4 text-slate-500 shrink-0" />
                                            <span className="text-slate-50 font-semibold">
                                                {editForm.lastName || ''} {editForm.firstName || ''}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Dynamic form fields from OLGA profession schema */}
                                    {formSchema && formSchema.form.length > 0 && (
                                        <div className="border-t border-white/8 pt-4 space-y-4">
                                            <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                                                {formSchema.form_label}
                                            </h3>
                                            {formSchema.form.map((field: FormFieldSchema) => (
                                                <div key={field.unique_id}>
                                                    <label className={labelClass}>
                                                        {field.field_label}
                                                        {field.field_required && (
                                                            <span className="text-red-400 ml-1">*</span>
                                                        )}
                                                        {field.field_type === 'dicom' && (
                                                            <span className="ml-2 text-[10px] text-cyan-400 font-mono bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-md">
                                                                DICOM
                                                            </span>
                                                        )}
                                                    </label>
                                                    {renderFormField(field)}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* No schema warning */}
                                    {!formSchema && (
                                        <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                                            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                                            <p className="text-amber-400 text-sm">
                                                Le schéma du formulaire distant n'est pas encore disponible. Le formulaire ne peut pas être généré.
                                            </p>
                                        </div>
                                    )}

                                    {/* Save error */}
                                    {saveError && (
                                        <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                                            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                                            <p className="text-red-400 text-sm">{saveError}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        {(modalType === 'patient' || (modalType === 'details' && isAdmin(selectedMeeting))) && (
                            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/8">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="bg-white/8 hover:bg-white/12 text-slate-200 border border-white/10 px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer text-sm font-medium"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={modalType === 'patient' ? handleSaveForm : handleSaveDetails}
                                    disabled={modalType === 'details' && detailsSaving}
                                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                                >
                                    {modalType === 'details' && detailsSaving ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Sauvegarde...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            Enregistrer
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                MODAL — Annotation collaborative OncoVision
            ══════════════════════════════════════════════════════ */}
            {oncovisionOpen && selectedMeeting?.collaborationId && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-60 p-4">
                    <div className="relative w-full max-w-6xl h-[85vh] bg-[#0D1526] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 shrink-0">
                            <h2 className="text-base font-semibold text-slate-50">Annotation collaborative — {selectedMeeting.subject}</h2>
                            <button
                                onClick={() => setOncovisionOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/8 transition-all duration-200 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <CollaborativeAnnotation
                                roomId={selectedMeeting.collaborationId}
                                meetingId={selectedMeeting.id}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                MODAL 3 — Create Meeting
            ══════════════════════════════════════════════════════ */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="relative w-full max-w-2xl backdrop-blur-2xl bg-[#0D1526] border border-white/10 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
                            <h2 className="text-lg font-semibold text-slate-50 flex items-center gap-2.5">
                                <Plus className="w-5 h-5 text-cyan-400" />
                                Nouvelle réunion
                            </h2>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                aria-label="Fermer"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/8 transition-all duration-200 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                            {/* Subject */}
                            <div>
                                <label className={labelClass}>
                                    Sujet <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={createForm.subject}
                                    onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
                                    className={inputClass}
                                    placeholder="Sujet de la réunion"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className={labelClass}>Description</label>
                                <textarea
                                    value={createForm.description}
                                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                                    rows={3}
                                    className={`${inputClass} resize-none`}
                                    placeholder="Description (optionnelle)"
                                />
                            </div>

                            {/* Patient identity */}
                            <div className="border-t border-white/8 pt-5">
                                <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    Patient concerné
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>
                                            Nom du patient <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={createForm.patientLastName}
                                            onChange={(e) => setCreateForm({ ...createForm, patientLastName: e.target.value })}
                                            className={inputClass}
                                            placeholder="Nom du patient"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>
                                            Prénom du patient <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={createForm.patientFirstName}
                                            onChange={(e) => setCreateForm({ ...createForm, patientFirstName: e.target.value })}
                                            className={inputClass}
                                            placeholder="Prénom du patient"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Date / Time / Duration — 3-col grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className={labelClass}>
                                        Date <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={createForm.scheduledDate}
                                        onChange={(e) => setCreateForm({ ...createForm, scheduledDate: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>
                                        Heure <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        value={createForm.time}
                                        onChange={(e) => setCreateForm({ ...createForm, time: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>
                                        Durée (min) <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min={5}
                                        step={5}
                                        value={createForm.duration}
                                        onChange={(e) => setCreateForm({ ...createForm, duration: parseInt(e.target.value) || 0 })}
                                        className={inputClass}
                                        placeholder="30"
                                    />
                                </div>
                            </div>

                            {/* Participants */}
                            <div className="border-t border-white/8 pt-5">
                                <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    Participants
                                </h3>
                                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                                    {allUsers
                                        .filter(u => u.id !== user?.id)
                                        .map(u => (
                                            <label
                                                key={u.id}
                                                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/4 cursor-pointer transition-colors duration-150"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedParticipants.includes(u.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedParticipants([...selectedParticipants, u.id]);
                                                        } else {
                                                            setSelectedParticipants(selectedParticipants.filter(id => id !== u.id));
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
                                                />
                                                <span className="text-slate-200 text-sm">
                                                    {u.firstName} {u.lastName}
                                                </span>
                                                {u.profession?.name && (
                                                    <span className="text-xs text-slate-500 ml-auto">({u.profession.name})</span>
                                                )}
                                            </label>
                                        ))}
                                    {allUsers.filter(u => u.id !== user?.id).length === 0 && (
                                        <p className="text-slate-500 text-sm px-3 py-2">Aucun autre utilisateur disponible</p>
                                    )}
                                </div>
                            </div>

                            {/* Create error */}
                            {createError && (
                                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                                    <p className="text-red-400 text-sm">{createError}</p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/8">
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="bg-white/8 hover:bg-white/12 text-slate-200 border border-white/10 px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer text-sm font-medium"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleCreateMeeting}
                                disabled={createLoading}
                                className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                            >
                                {createLoading ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Création...
                                    </>
                                ) : (
                                    <>
                                        <Video className="w-4 h-4" />
                                        Créer la réunion
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                MAIN PAGE
            ══════════════════════════════════════════════════════ */}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

                {/* Header row */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/"
                            aria-label="Retour"
                            className="p-2 rounded-xl bg-white/4 hover:bg-white/8 border border-white/8 text-slate-400 hover:text-slate-100 transition-all duration-200 cursor-pointer"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-2xl font-bold text-slate-50 tracking-tight">
                            Réunions
                        </h1>
                    </div>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50 flex items-center gap-2 text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Nouvelle réunion
                    </button>
                </div>

                {/* Meetings list */}
                <div className="grid gap-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <RefreshCw className="w-6 h-6 text-slate-500 animate-spin" />
                            <p className="text-slate-500 text-sm">Chargement des réunions...</p>
                        </div>
                    ) : meetings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="p-5 rounded-2xl bg-white/4 border border-white/8">
                                <Calendar className="w-8 h-8 text-slate-500" />
                            </div>
                            <div className="text-center">
                                <p className="text-slate-300 font-medium mb-1">Aucune réunion en attente</p>
                                <p className="text-slate-500 text-sm">Créez une nouvelle réunion pour commencer</p>
                            </div>
                        </div>
                    ) : (
                        meetings.map((meeting) => (
                            <div
                                key={meeting.id}
                                className="group backdrop-blur-xl bg-white/4 border border-white/8 rounded-2xl p-5 hover:border-cyan-500/30 hover:bg-white/6 transition-all duration-200"
                            >
                                <div className="flex flex-col md:flex-row items-start md:items-center gap-5">

                                    {/* Left color bar */}
                                    <div className="hidden md:block w-1 self-stretch rounded-full bg-cyan-500/60 shrink-0" />

                                    {/* Meeting info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-300 text-xs font-medium border border-cyan-500/20">
                                                <Clock className="w-3 h-3" />
                                                {meeting.time}
                                            </span>
                                        </div>
                                        <h3 className="text-base font-semibold text-slate-50 group-hover:text-cyan-300 transition-colors duration-200 truncate">
                                            {meeting.subject}
                                        </h3>
                                        {meeting.patientLastName && meeting.patientFirstName && (
                                            <p className="text-slate-400 text-sm mt-0.5 flex items-center gap-1.5">
                                                <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                {meeting.patientLastName} {meeting.patientFirstName}
                                            </p>
                                        )}
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
                                        {/* Details */}
                                        <button
                                            onClick={() => handleOpenDetailsModal(meeting)}
                                            className="bg-white/8 hover:bg-white/12 text-slate-200 border border-white/10 px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer text-sm flex items-center gap-1.5"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                            Détails
                                        </button>

                                        {/* Prerequisites */}
                                        {isCurrentUserFormFilled(meeting) ? (
                                            <button
                                                onClick={() => handleOpenPatientModal(meeting)}
                                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition-all duration-200 cursor-pointer"
                                            >
                                                <CheckCircle className="w-3.5 h-3.5" />
                                                Pré-requis réalisé
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleOpenPatientModal(meeting)}
                                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-all duration-200 cursor-pointer"
                                            >
                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                Pré-requis manquant
                                            </button>
                                        )}

                                        {/* Join */}
                                        <button
                                            onClick={() => handleJoinMeeting(meeting)}
                                            disabled={!isCurrentUserFormFilled(meeting)}
                                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                                                isCurrentUserFormFilled(meeting)
                                                    ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer'
                                                    : 'bg-white/4 text-slate-500 border border-white/6 opacity-50 cursor-not-allowed'
                                            }`}
                                        >
                                            <Video className="w-3.5 h-3.5" />
                                            Rejoindre
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default Meetings;
