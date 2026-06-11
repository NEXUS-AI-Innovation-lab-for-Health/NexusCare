import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Video,
    VideoOff,
    Mic,
    MicOff,
    Settings,
    ChevronLeft,
    CheckCircle,
    AlertCircle,
} from 'lucide-react';

const PreMeeting: React.FC = () => {
    const navigate = useNavigate();
    const { meetingId } = useParams<{ meetingId: string }>();
    const [mic, setMic] = useState(true);
    const [cam, setCam] = useState(true);
    const [videoDeviceId, setVideoDeviceId] = useState('');
    const [audioDeviceId, setAudioDeviceId] = useState('');
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const streamRef = React.useRef<MediaStream | null>(null);

    React.useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
            navigate('/login');
        }
    }, [navigate]);

    React.useEffect(() => {
        const getDevices = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }

                const devices = await navigator.mediaDevices.enumerateDevices();
                setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
                setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
            } catch (error) {
                console.error('Erreur accès média:', error);
            }
        };
        getDevices();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    React.useEffect(() => {
        if (streamRef.current) {
            streamRef.current.getVideoTracks().forEach(track => track.enabled = cam);
            streamRef.current.getAudioTracks().forEach(track => track.enabled = mic);
        }
    }, [mic, cam]);

    const handleJoin = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        navigate(`/meeting/${meetingId}/call`, {
            state: { mic, cam, videoDeviceId, audioDeviceId }
        });
    };

    const handleCancel = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        navigate('/meetings');
    };

    return (
        <div className="min-h-screen bg-[#080D1A] text-slate-50 flex flex-col">
            {/* Decorative radial glow */}
            <div
                className="pointer-events-none fixed inset-0 z-0"
                style={{
                    background:
                        'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(6,182,212,0.13) 0%, transparent 70%)',
                }}
            />

            {/* Page content */}
            <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-8 flex flex-col flex-1">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={handleCancel}
                        aria-label="Retour"
                        className="p-2.5 rounded-xl backdrop-blur-xl bg-white/4 border border-white/8 text-slate-400 hover:text-slate-50 hover:bg-white/8 transition-all duration-200 cursor-pointer"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-semibold text-slate-50">Préparer la réunion</h1>
                        {meetingId && (
                            <span className="text-xs font-medium px-3 py-1 rounded-full bg-cyan-600/20 text-cyan-400 border border-cyan-500/20">
                                #{meetingId}
                            </span>
                        )}
                    </div>
                </div>

                {/* Main 2-column grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">

                    {/* Left: Video preview card */}
                    <div className="backdrop-blur-xl bg-white/4 border border-white/8 rounded-2xl p-5 flex flex-col gap-4">

                        {/* Video element — 16:9 aspect */}
                        <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`w-full h-full object-cover${!cam ? ' hidden' : ''}`}
                            />
                            {!cam && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/80">
                                    <div className="w-16 h-16 rounded-full bg-white/6 border border-white/8 flex items-center justify-center">
                                        <VideoOff className="w-7 h-7 text-slate-400" />
                                    </div>
                                    <span className="text-sm text-slate-400 font-medium">Caméra désactivée</span>
                                </div>
                            )}
                        </div>

                        {/* Toggle controls row */}
                        <div className="flex items-center justify-center gap-3">
                            <button
                                onClick={() => setCam(!cam)}
                                aria-label={cam ? 'Désactiver la caméra' : 'Activer la caméra'}
                                className={`p-3 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-2 text-sm font-medium text-white ${cam ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                            >
                                {cam ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                                <span>{cam ? 'Caméra' : 'Caméra off'}</span>
                            </button>
                            <button
                                onClick={() => setMic(!mic)}
                                aria-label={mic ? 'Désactiver le microphone' : 'Activer le microphone'}
                                className={`p-3 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-2 text-sm font-medium text-white ${mic ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                            >
                                {mic ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                                <span>{mic ? 'Micro' : 'Micro off'}</span>
                            </button>
                        </div>

                        {/* Status indicator badges */}
                        <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${cam ? 'bg-cyan-600/10 border-cyan-500/20 text-cyan-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                {cam
                                    ? <CheckCircle className="w-3.5 h-3.5" />
                                    : <AlertCircle className="w-3.5 h-3.5" />
                                }
                                {cam ? 'Caméra active' : 'Caméra désactivée'}
                            </div>
                            <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${mic ? 'bg-cyan-600/10 border-cyan-500/20 text-cyan-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                {mic
                                    ? <CheckCircle className="w-3.5 h-3.5" />
                                    : <AlertCircle className="w-3.5 h-3.5" />
                                }
                                {mic ? 'Micro actif' : 'Micro désactivé'}
                            </div>
                        </div>
                    </div>

                    {/* Right: Settings card */}
                    <div className="backdrop-blur-xl bg-white/4 border border-white/8 rounded-2xl p-5 flex flex-col gap-6">

                        {/* Section title */}
                        <div className="flex items-center gap-2.5">
                            <Settings className="w-5 h-5 text-cyan-400" />
                            <h2 className="text-base font-semibold text-slate-50">Paramètres</h2>
                        </div>

                        {/* Camera select */}
                        <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-400">
                                <Video className="w-4 h-4" />
                                Caméra
                            </label>
                            <select
                                value={videoDeviceId}
                                onChange={(e) => setVideoDeviceId(e.target.value)}
                                className="bg-white/6 border border-white/12 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 w-full cursor-pointer"
                            >
                                <option value="">Par défaut</option>
                                {videoDevices.map((device) => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Caméra ${device.deviceId.slice(0, 8)}`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Microphone select */}
                        <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-400">
                                <Mic className="w-4 h-4" />
                                Microphone
                            </label>
                            <select
                                value={audioDeviceId}
                                onChange={(e) => setAudioDeviceId(e.target.value)}
                                className="bg-white/6 border border-white/12 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 w-full cursor-pointer"
                            >
                                <option value="">Par défaut</option>
                                {audioDevices.map((device) => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Micro ${device.deviceId.slice(0, 8)}`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Device test status */}
                        <div className="backdrop-blur-xl bg-white/3 border border-white/6 rounded-xl p-4 flex flex-col gap-2.5">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">État des périphériques</p>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-300 flex items-center gap-2">
                                    <Video className="w-4 h-4 text-slate-500" />
                                    Caméra
                                </span>
                                <span className={`text-xs font-medium ${cam ? 'text-cyan-400' : 'text-red-400'}`}>
                                    {cam ? 'Activée' : 'Désactivée'}
                                </span>
                            </div>
                            <div className="h-px bg-white/6" />
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-300 flex items-center gap-2">
                                    <Mic className="w-4 h-4 text-slate-500" />
                                    Microphone
                                </span>
                                <span className={`text-xs font-medium ${mic ? 'text-cyan-400' : 'text-red-400'}`}>
                                    {mic ? 'Activé' : 'Désactivé'}
                                </span>
                            </div>
                        </div>

                        {/* Spacer to push join button to bottom */}
                        <div className="flex-1" />

                        {/* Join button */}
                        <button
                            onClick={handleJoin}
                            className="bg-green-600 hover:bg-green-500 text-white font-bold px-8 py-3 rounded-xl transition-all duration-200 cursor-pointer text-lg w-full"
                        >
                            Rejoindre la réunion
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PreMeeting;
