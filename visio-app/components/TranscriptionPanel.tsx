import React, { useEffect, useRef } from 'react';
import { useTranscription, Engine } from '../src/hooks/useTranscription';

interface TranscriptionPanelProps {
  onTranscriptChange?: (text: string) => void;
}

const WAVE_BARS = Array.from({ length: 24 }, (_, i) => ({
  height: Math.random() * 20 + 4,
  duration: 0.4 + Math.random() * 0.4,
  delay: i * 0.03,
}));

const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({ onTranscriptChange }) => {
  const {
    isRecording,
    transcript,
    wsStatus,
    error,
    recordingTime,
    engine,
    setEngine,
    statSent,
    statDone,
    startRecording,
    stopRecording,
    clearTranscript,
    formatTime,
  } = useTranscription();

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript]);

  useEffect(() => {
    onTranscriptChange?.(transcript);
  }, [transcript, onTranscriptChange]);

  const isConnecting = wsStatus === 'connecting';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/80">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">Transcription</h3>
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
            wsStatus === 'ready' ? 'bg-emerald-500/20 text-emerald-400' :
            wsStatus === 'connecting' ? 'bg-yellow-500/20 text-yellow-400' :
            wsStatus === 'error' ? 'bg-red-500/20 text-red-400' :
            'bg-slate-700/50 text-slate-400'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              wsStatus === 'ready' ? 'bg-emerald-400' :
              wsStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
              wsStatus === 'error' ? 'bg-red-400' : 'bg-slate-500'
            }`} />
            {wsStatus === 'ready' && 'En direct'}
            {wsStatus === 'connecting' && 'Connexion...'}
            {wsStatus === 'error' && 'Erreur'}
            {wsStatus === 'disconnected' && 'Inactif'}
          </div>
        </div>

        {/* Engine selector */}
        <div className="flex gap-1.5 mt-3">
          {(['whisper', 'groq'] as Engine[]).map(e => (
            <button
              key={e}
              onClick={() => !isRecording && setEngine(e)}
              disabled={isRecording}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                engine === e
                  ? e === 'whisper'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
              } ${isRecording ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {e === 'whisper' ? 'Whisper (local)' : 'Groq (cloud)'}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Transcript area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {transcript ? (
          <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
            {transcript}
            {isRecording && <span className="inline-block w-0.5 h-4 bg-teal-400 ml-1 animate-pulse align-middle" />}
          </p>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
              </svg>
            </div>
            <p className="text-slate-500 text-sm font-medium">
              {isConnecting ? 'Connexion...' : 'Lancez la transcription'}
            </p>
            <p className="text-slate-600 text-xs mt-1">Le texte apparait en temps reel</p>
          </div>
        )}
      </div>

      {/* Waveform */}
      {isRecording && (
        <div className="px-4 pb-2 flex items-end gap-0.5 h-6">
          {WAVE_BARS.map((bar, i) => (
            <div key={i} className="flex-1 bg-teal-500 rounded-sm opacity-50"
              style={{
                height: `${bar.height}px`,
                animation: `waveBar ${bar.duration}s ${bar.delay}s ease-in-out infinite alternate`,
              }} />
          ))}
        </div>
      )}

      {/* Stats */}
      {isRecording && (
        <div className="px-4 py-2 border-t border-slate-800 flex items-center gap-4 text-xs text-slate-500 font-mono">
          <span>Envoi: <b className="text-slate-300 font-normal">{statSent}</b></span>
          <span>Recu: <b className="text-slate-300 font-normal">{statDone}</b></span>
          <span className="ml-auto text-red-400 font-sans font-medium">{formatTime(recordingTime)}</span>
        </div>
      )}

      {/* Controls */}
      <div className="p-4 border-t border-slate-800 flex gap-2">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isConnecting}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-teal-600 hover:bg-teal-700 text-white'
          }`}
        >
          {isRecording ? (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
              Arreter
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
              </svg>
              {isConnecting ? 'Connexion...' : 'Transcrire'}
            </>
          )}
        </button>
        {transcript && !isRecording && (
          <button
            onClick={clearTranscript}
            className="px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all"
            title="Effacer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-2 14H7L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
        )}
      </div>

      <style>{`
        @keyframes waveBar { from { transform: scaleY(0.3); } to { transform: scaleY(1); } }
      `}</style>
    </div>
  );
};

export default TranscriptionPanel;
