import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

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
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                <h2 className="text-2xl font-bold text-center mb-6">Prêt à rejoindre ?</h2>

                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-6">
                    <div className="aspect-video bg-slate-800 relative">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`w-full h-full object-cover ${!cam ? 'hidden' : ''}`}
                        />
                        {!cam && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center">
                                    <svg className="w-12 h-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 flex items-center justify-center gap-4">
                        <button
                            onClick={() => setMic(!mic)}
                            className={`p-3 rounded-full transition-colors ${mic ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-500 hover:bg-red-600'}`}
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {mic ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                ) : (
                                    <>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                    </>
                                )}
                            </svg>
                        </button>

                        <button
                            onClick={() => setCam(!cam)}
                            className={`p-3 rounded-full transition-colors ${cam ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-500 hover:bg-red-600'}`}
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {cam ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                )}
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Caméra</label>
                        <select
                            value={videoDeviceId}
                            onChange={(e) => setVideoDeviceId(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500"
                        >
                            <option value="">Par défaut</option>
                            {videoDevices.map((device) => (
                                <option key={device.deviceId} value={device.deviceId}>
                                    {device.label || `Caméra ${device.deviceId.slice(0, 8)}`}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Microphone</label>
                        <select
                            value={audioDeviceId}
                            onChange={(e) => setAudioDeviceId(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500"
                        >
                            <option value="">Par défaut</option>
                            {audioDevices.map((device) => (
                                <option key={device.deviceId} value={device.deviceId}>
                                    {device.label || `Micro ${device.deviceId.slice(0, 8)}`}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={handleCancel}
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleJoin}
                        className="flex-1 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-medium transition-colors"
                    >
                        Rejoindre la réunion
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PreMeeting;
