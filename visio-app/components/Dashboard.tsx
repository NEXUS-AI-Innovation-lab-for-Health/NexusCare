import React from 'react';
import { api } from '../src/services/api';

interface Meeting {
    id: string;
    roomId: string;
    subject: string;
    description?: string;
    time: string;
    patient: any;
    participants: {
        participant: any;
        formFilled: boolean;
        patientRecord?: any;
        filledAt?: string;
    }[];
    roomAdmin: any;
    status: string;
    scheduledDate: string;
    duration: string;
}

interface DashboardProps {
    onJoinMeeting: (meetingId: string, roomId: string) => void;
}

const MANDATORY_FIELDS = ['firstName', 'lastName', 'profession'];
const METADATA_FIELDS = ['id', 'createdAt', 'updatedAt'];

const MANDATORY_LABELS: Record<string, string> = {
    firstName: 'Prénom',
    lastName: 'Nom',
    profession: 'Profession',
};

const Dashboard: React.FC<DashboardProps> = ({ onJoinMeeting }) => {
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

    React.useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    React.useEffect(() => {
        if (!user?.id) return;
        const fetchMeetings = async () => {
            try {
                const data = await api.getMeetingsByParticipant(user.id);
                setMeetings(data);
            } catch (error) {
                console.error('Erreur chargement meetings:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchMeetings();
    }, [user]);


    const displayUser = user || {
        fistName: "FIRSTNAME NOT FOUND",
        lastName: "LASTNAME NOT FOUND",
        job: "JOB NOT FOUND"
    };

    const isCurrentUserFormFilled = (meeting: Meeting): boolean => {
        if (!user?.id) return false;
        const participantInfo = meeting.participants.find(
            p => p.participant?.id === user.id
        );
        return participantInfo?.formFilled || false;
    };

    const handleOpenPatientModal = async (meeting: Meeting) => {
        setSelectedMeeting(meeting);
        setModalType('patient');
        setSaveError('');
        // Find the current user's participant entry and their own patientRecord
        const myParticipant = meeting.participants.find(p => p.participant?.id === user?.id);
        const myRecord = myParticipant?.patientRecord;
        // Pre-fill with user's OWN record if they already filled, otherwise empty
        const base: Record<string, any> = myRecord ? { ...myRecord } : {};
        for (const f of MANDATORY_FIELDS) {
            if (!(f in base)) base[f] = '';
        }
        setEditForm(base);
        setIsModalOpen(true);
    };

    const handleOpenDetailsModal = (meeting: Meeting) => {
        setSelectedMeeting(meeting);
        setModalType('details');
        setIsModalOpen(true);
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

        // Validate mandatory fields
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
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            setSaveError('Erreur lors de la sauvegarde');
        }
    };

    const getPatientName = (meeting: Meeting): string => {
        if (meeting.patient) {
            return `${meeting.patient.firstName || ''} ${meeting.patient.lastName || ''}`.trim() || 'Patient';
        }
        return 'Patient non assigné';
    };

    const getParticipantNames = (meeting: Meeting): string[] => {
        return meeting.participants.map(p => {
            if (p.participant) {
                return `${p.participant.fistName || ''} ${p.participant.lastName || ''}`.trim();
            }
            return 'Participant';
        });
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-800">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                {modalType === 'patient' ? (
                                    <>
                                        <span>📋</span> {selectedMeeting && isCurrentUserFormFilled(selectedMeeting) ? 'Dossier Patient' : 'Créer Dossier Patient'}
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

                        {/* Contenu */}
                        <div className="p-6">
                            {modalType === 'details' ? (
                                <div className="space-y-4">
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                        <div className="text-slate-400 text-sm mb-1">Titre</div>
                                        <div className="text-white font-semibold text-lg">{selectedMeeting?.subject}</div>
                                    </div>
                                    {selectedMeeting?.description && (
                                        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                            <div className="text-slate-400 text-sm mb-1">Description</div>
                                            <div className="text-white">{selectedMeeting.description}</div>
                                        </div>
                                    )}
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                        <div className="text-slate-400 text-sm mb-1">Heure</div>
                                        <div className="text-white font-semibold text-lg">{selectedMeeting?.time}</div>
                                    </div>
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                        <div className="text-slate-400 text-sm mb-1">Durée</div>
                                        <div className="text-white font-semibold text-lg">{selectedMeeting?.duration}</div>
                                    </div>
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                        <div className="text-slate-400 text-sm mb-1">Patient</div>
                                        <div className="text-white font-semibold text-lg">{selectedMeeting && getPatientName(selectedMeeting)}</div>
                                    </div>
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                        <div className="text-slate-400 text-sm mb-1">Participants</div>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {selectedMeeting?.participants?.map((p, index) => (
                                                <span key={index} className={`px-3 py-1 rounded-full text-sm border ${p.formFilled ? 'bg-teal-500/20 text-teal-300 border-teal-500/30' : 'bg-slate-700/50 text-slate-300 border-slate-600'}`}>
                                                    {p.participant?.fistName} {p.participant?.lastName}
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
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                                                    placeholder={`Entrez ${MANDATORY_LABELS[key] || key}`}
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
                                                            {key.replace(/([A-Z])/g, ' $1').trim()}
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

                        {/* Footer */}
                        {modalType === 'patient' && (
                            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-800 bg-slate-900/50">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleSaveForm}
                                    className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Enregistrer
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="flex items-center gap-4 mb-12 bg-slate-900/50 p-4 rounded-2xl border border-slate-800 w-fit backdrop-blur-sm">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-teal-500/50 shadow-lg shadow-teal-500/20 flex items-center justify-center bg-slate-800">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white">{displayUser.fistName} {displayUser.lastName}</h1>
                    <p className="text-teal-400 text-sm font-medium">({displayUser.job})</p>
                </div>
            </div>

            <div className="max-w-5xl mx-auto">
                <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                    <span className="w-2 h-8 bg-teal-500 rounded-full inline-block"></span>
                    Réunions en attente
                </h2>

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
                                                {getPatientName(meeting)}
                                            </h3>
                                        </div>
                                        <p className="text-slate-400 text-sm flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                                            {meeting.subject}
                                        </p>
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
                                            onClick={() => onJoinMeeting(meeting.id, meeting.roomId)}
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

export default Dashboard;
