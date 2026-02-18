import React, { useState, useRef, useCallback } from 'react';

const REPORT_API_URL =
    import.meta.env.VITE_REPORT_API_URL ||
    `${window.location.protocol}//${window.location.hostname}:8000`;

type Step = 'idle' | 'recording' | 'recorded' | 'transcribing' | 'generating' | 'done' | 'error';

interface ReportGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ReportGeneratorModal: React.FC<ReportGeneratorModalProps> = ({ isOpen, onClose }) => {
    const [step, setStep] = useState<Step>('idle');
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [transcription, setTranscription] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [meetingType, setMeetingType] = useState('medical');
    const [mode, setMode] = useState<'audio' | 'text'>('audio');
    const [manualText, setManualText] = useState('');
    const [recordingTime, setRecordingTime] = useState(0);

    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const chunks = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Enregistrement

    const startRecording = useCallback(async () => {
        try {
            setErrorMsg('');
            setPdfUrl(null);
            setTranscription('');
            setRecordingTime(0);

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm';

            const recorder = new MediaRecorder(stream, { mimeType });
            chunks.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.current.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunks.current, { type: mimeType });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
                setStep('recorded');
                stream.getTracks().forEach((t) => t.stop());
            };

            recorder.start(1000);
            mediaRecorder.current = recorder;
            setStep('recording');

            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        } catch (err: any) {
            setErrorMsg(`Impossible d'accéder au microphone : ${err.message}`);
            setStep('error');
        }
    }, []);

    const stopRecording = useCallback(() => {
        mediaRecorder.current?.stop();
        if (timerRef.current) clearInterval(timerRef.current);
    }, []);

    const resetRecording = useCallback(() => {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioBlob(null);
        setAudioUrl(null);
        setTranscription('');
        setPdfUrl(null);
        setErrorMsg('');
        setStep('idle');
        setRecordingTime(0);
    }, [audioUrl]);

    // Appels API

    const transcribeOnly = useCallback(async () => {
        if (!audioBlob) return;
        setStep('transcribing');
        setErrorMsg('');
        try {
            const form = new FormData();
            form.append('audio', audioBlob, 'recording.webm');
            form.append('whisper_model', 'small');
            form.append('language', 'fr');

            const res = await fetch(`${REPORT_API_URL}/transcribe`, { method: 'POST', body: form });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: res.statusText }));
                throw new Error(err.detail || 'Transcription échouée');
            }
            const data = await res.json();
            setTranscription(data.transcription);
            setStep('recorded');
        } catch (err: any) {
            setErrorMsg(err.message);
            setStep('error');
        }
    }, [audioBlob]);

    const generateReport = useCallback(async () => {
        setStep('generating');
        setErrorMsg('');
        try {
            const textToSend = mode === 'text' ? manualText : transcription;
            if (!textToSend?.trim()) throw new Error('Aucun texte à envoyer');

            const form = new FormData();
            form.append('text', textToSend);
            form.append('meeting_type', meetingType);

            const res = await fetch(`${REPORT_API_URL}/generate/text`, { method: 'POST', body: form });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: res.statusText }));
                throw new Error(err.detail || 'Génération échouée');
            }

            const blob = await res.blob();
            setPdfUrl(URL.createObjectURL(blob));
            setStep('done');
        } catch (err: any) {
            setErrorMsg(err.message);
            setStep('error');
        }
    }, [manualText, transcription, meetingType, mode]);

    const fmtTime = (s: number) =>
        `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    const isProcessing = step === 'transcribing' || step === 'generating';

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Génération de Rapport
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Mode selector */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => { setMode('audio'); resetRecording(); }}
                            className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                                mode === 'audio'
                                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                            }`}
                        >
                            🎤 Audio
                        </button>
                        <button
                            onClick={() => { setMode('text'); resetRecording(); }}
                            className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                                mode === 'text'
                                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                            }`}
                        >
                            📝 Texte
                        </button>
                    </div>

                    {/* Meeting type */}
                    <select
                        value={meetingType}
                        onChange={(e) => setMeetingType(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:border-rose-500 focus:outline-none"
                    >
                        <option value="medical">Réunion Médicale</option>
                        <option value="general">Réunion Générale</option>
                        <option value="business">Réunion Business</option>
                        <option value="technical">Réunion Technique</option>
                    </select>

                    {/* ── Audio mode ── */}
                    {mode === 'audio' && (
                        <div className="space-y-4">
                            {/* Idle */}
                            {step === 'idle' && (
                                <div className="flex flex-col items-center gap-4 py-4">
                                    <button
                                        onClick={startRecording}
                                        className="w-20 h-20 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all hover:scale-105"
                                    >
                                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                                        </svg>
                                    </button>
                                    <p className="text-slate-500 text-sm">Cliquez pour enregistrer</p>
                                </div>
                            )}

                            {/* Recording */}
                            {step === 'recording' && (
                                <div className="flex flex-col items-center gap-4 py-4">
                                    <div className="relative">
                                        <div className="w-20 h-20 rounded-full bg-rose-500 animate-pulse" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-white font-mono font-bold">{fmtTime(recordingTime)}</span>
                                        </div>
                                    </div>
                                    <p className="text-rose-400 text-sm font-medium animate-pulse">Enregistrement…</p>
                                    <button
                                        onClick={stopRecording}
                                        className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-600 text-sm flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                            <rect x="6" y="6" width="12" height="12" rx="2" />
                                        </svg>
                                        Arrêter
                                    </button>
                                </div>
                            )}

                            {/* Recorded */}
                            {(step === 'recorded' || step === 'done') && audioUrl && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-teal-400 text-sm font-medium flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Prêt ({fmtTime(recordingTime)})
                                        </span>
                                        <button onClick={resetRecording} className="text-slate-400 hover:text-white text-xs underline">
                                            Recommencer
                                        </button>
                                    </div>

                                    <audio controls src={audioUrl} className="w-full rounded-lg" />

                                    {/* Editable transcription */}
                                    {transcription && (
                                        <div className="bg-slate-800 rounded-xl p-3">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <p className="text-xs text-slate-500 font-medium uppercase">Transcription (modifiable)</p>
                                                <span className="text-xs text-slate-600">{transcription.length} car.</span>
                                            </div>
                                            <textarea
                                                rows={5}
                                                value={transcription}
                                                onChange={(e) => setTranscription(e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-rose-500 focus:outline-none resize-y"
                                            />
                                            <p className="text-xs text-slate-600 mt-1">Corrigez les erreurs avant de générer le rapport</p>
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        {!transcription && (
                                            <button
                                                onClick={transcribeOnly}
                                                disabled={isProcessing}
                                                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-sm font-medium disabled:opacity-50"
                                            >
                                                1. Transcrire
                                            </button>
                                        )}
                                        <button
                                            onClick={generateReport}
                                            disabled={isProcessing || !transcription}
                                            className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium shadow-lg shadow-rose-500/20 disabled:opacity-50"
                                        >
                                            {transcription ? '2. Générer PDF' : 'Générer PDF'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Processing */}
                            {(step === 'transcribing' || step === 'generating') && (
                                <div className="flex flex-col items-center gap-3 py-6">
                                    <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-slate-300 text-sm font-medium">
                                        {step === 'transcribing' ? 'Transcription (Whisper)…' : 'Génération (Gemini + PDF)…'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Text mode ── */}
                    {mode === 'text' && (
                        <div className="space-y-3">
                            <textarea
                                rows={8}
                                value={manualText}
                                onChange={(e) => setManualText(e.target.value)}
                                placeholder="Saisissez le texte de la réunion…"
                                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-600 text-sm focus:border-rose-500 focus:outline-none resize-y"
                            />
                            <button
                                onClick={generateReport}
                                disabled={!manualText.trim() || isProcessing}
                                className="w-full py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium shadow-lg shadow-rose-500/20 disabled:opacity-50"
                            >
                                {isProcessing ? 'Génération…' : 'Générer le rapport PDF'}
                            </button>
                        </div>
                    )}

                    {/* Error */}
                    {(step === 'error' || errorMsg) && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                            <p className="text-red-400 text-sm font-medium flex items-center gap-2">
                                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {errorMsg}
                            </p>
                            <button onClick={resetRecording} className="mt-2 text-xs text-red-300 underline hover:text-white">
                                Réessayer
                            </button>
                        </div>
                    )}

                    {/* Download */}
                    {step === 'done' && pdfUrl && (
                        <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-6 flex flex-col items-center gap-3">
                            <svg className="w-10 h-10 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-teal-300 font-semibold">Rapport généré !</p>
                            <div className="flex gap-3">
                                <a
                                    href={pdfUrl}
                                    download="rapport_reunion.pdf"
                                    className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm font-medium flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Télécharger
                                </a>
                                <button
                                    onClick={resetRecording}
                                    className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-600 text-sm font-medium"
                                >
                                    Nouveau
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportGeneratorModal;
