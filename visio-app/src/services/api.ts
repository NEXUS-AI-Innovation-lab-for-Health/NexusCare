const API_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;

export const api = {
    login: async (email: string, password: string) => {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        if (!response.ok) {
            const text = await response.text();
            try {
                const error = JSON.parse(text);
                throw new Error(error.message || "Login failed");
            } catch (e) {
                throw new Error(text || "Login failed");
            }
        }
        return response.json();
    },

    register: async (userData: any) => {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData),
        });
        if (!response.ok) {
            try {
                const error = await response.json();
                throw new Error(error.message || "Registration failed");
            } catch {
                throw new Error("Registration failed");
            }
        }
        return response.json();
    },

    getProfessions: async () => {
        const response = await fetch(`${API_URL}/professions`);
        if (!response.ok) throw new Error('Failed to fetch professions');
        return response.json();
    },

    getPatientRecords: async () => {
        const response = await fetch(`${API_URL}/patient-records`);
        if (!response.ok) throw new Error("Failed to fetch patient records");
        return response.json();
    },

    getPatientRecord: async (id: string) => {
        const response = await fetch(`${API_URL}/patient-records/${id}`);
        if (!response.ok) throw new Error("Failed to fetch patient record");
        return response.json();
    },

    createPatientRecord: async (data: any) => {
        const response = await fetch(`${API_URL}/patient-records`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.message || "Failed to create patient record");
        }
        return response.json();
    },

    updatePatientRecord: async (id: string, data: any) => {
        const response = await fetch(`${API_URL}/patient-records/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("Failed to update patient record");
        return response.json();
    },

    deletePatientRecord: async (id: string) => {
        const response = await fetch(`${API_URL}/patient-records/${id}`, {
            method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to delete patient record");
        return response.json();
    },

    getMeetings: async () => {
        const response = await fetch(`${API_URL}/meetings`);
        if (!response.ok) throw new Error("Failed to fetch meetings");
        return response.json();
    },

    getMeeting: async (id: string) => {
        const response = await fetch(`${API_URL}/meetings/${id}`);
        if (!response.ok) throw new Error("Failed to fetch meeting");
        return response.json();
    },

    getMeetingByRoomId: async (roomId: string) => {
        const response = await fetch(`${API_URL}/meetings/room/${roomId}`);
        if (!response.ok) throw new Error("Failed to fetch meeting");
        return response.json();
    },

    getPendingMeetings: async () => {
        const response = await fetch(`${API_URL}/meetings/pending`);
        if (!response.ok) throw new Error("Failed to fetch pending meetings");
        return response.json();
    },

    getMeetingsByParticipant: async (participantId: string) => {
        const response = await fetch(`${API_URL}/meetings/participant/${participantId}`);
        if (!response.ok) throw new Error("Failed to fetch meetings");
        return response.json();
    },

    createMeeting: async (data: any) => {
        const response = await fetch(`${API_URL}/meetings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("Failed to create meeting");
        return response.json();
    },

    updateMeeting: async (id: string, data: any, requesterId?: string) => {
        const url = requesterId 
            ? `${API_URL}/meetings/${id}?requesterId=${requesterId}`
            : `${API_URL}/meetings/${id}`;
        const response = await fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("Failed to update meeting");
        return response.json();
    },

    deleteMeeting: async (id: string) => {
        const response = await fetch(`${API_URL}/meetings/${id}`, {
            method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to delete meeting");
        return response.json();
    },

    markFormFilled: async (meetingId: string, participantId: string, patientRecordId: string) => {
        const response = await fetch(`${API_URL}/meetings/${meetingId}/form-filled`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ participantId, patientRecordId }),
        });
        if (!response.ok) throw new Error("Failed to mark form as filled");
        return response.json();
    },

    getMeetingPatient: async (meetingId: string) => {
        const response = await fetch(`${API_URL}/meetings/${meetingId}/patient`);
        if (!response.ok) throw new Error("Failed to fetch meeting patient");
        return response.json();
    },

    getMeetingParticipantsStatus: async (meetingId: string) => {
        const response = await fetch(`${API_URL}/meetings/${meetingId}/participants-status`);
        if (!response.ok) throw new Error("Failed to fetch participants status");
        return response.json();
    },

    getMeetingPatientRecords: async (meetingId: string) => {
        const response = await fetch(`${API_URL}/meetings/${meetingId}/patient-records`);
        if (!response.ok) throw new Error("Failed to fetch patient records");
        return response.json();
    },

    startMeeting: async (id: string) => {
        const response = await fetch(`${API_URL}/meetings/${id}/start`, {
            method: "PATCH",
        });
        if (!response.ok) throw new Error("Failed to start meeting");
        return response.json();
    },

    completeMeeting: async (id: string) => {
        const response = await fetch(`${API_URL}/meetings/${id}/complete`, {
            method: "PATCH",
        });
        if (!response.ok) throw new Error("Failed to complete meeting");
        return response.json();
    },

    cancelMeeting: async (id: string) => {
        const response = await fetch(`${API_URL}/meetings/${id}/cancel`, {
            method: "PATCH",
        });
        if (!response.ok) throw new Error("Failed to cancel meeting");
        return response.json();
    },

    getUsers: async () => {
        const response = await fetch(`${API_URL}/users`);
        if (!response.ok) throw new Error("Failed to fetch users");
        return response.json();
    },

    getUser: async (id: string) => {
        const response = await fetch(`${API_URL}/users/${id}`);
        if (!response.ok) throw new Error("Failed to fetch user");
        return response.json();
    },

    updateUser: async (id: string, data: any) => {
        const response = await fetch(`${API_URL}/users/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("Failed to update user");
        return response.json();
    },

    getMessages: async (roomId: string) => {
        const response = await fetch(`${API_URL}/messages/room/${encodeURIComponent(roomId)}`);
        if (!response.ok) throw new Error("Failed to fetch messages");
        return response.json();
    },

    addParticipantToMeeting: async (meetingId: string, participantId: string, professionId: string) => {
        const response = await fetch(`${API_URL}/meetings/${meetingId}/participants`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ participantId, professionId }),
        });
        if (!response.ok) throw new Error("Failed to add participant");
        return response.json();
    },

    removeParticipantFromMeeting: async (meetingId: string, participantId: string) => {
        const response = await fetch(`${API_URL}/meetings/${meetingId}/participants/${participantId}`, {
            method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to remove participant");
        return response.json();
    },

    // Groups
    getGroupsByUser: async (userId: string) => {
        const response = await fetch(`${API_URL}/groups/user/${userId}`);
        if (!response.ok) throw new Error("Failed to fetch groups");
        return response.json();
    },

    getGroup: async (id: string) => {
        const response = await fetch(`${API_URL}/groups/${id}`);
        if (!response.ok) throw new Error("Failed to fetch group");
        return response.json();
    },

    createGroup: async (data: { name: string; createdById: string; memberIds: string[] }) => {
        const response = await fetch(`${API_URL}/groups`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("Failed to create group");
        return response.json();
    },

    addGroupMember: async (groupId: string, userId: string) => {
        const response = await fetch(`${API_URL}/groups/${groupId}/members/${userId}`, {
            method: "POST",
        });
        if (!response.ok) throw new Error("Failed to add group member");
        return response.json();
    },

    removeGroupMember: async (groupId: string, userId: string) => {
        const response = await fetch(`${API_URL}/groups/${groupId}/members/${userId}`, {
            method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to remove group member");
        return response.json();
    },

    getFormById: async (id: string) => {
        const response = await fetch(`${API_URL}/forms/${id}`);
        if (!response.ok) return null;
        return response.json();
    },
};
