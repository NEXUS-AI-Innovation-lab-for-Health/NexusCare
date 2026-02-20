import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '../types/socket';
import { api } from '../src/services/api';
import ReportGeneratorModal from './ReportGeneratorModal';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const MANDATORY_FIELDS = ['firstName', 'lastName', 'profession'];
const METADATA_FIELDS = ['id', 'createdAt', 'updatedAt'];
const MANDATORY_LABELS: Record<string, string> = {
  firstName: 'Prénom', lastName: 'Nom', profession: 'Profession',
};

const SERVER_URL = import.meta.env.VITE_WS_URL || "http://localhost:4000";

// ICE servers par défaut
const DEFAULT_ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: import.meta.env.VITE_STUN_URL || 'stun:stun.l.google.com:19302' },
    {
      urls: import.meta.env.VITE_TURN_URL || 'turn:localhost:3478',
      username: import.meta.env.VITE_TURN_USERNAME || 'admin',
      credential: import.meta.env.VITE_TURN_PASSWORD || 'password'
    }
  ],
};

// ICE servers dynamiques si clé metered.ca
// (clé requise en build)
const METERED_API_KEY = import.meta.env.VITE_METERED_API_KEY;

async function fetchIceServers(): Promise<RTCConfiguration> {
  if (!METERED_API_KEY) return DEFAULT_ICE_SERVERS;
  try {
    const response = await fetch(
      `https://cedlab.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
    );
    const iceServers = await response.json();
    return { iceServers };
  } catch {
    console.warn('Impossible de récupérer les ICE servers metered.ca, utilisation du fallback.');
    return DEFAULT_ICE_SERVERS;
  }
}

const MicIcon = ({ isEnabled }: { isEnabled: boolean }) => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {isEnabled ? (
      <>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
      </>
    ) : (
      <>
        <line x1="1" y1="1" x2="23" y2="23" stroke="white" />
        <path d="M9 9v3a3 3 0 0 0 6 0v-1" />
        <path d="M19 10v2a7 7 0 0 1-11.45 5.5" />
        <line x1="12" y1="19" x2="12" y2="23" />
      </>
    )}
  </svg>
);

const VideoIcon = ({ isEnabled }: { isEnabled: boolean }) => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {isEnabled ? (
      <>
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </>
    ) : (
      <>
        <path d="M1 1l22 22" />
        <path d="M23 7l-7 5l7 5z" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </>
    )}
  </svg>
);

const SpeakerIcon = ({ isEnabled }: { isEnabled: boolean }) => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {isEnabled ? (
      <>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      </>
    ) : (
      <>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </>
    )}
  </svg>
);

interface VideoCallProps {
  onLeave: () => void;
  initialMicOn?: boolean;
  initialCamOn?: boolean;
  initialVideoDeviceId?: string;
  initialAudioDeviceId?: string;
  meetingId?: string;
}

const VideoCall: React.FC<VideoCallProps> = ({ onLeave, initialMicOn = true, initialCamOn = true, initialVideoDeviceId, initialAudioDeviceId, meetingId }) => {
  const socketRef = useRef<AppSocket | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceConfigRef = useRef<RTCConfiguration>(DEFAULT_ICE_SERVERS);

  const [myId, setMyId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

  const [status, setStatus] = useState<string>("Démarrage...");
  const [isMicOn, setIsMicOn] = useState(initialMicOn);
  const [isCamOn, setIsCamOn] = useState(initialCamOn);
  const [patientsData, setPatientsData] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [currentMeeting, setCurrentMeeting] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<'info' | 'participants' | 'chat'>('info');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [saveError, setSaveError] = useState('');
  const [myPatientRecordId, setMyPatientRecordId] = useState<string | null>(null);

  const [participantNames, setParticipantNames] = useState<Map<string, string>>(new Map());

  const [currentUser] = useState<any>(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) return JSON.parse(storedUser);
    } catch {}
    return null;
  });

  const currentUserName = currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : '';

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>(initialVideoDeviceId || '');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>(initialAudioDeviceId || '');
  const [showDeviceMenu, setShowDeviceMenu] = useState<'video' | 'audio' | 'speaker' | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioOutputDevice, setSelectedAudioOutputDevice] = useState<string>('');
  const [volume, setVolume] = useState<number>(100);
  const remoteMediaRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [chatMessages, setChatMessages] = useState<Array<{content: string, senderName: string, timestamp: string, isOwn: boolean}>>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchIceServers().then(config => { iceConfigRef.current = config; });
  }, []);

  useEffect(() => {
    const loadMeetingData = async () => {
      if (!meetingId) {
        setStatus('⚠️ Aucune réunion sélectionnée');
        return;
      }
      
      try {
        const meeting = await api.getMeeting(meetingId);
        setCurrentMeeting(meeting);
        
        const patientRecords = await api.getMeetingPatientRecords(meetingId);
        
        const filledRecords = patientRecords.map((record: any) => ({
          ...record.patientRecord,
          submittedBy: record.participant,
          filledAt: record.filledAt
        }));
        
        setPatientsData(filledRecords);
        if (filledRecords.length > 0) {
          setSelectedPatient(filledRecords[0]);
        }
        setStatus('Connecté. Dossiers chargés.');
      } catch (error) {
        console.error('Erreur chargement meeting:', error);
        setStatus('⚠️ Erreur de chargement des dossiers');
      }
    };
    loadMeetingData();
  }, [meetingId]);

  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => (track.enabled = isMicOn));
      localStream.getVideoTracks().forEach(track => (track.enabled = isCamOn));
    }
  }, [localStream, isMicOn, isCamOn]);

  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
        setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
        setAudioOutputDevices(devices.filter(d => d.kind === 'audiooutput'));
      } catch (error) {
        console.error('Erreur énumération devices:', error);
      }
    };
    getDevices();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Apply volume to all remote media elements
  useEffect(() => {
    remoteMediaRefs.current.forEach((el) => {
      el.volume = volume / 100;
    });
  }, [volume, remoteStreams]);

  // Apply audio output device (sinkId) to all remote media elements
  useEffect(() => {
    if (selectedAudioOutputDevice) {
      remoteMediaRefs.current.forEach((el) => {
        if (typeof (el as any).setSinkId === 'function') {
          (el as any).setSinkId(selectedAudioOutputDevice).catch(console.error);
        }
      });
    }
  }, [selectedAudioOutputDevice, remoteStreams]);

  const changeDevice = useCallback(async (type: 'video' | 'audio', deviceId: string) => {
    if (!localStreamRef.current) return;

    try {
      const oldStream = localStreamRef.current;
      
      if (type === 'video') {
        setSelectedVideoDevice(deviceId);
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
          audio: selectedAudioDevice 
            ? { deviceId: { exact: selectedAudioDevice } }
            : true
        });

        newStream.getVideoTracks().forEach(track => (track.enabled = isCamOn));
        newStream.getAudioTracks().forEach(track => (track.enabled = isMicOn));

        oldStream.getVideoTracks().forEach(track => track.stop());

        peersRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender && newStream.getVideoTracks()[0]) {
            sender.replaceTrack(newStream.getVideoTracks()[0]);
          }
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newStream;
        }
        
        localStreamRef.current = newStream;
        setLocalStream(newStream);
      } else {
        setSelectedAudioDevice(deviceId);
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: selectedVideoDevice 
            ? { deviceId: { exact: selectedVideoDevice } }
            : { facingMode: "user" },
          audio: { deviceId: { exact: deviceId } }
        });

        newStream.getVideoTracks().forEach(track => (track.enabled = isCamOn));
        newStream.getAudioTracks().forEach(track => (track.enabled = isMicOn));

        oldStream.getAudioTracks().forEach(track => track.stop());

        peersRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
          if (sender && newStream.getAudioTracks()[0]) {
            sender.replaceTrack(newStream.getAudioTracks()[0]);
          }
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newStream;
        }
        
        localStreamRef.current = newStream;
        setLocalStream(newStream);
      }
      
      setShowDeviceMenu(null);
    } catch (error) {
      console.error(`Erreur changement ${type}:`, error);
    }
  }, [selectedVideoDevice, selectedAudioDevice, isCamOn, isMicOn]);

  const addRemoteStream = useCallback((id: string, stream: MediaStream) => {
    setRemoteStreams(prev => {
      const newMap = new Map(prev);
      newMap.set(id, stream);
      return newMap;
    });
  }, []);

  const removeRemoteStream = useCallback((id: string) => {
    remoteMediaRefs.current.delete(id);
    setRemoteStreams(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  const getMedia = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: selectedVideoDevice 
          ? { deviceId: { exact: selectedVideoDevice }, facingMode: "user" }
          : { facingMode: "user" },
        audio: selectedAudioDevice
          ? { deviceId: { exact: selectedAudioDevice } }
          : true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      stream.getAudioTracks().forEach(track => (track.enabled = initialMicOn));
      stream.getVideoTracks().forEach(track => (track.enabled = initialCamOn));

      setLocalStream(stream);
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (error) {
      console.error('Erreur accès média:', error);
      setStatus("Erreur: Accès caméra/micro refusé.");
      return null;
    }
  }, [initialMicOn, initialCamOn, selectedVideoDevice, selectedAudioDevice]);

  const createPeerConnection = useCallback((targetId: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection(iceConfigRef.current);

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('sending-ice-candidate', event.candidate.toJSON(), targetId);
      }
    };

    pc.ontrack = (event) => {
      if (event.streams[0]) {
        addRemoteStream(targetId, event.streams[0]);
      }
    };

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    peersRef.current.set(targetId, pc);
    return pc;
  }, [addRemoteStream]);

  useEffect(() => {
    let mounted = true;
    const roomId = meetingId || 'default-room';
    const streamPromise = getMedia();
    const socket = io(SERVER_URL, {
      transports: ['polling', 'websocket'],
      extraHeaders: {
        "ngrok-skip-browser-warning": "true"
      }
    }) as AppSocket;

    socketRef.current = socket;

    const initiateConnection = async (userId: string) => {
      const stream = localStreamRef.current || await streamPromise;
      if (!stream || !mounted) return;
      // Eviter les connexions p2p dupliquer
      if (peersRef.current.has(userId)) return;
      const pc = createPeerConnection(userId, stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('sending-offer', offer, userId);
    };

    socket.on('receive-chat-message', (content: string, _senderId: string) => {
      if (!mounted) return;
      setChatMessages(prev => [...prev, {
        content,
        senderName: 'Participant',
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        isOwn: false,
      }]);
    });

    socket.on('message-history', (messages: any[]) => {
      if (!mounted) return;
      setChatMessages(messages.map(m => ({
        content: m.content,
        senderName: 'Participant',
        timestamp: new Date(m.createdAt || Date.now()).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        isOwn: false,
      })));
    });

    socket.on('connect', () => {
      if (mounted) {
        console.log(`[CONNECT] Connected with id: ${socket.id}`);
        setMyId(socket.id || null);
        setStatus("Connecté. En attente de participants...");
        socket.emit('join-room', roomId);
        socket.emit('announce-name', currentUserName, roomId);
      }
    });

    socket.on('get-existing-users', async (existingUsers: string[]) => {
      if (!mounted) return;
      console.log(`[ROOM] Existing users in room:`, existingUsers);
      for (const userId of existingUsers) {
        await initiateConnection(userId);
      }
    });

    socket.on('user-joined', async (userId) => {
      if (!mounted) return;
      console.log(`[ROOM] User joined: ${userId} — waiting for their offer`);
      // Réannonce le nom au nouveau participant
      socket.emit('announce-name', currentUserName, roomId);
    });

    socket.on('participant-announced-name', (socketId: string, name: string) => {
      if (!mounted) return;
      setParticipantNames(prev => {
        const next = new Map(prev);
        next.set(socketId, name);
        return next;
      });
    });

    socket.on('receiving-offer', async (offer, fromId) => {
      if (!mounted) return;
      console.log(`Offer from: ${fromId}`);
      const stream = localStreamRef.current || await streamPromise;
      if (stream) {
        // Si une connexion existe déjà pour cet utilisateur, fermer d'abord
        if (peersRef.current.has(fromId)) {
          peersRef.current.get(fromId)?.close();
          peersRef.current.delete(fromId);
        }
        const pc = createPeerConnection(fromId, stream);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('sending-answer', answer, fromId);
      }
    });

    socket.on('receiving-answer', async (answer: RTCSessionDescriptionInit, fromId?: string) => {
      if (fromId) {
        const pc = peersRef.current.get(fromId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      }
    });

    socket.on('receiving-ice-candidate', async (candidate, fromId) => {
      const pc = peersRef.current.get(fromId);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socket.on('user-left', (userId: string) => {
      console.log(`User left: ${userId}`);
      if (peersRef.current.has(userId)) {
        peersRef.current.get(userId)?.close();
        peersRef.current.delete(userId);
        removeRemoteStream(userId);
      }
      setParticipantNames(prev => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
    });

    streamPromise.then(stream => {
      if (!mounted && stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    });

    return () => {
      mounted = false;
      socket.disconnect();
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [meetingId, getMedia, createPeerConnection, addRemoteStream, removeRemoteStream]);

  const toggleMic = () => {
    setIsMicOn(prev => !prev);
  };

  const toggleCam = () => {
    setIsCamOn(prev => !prev);
  };

  const sendChatMessage = () => {
    const content = chatInput.trim();
    if (!content || !socketRef.current) return;
    const roomId = meetingId || 'default-room';
    socketRef.current.emit('send-chat-message', content, roomId, myId || '');
    setChatMessages(prev => [...prev, {
      content,
      senderName: 'Moi',
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      isOwn: true,
    }]);
    setChatInput('');
  };

  const allStreams = [
    { id: 'me', stream: localStream, isLocal: true },
    ...Array.from(remoteStreams.entries()).map(([id, stream]) => ({ id, stream, isLocal: false }))
  ].filter(item => item.stream !== null) as { id: string; stream: MediaStream; isLocal: boolean }[];

  const visibleStreams = isFullScreen ? allStreams : allStreams.slice(0, 5);
  const hiddenCount = allStreams.length - visibleStreams.length;

  const fsCols = visibleStreams.length <= 1 ? 1 : visibleStreams.length <= 4 ? 2 : 3;

  const handleSaveEdit = async () => {
    setSaveError('');
    // Validate mandatory fields
    for (const f of MANDATORY_FIELDS) {
      if (!editForm[f]?.toString().trim()) {
        setSaveError(`Le champ "${MANDATORY_LABELS[f] || f}" est obligatoire.`);
        return;
      }
    }

    try {
      const { id, createdAt, updatedAt, submittedBy, filledAt, ...payload } = editForm;
      const recordId = myPatientRecordId;

      if (recordId) {
        const updatedRecord = await api.updatePatientRecord(recordId, payload);
        const updatedData = patientsData.map(p =>
          p.id === recordId ? { ...updatedRecord, submittedBy: p.submittedBy, filledAt: p.filledAt } : p
        );
        setPatientsData(updatedData);
        if (selectedPatient?.id === recordId) {
          setSelectedPatient({ ...updatedRecord, submittedBy: selectedPatient.submittedBy, filledAt: selectedPatient.filledAt });
        }
      }

      setStatus('✓ Dossier sauvegardé');
      setTimeout(() => setStatus('Connecté. En attente de participants...'), 3000);
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      setSaveError('Erreur de connexion à la base de données');
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
    if (MANDATORY_FIELDS.includes(fieldName)) return;
    const { [fieldName]: _, ...rest } = editForm as Record<string, any>;
    setEditForm(rest);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      {isEditModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="w-6 h-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Modifier le dossier
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {saveError && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-2 rounded-lg text-sm">{saveError}</div>
              )}

              {/* Mandatory fields */}
              <div>
                <h3 className="text-sm font-semibold text-teal-400 mb-3">Champs obligatoires</h3>
                {MANDATORY_FIELDS.map((key) => (
                  <div key={key} className="mb-3">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {MANDATORY_LABELS[key] || key} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={editForm[key] ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                      placeholder={MANDATORY_LABELS[key] || key}
                    />
                  </div>
                ))}
              </div>

              {/* Custom fields */}
              {Object.entries(editForm)
                .filter(([key]) => !MANDATORY_FIELDS.includes(key) && !METADATA_FIELDS.includes(key) && !['__v', 'submittedBy', 'filledAt'].includes(key))
                .map(([key, value]) => (
                <div key={key} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </label>
                    <input
                      type="text"
                      value={value ?? ''}
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
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-800 bg-slate-900/50">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay plein écran hors parent backdrop blur pour éviter la contrainte CSS */}
      {isFullScreen && (
        <div className="fixed inset-0 z-50 bg-slate-950 p-4">
          <button
            onClick={() => setIsFullScreen(false)}
            className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full"
          >
            ✕
          </button>
          <div
            className="w-full h-full gap-2 overflow-hidden grid content-center"
            style={{ gridTemplateColumns: `repeat(${fsCols}, 1fr)` }}
          >
            {visibleStreams.map((item) => (
              <div key={item.id} className="relative bg-black rounded-xl overflow-hidden shadow-lg border border-slate-800 aspect-video w-full">
                {(!isCamOn && item.isLocal) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10">
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-2">
                      <span className="text-xl">📷</span>
                    </div>
                  </div>
                )}
                <video
                  ref={(el) => {
                    if (el && item.stream) {
                      el.srcObject = item.stream;
                      if (!item.isLocal) {
                        remoteMediaRefs.current.set(item.id, el);
                        el.volume = volume / 100;
                        if (selectedAudioOutputDevice && typeof (el as any).setSinkId === 'function') {
                          (el as any).setSinkId(selectedAudioOutputDevice).catch(console.error);
                        }
                      }
                    }
                  }}
                  autoPlay
                  muted={item.isLocal || !isSpeakerOn}
                  playsInline
                  className={`w-full h-full object-cover ${item.isLocal ? 'scale-x-[-1]' : ''} ${(!isCamOn && item.isLocal) ? 'hidden' : ''}`}
                />
                <div className="absolute bottom-2 left-2 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-medium z-20">
                  {item.isLocal
                    ? (currentUserName || 'Moi')
                    : (participantNames.get(item.id) || `Participant ${item.id.substring(0, 4)}`)}
                </div>
                {item.isLocal && (
                  <div className="absolute top-2 right-2 flex gap-1 z-20">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isMicOn ? 'bg-teal-500' : 'bg-red-500'}`}>
                      {isMicOn ? '🎤' : '🔇'}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="text-white text-sm">
            Nexus Care | {allStreams.length} participant(s)
          </div>
          <div className="text-white/80 text-sm hidden md:block">{status}</div>
          <button onClick={() => setIsFullScreen(!isFullScreen)} className={`px-4 py-2 rounded-lg transition-all text-sm ${isFullScreen ? 'bg-teal-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
            {isFullScreen ? 'Quitter' : '🖥️ Plein écran'}
          </button>
        </div>

        {!isFullScreen && (
          <div className="relative p-4 flex justify-center">
            <div className="flex flex-wrap justify-center content-center gap-4 w-full max-w-7xl mx-auto">
              {visibleStreams.map((item) => (
                <div key={item.id} className="relative bg-black rounded-xl overflow-hidden shadow-lg border border-slate-800 w-full max-w-[20rem] sm:w-80 aspect-video shrink-0">
                  {(!isCamOn && item.isLocal) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10">
                      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-2">
                        <span className="text-xl">📷</span>
                      </div>
                    </div>
                  )}
                  <video
                    ref={(el) => {
                      if (el && item.stream) {
                        el.srcObject = item.stream;
                        if (!item.isLocal) {
                          remoteMediaRefs.current.set(item.id, el);
                          el.volume = volume / 100;
                          if (selectedAudioOutputDevice && typeof (el as any).setSinkId === 'function') {
                            (el as any).setSinkId(selectedAudioOutputDevice).catch(console.error);
                          }
                        }
                      }
                    }}
                    autoPlay
                    muted={item.isLocal || !isSpeakerOn}
                    playsInline
                    className={`w-full h-full object-cover ${item.isLocal ? 'scale-x-[-1]' : ''} ${(!isCamOn && item.isLocal) ? 'hidden' : ''}`}
                  />
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-medium z-20">
                    {item.isLocal
                      ? (currentUserName || 'Moi')
                      : (participantNames.get(item.id) || `Participant ${item.id.substring(0, 4)}`)}
                  </div>
                  {item.isLocal && (
                    <div className="absolute top-2 right-2 flex gap-1 z-20">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isMicOn ? 'bg-teal-500' : 'bg-red-500'}`}>
                        {isMicOn ? '🎤' : '🔇'}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {hiddenCount > 0 && (
                <div
                  onClick={() => setIsFullScreen(true)}
                  className="relative bg-slate-800 rounded-xl overflow-hidden shadow-lg border border-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-700 transition w-full max-w-[20rem] sm:w-80 aspect-video shrink-0"
                >
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white mb-2">+{hiddenCount}</div>
                    <div className="text-slate-400 text-sm">autres participants</div>
                    <div className="text-teal-400 text-xs mt-2 uppercase tracking-wide font-bold">Voir tout</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!isFullScreen && (
          <div className="flex justify-center items-center px-4 pb-3">
            <div className="flex gap-4">
              <div className="relative">
                <button
                  onClick={toggleMic}
                  className={`p-4 rounded-full transition-all flex items-center justify-center shadow-lg transform hover:scale-105 ${isMicOn ? 'bg-teal-500 hover:bg-teal-600' : 'bg-red-500 hover:bg-red-600'}`}
                >
                  <MicIcon isEnabled={isMicOn} />
                </button>
                <button
                  onClick={() => setShowDeviceMenu(showDeviceMenu === 'audio' ? null : 'audio')}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center text-white text-xs shadow-lg"
                  title="Changer de microphone"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
                {showDeviceMenu === 'audio' && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-2 min-w-[250px] z-50">
                    <div className="text-xs text-slate-400 font-semibold mb-2 px-2">Microphone</div>
                    {audioDevices.map(device => (
                      <button
                        key={device.deviceId}
                        onClick={() => changeDevice('audio', device.deviceId)}
                        className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-slate-700 transition-colors ${
                          selectedAudioDevice === device.deviceId ? 'bg-teal-500/20 text-teal-300' : 'text-white'
                        }`}
                      >
                        {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="relative">
                <button
                  onClick={toggleCam}
                  className={`p-4 rounded-full transition-all flex items-center justify-center shadow-lg transform hover:scale-105 ${isCamOn ? 'bg-teal-500 hover:bg-teal-600' : 'bg-red-500 hover:bg-red-600'}`}
                >
                  <VideoIcon isEnabled={isCamOn} />
                </button>
                <button
                  onClick={() => setShowDeviceMenu(showDeviceMenu === 'video' ? null : 'video')}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center text-white text-xs shadow-lg"
                  title="Changer de caméra"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
                {showDeviceMenu === 'video' && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-2 min-w-[250px] z-50">
                    <div className="text-xs text-slate-400 font-semibold mb-2 px-2">Caméra</div>
                    {videoDevices.map(device => (
                      <button
                        key={device.deviceId}
                        onClick={() => changeDevice('video', device.deviceId)}
                        className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-slate-700 transition-colors ${
                          selectedVideoDevice === device.deviceId ? 'bg-teal-500/20 text-teal-300' : 'text-white'
                        }`}
                      >
                        {device.label || `Caméra ${device.deviceId.slice(0, 5)}...`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Actions button */}
              <div className="relative">
                <button
                  onClick={() => setShowActionsMenu(!showActionsMenu)}
                  className="p-4 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg transform hover:scale-105 transition-all"
                  title="Actions"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </button>
                {showActionsMenu && (
                  <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 p-2 min-w-[200px] z-50">
                    <div className="text-xs text-slate-400 font-semibold mb-1.5 px-3 pt-1">Actions</div>
                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        setShowReportModal(true);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-white hover:bg-slate-700 transition-colors flex items-center gap-3"
                    >
                      <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Générer un rapport
                    </button>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setIsSpeakerOn(prev => !prev)}
                  className={`p-4 rounded-full transition-all flex items-center justify-center shadow-lg transform hover:scale-105 ${isSpeakerOn ? 'bg-teal-500 hover:bg-teal-600' : 'bg-red-500 hover:bg-red-600'}`}
                  title={isSpeakerOn ? 'Couper le son' : 'Activer le son'}
                >
                  <SpeakerIcon isEnabled={isSpeakerOn} />
                </button>
                <button
                  onClick={() => setShowDeviceMenu(showDeviceMenu === 'speaker' ? null : 'speaker')}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center text-white text-xs shadow-lg"
                  title="Paramètres audio de sortie"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
                {showDeviceMenu === 'speaker' && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-2 min-w-[280px] max-h-[60vh] flex flex-col z-50">
                    <div className="text-xs text-slate-400 font-semibold mb-2 px-2 shrink-0">Sortie audio</div>
                    <div className="overflow-y-auto flex-1 max-h-[200px]">
                    {audioOutputDevices.map(device => (
                      <button
                        key={device.deviceId}
                        onClick={() => {
                          setSelectedAudioOutputDevice(device.deviceId);
                          setShowDeviceMenu(null);
                        }}
                        className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-slate-700 transition-colors ${
                          selectedAudioOutputDevice === device.deviceId ? 'bg-teal-500/20 text-teal-300' : 'text-white'
                        }`}
                      >
                        {device.label || `Sortie ${device.deviceId.slice(0, 5)}...`}
                      </button>
                    ))}
                    {audioOutputDevices.length === 0 && (
                      <div className="px-3 py-2 text-slate-500 text-sm">Aucun périphérique détecté</div>
                    )}
                    </div>
                    <div className="border-t border-slate-700 mt-2 pt-3 px-2 shrink-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400 font-semibold">Volume</span>
                        <span className="text-xs text-teal-300 font-mono">{volume}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        </svg>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={volume}
                          onChange={(e) => setVolume(Number(e.target.value))}
                          className="flex-1 h-1.5 bg-slate-600 rounded-full appearance-none cursor-pointer accent-teal-500"
                        />
                        <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={onLeave}
                className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg transform hover:scale-105"
                title="Quitter"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {!isFullScreen && (
        <div className="flex-1 flex overflow-hidden relative">
          <div className={`${activeTab === 'participants' ? 'absolute inset-0 z-40 bg-slate-950 w-full flex' : 'hidden'} md:flex md:static md:w-64 bg-slate-900/50 backdrop-blur-sm border-r border-slate-800 flex-col`}>
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-slate-300 font-semibold uppercase text-xs tracking-wider">Participants</h3>
                <button
                  onClick={() => {
                    setSaveError('');
                    // Find MY record among patientsData
                    const myRecord = patientsData.find(
                      (p: any) => p.submittedBy?.id === currentUser?.id
                    );
                    const base: Record<string, any> = myRecord ? { ...myRecord } : {};
                    for (const f of MANDATORY_FIELDS) {
                      if (!(f in base)) base[f] = '';
                    }
                    setMyPatientRecordId(myRecord?.id || null);
                    setEditForm(base);
                    setIsEditModalOpen(true);
                  }}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded-lg text-xs transition-all flex items-center gap-1"
                  title="Modifier mon dossier"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Mon dossier</span>
                </button>
              </div>
              <div className="space-y-2">
                {patientsData.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPatient(p);
                      if (window.innerWidth < 768) setActiveTab('info');
                    }}
                    className={`w-full px-4 py-3 border border-transparent text-left transition-all text-sm rounded-lg ${selectedPatient?.id === p.id
                      ? 'bg-teal-500/20 border-teal-500/50 text-teal-200'
                      : 'bg-slate-800/50 hover:bg-teal-500/20 hover:border-teal-500/50 text-slate-200'
                      }`}
                  >
                    {p.profession || p.firstName || 'Patient'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={`${activeTab === 'info' ? 'flex' : 'hidden'} md:flex flex-1 bg-slate-950 overflow-y-auto`}>
            <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl w-full max-w-6xl mx-auto h-fit m-6">
              <div className="p-6">
                <h2 className="text-teal-400 text-2xl font-bold mb-4 flex items-center gap-2">
                  <span>📋</span> Dossier Médical
                </h2>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-min">
                  {selectedPatient && Object.entries(selectedPatient)
                    .filter(([key]) => !['id', '__v', 'createdAt', 'updatedAt', 'submittedBy', 'filledAt'].includes(key))
                    .map(([key, value]) => (
                    <div key={key} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 h-fit">
                      <div className="text-white/60 text-sm mb-1">
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </div>
                      <div className="text-white font-semibold text-base wrap-break-words overflow-wrap-anywhere">
                        {String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={`${activeTab === 'chat' ? 'absolute inset-0 z-40 bg-slate-950 w-full flex' : 'hidden'} lg:flex lg:static lg:w-80 bg-slate-900/50 backdrop-blur-sm border-l border-slate-800 flex-col`}>
            <div className="p-4 border-b border-slate-800 bg-slate-900/80">
              <h3 className="text-white font-semibold">Messages</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                  <div className="text-white/60 text-xs mb-1">Système</div>
                  <div className="text-white text-sm">Bienvenue dans la réunion.</div>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.isOwn ? 'items-end' : 'items-start'}`}>
                  <span className="text-white/50 text-xs mb-1">{msg.isOwn ? 'Vous' : msg.senderName} · {msg.timestamp}</span>
                  <div className={`px-3 py-2 rounded-xl text-sm max-w-[85%] ${msg.isOwn ? 'bg-teal-600 text-white' : 'bg-slate-700 text-white'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="p-4 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendChatMessage(); }}
                placeholder="Message..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
              />
              <button
                onClick={sendChatMessage}
                className="p-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>

          <div className="lg:hidden absolute bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-around p-2 z-50 md:justify-end md:gap-4 md:px-6">
            <button
              onClick={() => setActiveTab('participants')}
              className={`p-2 rounded-lg flex flex-col items-center md:hidden ${activeTab === 'participants' ? 'text-teal-400' : 'text-slate-400'}`}
            >
              <span className="text-xl">👥</span>
              <span className="text-[10px]">Participants</span>
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`p-2 rounded-lg flex flex-col items-center md:hidden ${activeTab === 'info' ? 'text-teal-400' : 'text-slate-400'}`}
            >
              <span className="text-xl">📋</span>
              <span className="text-[10px]">Info</span>
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`p-2 rounded-lg flex flex-col items-center ${activeTab === 'chat' ? 'text-teal-400' : 'text-slate-400'}`}
            >
              <span className="text-xl">💬</span>
              <span className="text-[10px]">Chat</span>
            </button>
          </div>
        </div>
      )}

      {/* Report Generator Modal */}
      <ReportGeneratorModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
      />
    </div>
  );
};

export default VideoCall;