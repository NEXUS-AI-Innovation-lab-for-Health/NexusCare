import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface Meeting {
    id: string;
    roomId: string;
    subject: string;
    description?: string;
    time: string;
    patientFirstName?: string;
    patientLastName?: string;
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

const MANDATORY_FIELDS = ['firstName', 'lastName', 'profession'];
const METADATA_FIELDS = ['id', 'createdAt', 'updatedAt'];

const MANDATORY_LABELS: Record<string, string> = {
    firstName: 'Prénom',
    lastName: 'Nom',
    profession: 'Profession',
};

const Meetings: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = React.useState<any>(null);
    const [meetings, setMeetings] = React.useState<Meeting[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedMeeting, setSelectedMeeting] = React.useState<Meeting | null>(null);
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [modalType, setModalType] = React.useState<'patient' | 'details'>('patient');
    const [editForm, setEditForm] = React.useState<Record<string, any>>({});
    const [newFieldName, setNewFieldName] = React.useState('');
    const [newFieldValue, setNewFieldValue] = React.useState('');
    const [saveError, setSaveError] = React.useState('');

    // Create meeting modal state
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

    // Edit meeting details state (admin only)
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

            const selectedIds = new Set<string>(editParticipants);
            if (adminId) {
                selectedIds.add(adminId);
            }

            const participantsPayload = Array.from(selectedIds).map(id => {
                const isExisting = currentParticipantIds.includes(id);
                const u = allUsers.find(u => u.id === id) || (adminId === id ? user : undefined);
                return {
                    user: id,
                    ...(isExisting ? {} : { profession: u?.profession?.id || u?.profession }),
                };
            });

            await api.updateMeeting(selectedMeeting.id, {
                subject: detailsForm.subject.trim(),
                description: detailsForm.description.trim(),
                time: detailsForm.time,
                duration: detailsForm.duration,
                patientFirstName: detailsForm.patientFirstName.trim(),
                patientLastName: detailsForm.patientLastName.trim(),
                participants: participantsPayload,
            }, user.id);
            const updatedMeetings = await api.getMeetingsByParticipant(user.id);
            setMeetings(updatedMeetings);
            setIsModalOpen(false);
        } catch (error: any) {
            setDetailsError(error.message || 'Erreur lors de la sauvegarde');
        } finally {
            setDetailsSaving(false);
        }
    };

    const handleAddField = () => {
        if (newFieldName && newFieldValue) {
            setEditForm({ ...editForm, [newFieldName]: newFieldValue });
            setNewFieldName('');
            setNewFieldValue('');
        }
    };

    const handleDeleteField = (fieldName: string) => {
        const { [fieldName]: _, ...rest } = editForm as Record<string, any>;
        setEditForm(rest);
    };

    const handleSaveForm = async () => {
        if (!selectedMeeting || !user?.id) return;

        // Vérifier champs obligatoires
        const missing = MANDATORY_FIELDS.filter(f => !editForm[f]?.toString().trim());
        if (missing.length > 0) {
            setSaveError(`Champs obligatoires manquants : ${missing.map(f => MANDATORY_LABELS[f] || f).join(', ')}`);
            return;
        }
        setSaveError('');

        // Strip metadata before sending
        const payload: Record<string, any> = {};
        for (const [k, v] of Object.entries(editForm)) {
            if (!METADATA_FIELDS.includes(k)) payload[k] = v;
        }

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

    const handleJoinMeeting = (meetingId: string, _roomId: string) => {
        navigate(`/meeting/${meetingId}/premeeting`);
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

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
            {isModalOpen && selectedMeeting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-800">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                {modalType === 'patient' ? (
                                    <>
                                        <span>📋</span> {isCurrentUserFormFilled(selectedMeeting) ? 'Dossier Patient' : 'Créer Dossier Patient'}
                                    </>
                                ) : (
                                    <>
                                        <span>📅</span> Détails de la Réunion
                                    </>
                                )}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6">
                            {modalType === 'details' ? (
                                <div className="space-y-4">
                                    {isAdmin(selectedMeeting) ? (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-300 mb-2">Sujet <span className="text-red-400">*</span></label>
                                                <input
                                                    type="text"
                                                    value={detailsForm.subject}
                                                    onChange={(e) => setDetailsForm({ ...detailsForm, subject: e.target.value })}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                                                <textarea
                                                    value={detailsForm.description}
                                                    onChange={(e) => setDetailsForm({ ...detailsForm, description: e.target.value })}
                                                    rows={3}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors resize-none"
                                                />
                                            </div>
                                            <div className="border-t border-slate-700 pt-4">
                                                <h3 className="text-sm font-semibold text-teal-400 mb-3 flex items-center gap-2">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                    Patient concerné
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-300 mb-2">Nom du patient</label>
                                                        <input
                                                            type="text"
                                                            value={detailsForm.patientLastName}
                                                            onChange={(e) => setDetailsForm({ ...detailsForm, patientLastName: e.target.value })}
                                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-300 mb-2">Prénom du patient</label>
                                                        <input
                                                            type="text"
                                                            value={detailsForm.patientFirstName}
                                                            onChange={(e) => setDetailsForm({ ...detailsForm, patientFirstName: e.target.value })}
                                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-300 mb-2">Heure <span className="text-red-400">*</span></label>
                                                    <input
                                                        type="time"
                                                        value={detailsForm.time}
                                                        onChange={(e) => setDetailsForm({ ...detailsForm, time: e.target.value })}
                                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-300 mb-2">Durée (min)</label>
                                                    <input
                                                        type="number"
                                                        min={5}
                                                        step={5}
                                                        value={detailsForm.duration}
                                                        onChange={(e) => setDetailsForm({ ...detailsForm, duration: parseInt(e.target.value) || 0 })}
                                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                                                    />
                                                </div>
                                            </div>
                                            <div className="border-t border-slate-700 pt-4 mt-4">
                                                <h3 className="text-sm font-semibold text-teal-400 mb-3 flex items-center gap-2">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                    Participants
                                                </h3>
                                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                                    {allUsers
                                                        .filter(u => u.id !== (selectedMeeting.roomAdmin?.id || selectedMeeting.roomAdmin))
                                                        .map(u => (
                                                            <label key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 cursor-pointer">
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
                                                                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500"
                                                                />
                                                                <span className="text-white text-sm">
                                                                    {u.firstName} {u.lastName}
                                                                </span>
                                                                {u.profession?.name && (
                                                                    <span className="text-xs text-slate-400">({u.profession.name})</span>
                                                                )}
                                                            </label>
                                                        ))}
                                                    {allUsers.filter(u => u.id !== (selectedMeeting.roomAdmin?.id || selectedMeeting.roomAdmin)).length === 0 && (
                                                        <p className="text-slate-500 text-sm">Aucun autre utilisateur disponible</p>
                                                    )}
                                                </div>
                                            </div>
                                            {detailsError && (
                                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                                                    {detailsError}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                                <div className="text-slate-400 text-sm mb-1">Titre</div>
                                                <div className="text-white font-semibold text-lg">{selectedMeeting.subject}</div>
                                            </div>
                                            {selectedMeeting.description && (
                                                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                                    <div className="text-slate-400 text-sm mb-1">Description</div>
                                                    <div className="text-white">{selectedMeeting.description}</div>
                                                </div>
                                            )}
                                            {(selectedMeeting.patientLastName || selectedMeeting.patientFirstName) && (
                                                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                                    <div className="text-slate-400 text-sm mb-1">Patient concerné</div>
                                                    <div className="text-white font-semibold text-lg">{selectedMeeting.patientLastName} {selectedMeeting.patientFirstName}</div>
                                                </div>
                                            )}
                                            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                                <div className="text-slate-400 text-sm mb-1">Heure</div>
                                                <div className="text-white font-semibold text-lg">{selectedMeeting.time}</div>
                                            </div>
                                            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                                <div className="text-slate-400 text-sm mb-1">Durée</div>
                                                <div className="text-white font-semibold text-lg">{selectedMeeting.duration} min</div>
                                            </div>
                                        </>
                                    )}
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                        <div className="text-slate-400 text-sm mb-1">Participants</div>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {selectedMeeting.participants?.map((p, index) => (
                                                <span key={index} className={`px-3 py-1 rounded-full text-sm border ${p.formFilled ? 'bg-teal-500/20 text-teal-300 border-teal-500/30' : 'bg-slate-700/50 text-slate-300 border-slate-600'}`}>
                                                    {p.user?.firstName || p.user?.fistName} {p.user?.lastName}
                                                    {p.showProfession && p.profession?.name && ` (${p.profession.name})`}
                                                    {p.formFilled && ' ✓'}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                                    {/* Mandatory fields */}
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-semibold text-teal-400 uppercase tracking-wider">Champs obligatoires</h3>
                                        {MANDATORY_FIELDS.map((key) => (
                                            <div key={key}>
                                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                                    {MANDATORY_LABELS[key] || key} <span className="text-rose-400">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={(editForm[key] as string) || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                                                    readOnly
                                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-400 cursor-not-allowed"
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Custom fields */}
                                    {Object.entries(editForm)
                                        .filter(([key]) => !MANDATORY_FIELDS.includes(key) && !METADATA_FIELDS.includes(key))
                                        .length > 0 && (
                                        <div className="border-t border-slate-700 pt-4 space-y-3">
                                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Champs personnalisés</h3>
                                            {Object.entries(editForm)
                                                .filter(([key]) => !MANDATORY_FIELDS.includes(key) && !METADATA_FIELDS.includes(key))
                                                .map(([key, value]) => (
                                                <div key={key} className="flex gap-2 items-start">
                                                    <div className="flex-1">
                                                        <label className="block text-sm font-medium text-slate-300 mb-2 capitalize">
                                                            {key.replace(/([a-z])([A-Z])/g, '$1 $2')}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={(value as string) || ''}
                                                            onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                                                            placeholder={`Entrez ${key}`}
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteField(key)}
                                                        className="mt-8 p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                                        title="Supprimer ce champ"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Add new custom field */}
                                    <div className="border-t border-slate-700 pt-4 mt-6">
                                        <h3 className="text-sm font-semibold text-teal-400 mb-3 flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            Ajouter un nouveau champ
                                        </h3>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={newFieldName}
                                                onChange={(e) => setNewFieldName(e.target.value)}
                                                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors text-sm"
                                                placeholder="Nom du champ"
                                            />
                                            <input
                                                type="text"
                                                value={newFieldValue}
                                                onChange={(e) => setNewFieldValue(e.target.value)}
                                                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors text-sm"
                                                placeholder="Valeur"
                                            />
                                            <button
                                                onClick={handleAddField}
                                                className="px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors flex items-center gap-1"
                                                title="Ajouter"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Save error */}
                                    {saveError && (
                                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                                            <p className="text-red-400 text-sm">{saveError}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {(modalType === 'patient' || (modalType === 'details' && isAdmin(selectedMeeting))) && (
                            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-800 bg-slate-900/50">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={modalType === 'patient' ? handleSaveForm : handleSaveDetails}
                                    disabled={modalType === 'details' && detailsSaving}
                                    className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium transition-colors flex items-center gap-2"
                                >
                                    {modalType === 'details' && detailsSaving ? (
                                        <>
                                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                            </svg>
                                            Sauvegarde...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Enregistrer
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-800">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Nouvelle réunion
                            </h2>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Meeting fields */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Sujet <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={createForm.subject}
                                    onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                                    placeholder="Sujet de la réunion"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={createForm.description}
                                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                                    rows={3}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors resize-none"
                                    placeholder="Description (optionnelle)"
                                />
                            </div>

                            {/* Patient fields */}
                            <div className="border-t border-slate-700 pt-5">
                                <h3 className="text-sm font-semibold text-teal-400 mb-4 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    Patient concerné
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Nom du patient <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={createForm.patientLastName}
                                            onChange={(e) => setCreateForm({ ...createForm, patientLastName: e.target.value })}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                                            placeholder="Nom du patient"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Prénom du patient <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={createForm.patientFirstName}
                                            onChange={(e) => setCreateForm({ ...createForm, patientFirstName: e.target.value })}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                                            placeholder="Prénom du patient"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Date <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={createForm.scheduledDate}
                                        onChange={(e) => setCreateForm({ ...createForm, scheduledDate: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Heure <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        value={createForm.time}
                                        onChange={(e) => setCreateForm({ ...createForm, time: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Durée (min) <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min={5}
                                        step={5}
                                        value={createForm.duration}
                                        onChange={(e) => setCreateForm({ ...createForm, duration: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                                        placeholder="30"
                                    />
                                </div>
                            </div>

                            {/* Participants section */}
                            <div className="border-t border-slate-700 pt-5">
                                <h3 className="text-sm font-semibold text-teal-400 mb-4 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    Participants
                                </h3>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {allUsers
                                        .filter(u => u.id !== user?.id)
                                        .map(u => (
                                            <label key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 cursor-pointer">
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
                                                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500"
                                                />
                                                <span className="text-white text-sm">
                                                    {u.firstName} {u.lastName}
                                                </span>
                                                {u.profession?.name && (
                                                    <span className="text-xs text-slate-400">({u.profession.name})</span>
                                                )}
                                            </label>
                                        ))}
                                    {allUsers.filter(u => u.id !== user?.id).length === 0 && (
                                        <p className="text-slate-500 text-sm">Aucun autre utilisateur disponible</p>
                                    )}
                                </div>
                            </div>

                            {/* Error display */}
                            {createError && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                                    {createError}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-800 bg-slate-900/50">
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleCreateMeeting}
                                disabled={createLoading}
                                className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center gap-2"
                            >
                                {createLoading ? (
                                    <>
                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        Création...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Créer la réunion
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/"
                            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                        >
                            <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </Link>
                        <h2 className="text-3xl font-bold flex items-center gap-3">
                            <span className="w-2 h-8 bg-teal-500 rounded-full inline-block"></span>
                            Réunions
                        </h2>
                    </div>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-all flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Nouvelle réunion
                    </button>
                </div>

                <div className="grid gap-6">
                    {loading ? (
                        <div className="text-center text-slate-400 py-8">Chargement des réunions...</div>
                    ) : meetings.length === 0 ? (
                        <div className="text-center text-slate-400 py-8">Aucune réunion en attente</div>
                    ) : (
                        meetings.map((meeting) => (
                            <div
                                key={meeting.id}
                                className="group bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-teal-500/50 transition-all duration-300 shadow-lg hover:shadow-teal-500/10"
                            >
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="px-3 py-1 bg-slate-800 text-slate-300 text-xs rounded-full border border-slate-700 font-mono">
                                                {meeting.time}
                                            </span>
                                            <h3 className="text-xl font-semibold text-white group-hover:text-teal-400 transition-colors">
                                                {meeting.subject}
                                            </h3>
                                        </div>
                                        {meeting.patientLastName && meeting.patientFirstName && (
                                            <p className="text-slate-400 text-sm flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                                                Patient : {meeting.patientLastName} {meeting.patientFirstName}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                                        <button
                                            onClick={() => handleOpenDetailsModal(meeting)}
                                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg border border-slate-700 transition-all flex items-center gap-2"
                                        >
                                            <span>ℹ️</span> Détails
                                        </button>

                                        {isCurrentUserFormFilled(meeting) ? (
                                            <button
                                                onClick={() => handleOpenPatientModal(meeting)}
                                                className="px-4 py-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 text-sm rounded-lg border border-teal-500/20 hover:border-teal-500/40 flex items-center gap-2 transition-all cursor-pointer"
                                            >
                                                <span>✅</span> Pré-requis réalisé
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleOpenPatientModal(meeting)}
                                                className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-sm rounded-lg border border-amber-500/20 hover:border-amber-500/40 flex items-center gap-2 transition-all cursor-pointer"
                                            >
                                                <span>⚠️</span> Pré-requis manquant
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handleJoinMeeting(meeting.id, meeting.roomId)}
                                            className="px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg shadow-lg shadow-teal-900/20 hover:shadow-teal-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                                        >
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
