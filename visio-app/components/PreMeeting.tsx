import React, { useEffect, useRef, useState } from 'react';

interface PreMeetingProps {
    onJoin: (isMicOn: boolean, isCamOn: boolean, videoDeviceId: string, audioDeviceId: string) => void;
    onCancel: () => void;
}

const PreMeeting: React.FC<PreMeetingProps> = ({ onJoin, onCancel }) => {
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCamOn, setIsCamOn] = useState(true);
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>("");
    const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>("");

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        const getDevices = async () => {
            try {
                await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                const devices = await navigator.mediaDevices.enumerateDevices();

                const videoDevs = devices.filter(device => device.kind === 'videoinput');
                const audioDevs = devices.filter(device => device.kind === 'audioinput');

                setVideoDevices(videoDevs);
                setAudioDevices(audioDevs);

                if (videoDevs.length > 0) setSelectedVideoDevice(videoDevs[0].deviceId);
                if (audioDevs.length > 0) setSelectedAudioDevice(audioDevs[0].deviceId);

            } catch (err) {
                console.error("Error enumerating devices:", err);
            }
        };
        getDevices();
    }, []);

    useEffect(() => {
        let mounted = true;

        const startCamera = async () => {
            if (!selectedVideoDevice || !selectedAudioDevice) return;

            try {
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                }

                let stream: MediaStream;
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { deviceId: { exact: selectedVideoDevice } },
                        audio: { deviceId: { exact: selectedAudioDevice } }
                    });
                } catch (err) {
                    console.warn("Retrying with fallback constraints...");
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: "user" },
                        audio: true
                    });
                }

                if (mounted) {
                    streamRef.current = stream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                    if (!isMicOn) stream.getAudioTracks().forEach(t => t.enabled = false);
                    if (!isCamOn) stream.getVideoTracks().forEach(t => t.enabled = false);
                } else {
                    stream.getTracks().forEach(track => track.stop());
                }
            } catch (err) {
                console.error("Error accessing media devices", err);
            }
        };

        startCamera();

        return () => {
            mounted = false;
        };
    }, [selectedVideoDevice, selectedAudioDevice]);
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const toggleMic = () => {
        if (streamRef.current) {
            const audioTracks = streamRef.current.getAudioTracks();
            audioTracks.forEach(track => (track.enabled = !track.enabled));
            setIsMicOn(!isMicOn);
        }
    };

    const toggleCam = () => {
        if (streamRef.current) {
            const videoTracks = streamRef.current.getVideoTracks();
            videoTracks.forEach(track => (track.enabled = !track.enabled));
            setIsCamOn(!isCamOn);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-slate-100">
            <div className="w-full max-w-5xl flex flex-col md:flex-row gap-8 items-stretch bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl">

                {/* Video Preview */}
                <div className="flex-1 flex flex-col gap-4">
                    <div className="aspect-video bg-slate-900 rounded-2xl overflow-hidden relative shadow-lg border border-slate-700/50 group flex items-center justify-center">
                        {!isCamOn && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10">
                                <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center animate-pulse mb-4">
                                    <span className="text-4xl">📷</span>
                                </div>
                                <p className="text-slate-400 font-medium">Caméra désactivée</p>
                            </div>
                        )}
                        {isCamOn && (
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                className="w-full h-full object-cover transform scale-x-[-1]"
                            />
                        )}

                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 z-20">
                            <button
                                onClick={toggleMic}
                                className={`p-4 rounded-full backdrop-blur-md border border-white/10 transition-all transform hover:scale-105 ${isMicOn ? 'bg-teal-500/80 hover:bg-teal-500 text-white' : 'bg-red-500/80 hover:bg-red-500 text-white'
                                    }`}
                            >
                                {isMicOn ? (
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                ) : (
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                                )}
                            </button>
                            <button
                                onClick={toggleCam}
                                className={`p-4 rounded-full backdrop-blur-md border border-white/10 transition-all transform hover:scale-105 ${isCamOn ? 'bg-teal-500/80 hover:bg-teal-500 text-white' : 'bg-red-500/80 hover:bg-red-500 text-white'
                                    }`}
                            >
                                {isCamOn ? (
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                ) : (
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Device Select */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Caméra</label>
                            <select
                                value={selectedVideoDevice}
                                onChange={(e) => setSelectedVideoDevice(e.target.value)}
                                className="w-full bg-slate-900 text-white text-sm rounded-lg border border-slate-700 p-2.5 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                            >
                                {videoDevices.map(device => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Microphone</label>
                            <select
                                value={selectedAudioDevice}
                                onChange={(e) => setSelectedAudioDevice(e.target.value)}
                                className="w-full bg-slate-900 text-white text-sm rounded-lg border border-slate-700 p-2.5 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                            >
                                {audioDevices.map(device => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Info and Actions */}
                <div className="w-full md:w-80 flex flex-col justify-center items-center text-center space-y-8 p-4 border-l border-slate-800/50 pl-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Prêt à rejoindre ?</h1>
                        <p className="text-slate-400">Vérifiez votre équipement avant d'entrer</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full">
                        <div className={`p-4 rounded-xl border ${isMicOn ? 'bg-teal-500/10 border-teal-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                            <div className="text-sm font-medium mb-1">{isMicOn ? 'Microphone' : 'Microphone'}</div>
                            <div className={`text-xs ${isMicOn ? 'text-teal-400' : 'text-red-400'}`}>{isMicOn ? 'Actif' : 'Désactivé'}</div>
                        </div>
                        <div className={`p-4 rounded-xl border ${isCamOn ? 'bg-teal-500/10 border-teal-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                            <div className="text-sm font-medium mb-1">{isCamOn ? 'Caméra' : 'Caméra'}</div>
                            <div className={`text-xs ${isCamOn ? 'text-teal-400' : 'text-red-400'}`}>{isCamOn ? 'Active' : 'Désactivée'}</div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 w-full">
                        <button
                            onClick={() => onJoin(isMicOn, isCamOn, selectedVideoDevice, selectedAudioDevice)}
                            className="w-full py-4 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-lg shadow-teal-500/20 transition-all transform hover:-translate-y-1"
                        >
                            Rejoindre la réunion
                        </button>
                        <button
                            onClick={onCancel}
                            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl border border-slate-700 transition-all"
                        >
                            Retour au tableau de bord
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PreMeeting;
