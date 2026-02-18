import React, { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

const REPORT_API_URL =
    import.meta.env.VITE_REPORT_API_URL ||
    `${window.location.protocol}//${window.location.hostname}:8000`;

type Step = 'idle' | 'recording' | 'recorded' | 'transcribing' | 'generating' | 'done' | 'error';

const ReportGenerator: React.FC = () => {
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

    // ──────── Recording helpers ────────

    const startRecording = useCallback(async () => {
        try {
            setErrorMsg('');
            setPdfUrl(null);
            setTranscription('');
            setRecordingTime(0);

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Choose a supported mime type
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
                // Stop all tracks so the browser stops showing the mic indicator
                stream.getTracks().forEach((t) => t.stop());
            };

            recorder.start(1000); // collect data every second
            mediaRecorder.current = recorder;
            setStep('recording');

            // Timer
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

    // ──────── API calls ────────

    const transcribeOnly = useCallback(async () => {
        if (!audioBlob) return;
        setStep('transcribing');
        setErrorMsg('');
        try {
            const form = new FormData();
            form.append('audio', audioBlob, 'recording.webm');
            form.append('whisper_model', 'small');
            form.append('language', 'fr');

            const res = await fetch(`${REPORT_API_URL}/transcribe`, {
                method: 'POST',
                body: form,
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: res.statusText }));
                throw new Error(err.detail || 'Transcription failed');
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
            // Always use /generate/text – the transcription (possibly edited) is the source
            const textToSend = mode === 'text' ? manualText : transcription;
            if (!textToSend?.trim()) throw new Error('Aucun texte à envoyer');

            const form = new FormData();
            form.append('text', textToSend);
            form.append('meeting_type', meetingType);

            const res = await fetch(`${REPORT_API_URL}/generate/text`, {
                method: 'POST',
                body: form,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: res.statusText }));
                throw new Error(err.detail || 'Report generation failed');
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            setStep('done');
        } catch (err: any) {
            setErrorMsg(err.message);
            setStep('error');
        }
    }, [manualText, transcription, meetingType, mode]);

    // ──────── Helpers ────────

    const fmtTime = (s: number) =>
        `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    const isProcessing = step === 'transcribing' || step === 'generating';

    // ──────── Render ────────

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
            <div className="max-w-3xl mx-auto">
                {/* Navigation */}
                <div className="flex items-center justify-between mb-10">
                    <Link
                        to="/"
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Retour
                    </Link>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <span className="w-2 h-8 bg-rose-500 rounded-full inline-block" />
                        Génération de Rapport
                    </h1>
                    <div className="w-20" />
                </div>

                {/* Mode selector */}
                <div className="flex gap-4 mb-8">
                    <button
                        onClick={() => { setMode('audio'); resetRecording(); }}
                        className={`flex-1 py-3 rounded-xl border font-medium transition-all ${
                            mode === 'audio'
                                ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                        }`}
                    >
                        🎤 Enregistrement Audio
                    </button>
                    <button
                        onClick={() => { setMode('text'); resetRecording(); }}
                        className={`flex-1 py-3 rounded-xl border font-medium transition-all ${
                            mode === 'text'
                                ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                        }`}
                    >
                        📝 Saisie Texte
                    </button>
                </div>

                {/* Meeting type selector */}
                <div className="mb-8">
                    <label className="block text-sm text-slate-400 mb-2">Type de réunion</label>
                    <select
                        value={meetingType}
                        onChange={(e) => setMeetingType(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:border-rose-500 focus:outline-none"
                    >
                        <option value="medical">Médicale</option>
                        <option value="general">Générale</option>
                        <option value="business">Business</option>
                        <option value="technical">Technique</option>
                    </select>
                </div>

                {/* ── Audio mode ── */}
                {mode === 'audio' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-8">
                        {/* Idle */}
                        {step === 'idle' && (
                            <div className="flex flex-col items-center gap-6">
                                <p className="text-slate-400 text-center">
                                    Appuyez sur le bouton ci-dessous pour enregistrer votre réunion.
                                </p>
                                <button
                                    onClick={startRecording}
                                    className="w-24 h-24 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/30 transition-all hover:scale-105"
                                >
                                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                                    </svg>
                                </button>
                                <p className="text-slate-500 text-sm">Cliquez pour commencer</p>
                            </div>
                        )}

                        {/* Recording */}
                        {step === 'recording' && (
                            <div className="flex flex-col items-center gap-6">
                                <div className="relative">
                                    <div className="w-24 h-24 rounded-full bg-rose-500 animate-pulse flex items-center justify-center shadow-lg shadow-rose-500/40" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-white font-mono text-lg font-bold">
                                            {fmtTime(recordingTime)}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-rose-400 font-medium animate-pulse">
                                    Enregistrement en cours…
                                </p>
                                <button
                                    onClick={stopRecording}
                                    className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-600 transition-all flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <rect x="6" y="6" width="12" height="12" rx="2" />
                                    </svg>
                                    Arrêter
                                </button>
                            </div>
                        )}

                        {/* Recorded / Preview */}
                        {(step === 'recorded' || step === 'done') && audioUrl && (
                            <div className="flex flex-col gap-5">
                                <div className="flex items-center justify-between">
                                    <span className="text-teal-400 font-medium flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Enregistrement prêt ({fmtTime(recordingTime)})
                                    </span>
                                    <button
                                        onClick={resetRecording}
                                        className="text-slate-400 hover:text-white text-sm underline"
                                    >
                                        Recommencer
                                    </button>
                                </div>

                                <audio controls src={audioUrl} className="w-full rounded-lg" />

                                {/* Transcription – editable */}
                                {transcription && (
                                    <div className="bg-slate-800 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs text-slate-500 font-medium uppercase">Transcription (modifiable)</p>
                                            <span className="text-xs text-slate-600">{transcription.length} caractères</span>
                                        </div>
                                        <textarea
                                            rows={6}
                                            value={transcription}
                                            onChange={(e) => setTranscription(e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-rose-500 focus:outline-none resize-y"
                                        />
                                        <p className="text-xs text-slate-600 mt-1">Corrigez les erreurs de transcription avant de générer le rapport</p>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3 flex-wrap">
                                    {!transcription && (
                                        <button
                                            onClick={transcribeOnly}
                                            disabled={isProcessing}
                                            className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-medium transition-all disabled:opacity-50"
                                        >
                                            1. Transcrire l'audio
                                        </button>
                                    )}
                                    <button
                                        onClick={generateReport}
                                        disabled={isProcessing || !transcription}
                                        className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-medium transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50"
                                    >
                                        {transcription ? '2. Générer le rapport PDF' : 'Générer le rapport PDF'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Processing states */}
                        {(step === 'transcribing' || step === 'generating') && (
                            <div className="flex flex-col items-center gap-4 py-4">
                                <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
                                <p className="text-slate-300 font-medium">
                                    {step === 'transcribing'
                                        ? 'Transcription en cours (Whisper)…'
                                        : 'Génération du rapport (Gemini + PDF)…'}
                                </p>
                                <p className="text-slate-500 text-sm">Cela peut prendre quelques instants</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Text mode ── */}
                {mode === 'text' && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-8">
                        <label className="block text-sm text-slate-400 mb-3">
                            Collez ou saisissez la transcription de la réunion
                        </label>
                        <textarea
                            rows={10}
                            value={manualText}
                            onChange={(e) => setManualText(e.target.value)}
                            placeholder="Entrez le texte de la réunion ici…"
                            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-600 focus:border-rose-500 focus:outline-none resize-y"
                        />
                        <button
                            onClick={generateReport}
                            disabled={!manualText.trim() || isProcessing}
                            className="mt-4 w-full py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-medium transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50"
                        >
                            {isProcessing ? 'Génération en cours…' : 'Générer le rapport PDF'}
                        </button>
                    </div>
                )}

                {/* ── Error ── */}
                {(step === 'error' || errorMsg) && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-8">
                        <p className="text-red-400 font-medium flex items-center gap-2">
                            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {errorMsg}
                        </p>
                        <button
                            onClick={resetRecording}
                            className="mt-3 text-sm text-red-300 underline hover:text-white"
                        >
                            Réessayer
                        </button>
                    </div>
                )}

                {/* ── Download PDF ── */}
                {step === 'done' && pdfUrl && (
                    <div className="bg-teal-500/10 border border-teal-500/30 rounded-2xl p-8 flex flex-col items-center gap-4">
                        <svg className="w-14 h-14 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-teal-300 font-semibold text-lg">Rapport généré avec succès !</p>
                        <div className="flex gap-3">
                            <a
                                href={pdfUrl}
                                download="rapport_reunion.pdf"
                                className="px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-medium transition-all shadow-lg shadow-teal-500/20 flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Télécharger le PDF
                            </a>
                            <button
                                onClick={resetRecording}
                                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-600 font-medium transition-all"
                            >
                                Nouveau rapport
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportGenerator;
