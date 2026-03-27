/**
 * useTranscription — Hook de transcription temps réel
 *
 * Deux modes selon le moteur :
 *   - groq    → appel direct HTTPS à l'API Groq (pas de WebSocket, fonctionne partout)
 *   - whisper → WebSocket vers le serveur de transcription local
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ── Constantes ──────────────────────────────────────────────────────────────
const RAW_WS_URL = import.meta.env.VITE_TRANSCRIPTION_WS_URL || 'ws://localhost:8002';
const TRANSCRIPTION_WS_URL =
  typeof location !== 'undefined' && location.protocol === 'https:'
    ? RAW_WS_URL.replace(/^ws:\/\//, 'wss://')
    : RAW_WS_URL;
const WS_URL = `${TRANSCRIPTION_WS_URL}/ws/transcribe`;

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

const TARGET_SR = 16000;
const SILENCE = 0.004;
const PROMPT_WORDS = 30;
const CHUNK_MS = 5000;

// ── Types ───────────────────────────────────────────────────────────────────
export type Engine = 'whisper' | 'groq';
export type WsStatus = 'disconnected' | 'connecting' | 'ready' | 'error';

// ── Utilitaires audio ───────────────────────────────────────────────────────
function resample(f32: Float32Array, srcSR: number): Float32Array {
  if (srcSR === TARGET_SR) return f32;
  const ratio = srcSR / TARGET_SR;
  const out = new Float32Array(Math.round(f32.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio, idx = Math.floor(pos), frac = pos - idx;
    out[i] = (f32[idx] ?? 0) + frac * ((f32[idx + 1] ?? 0) - (f32[idx] ?? 0));
  }
  return out;
}

function toWav(f32: Float32Array, sr: number): Blob {
  const n = f32.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const s = (o: number, str: string) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
  s(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); s(8, 'WAVE'); s(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  s(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const x = Math.max(-1, Math.min(1, f32[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function lastWords(text: string, n: number): string {
  return text.trim().split(/\s+/).slice(-n).join(' ');
}

// ── Hook ────────────────────────────────────────────────────────────────────
export function useTranscription() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [wsStatus, setWsStatus] = useState<WsStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [engine, setEngine] = useState<Engine>('groq');
  const [statSent, setStatSent] = useState(0);
  const [statDone, setStatDone] = useState(0);

  // Refs audio
  const streamRef = useRef<MediaStream | null>(null);
  const actxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const pcmBufRef = useRef<Float32Array[]>([]);
  const nativeSRRef = useRef<number>(TARGET_SR);
  const wsQueueRef = useRef<Blob[]>([]);
  const wsBusyRef = useRef(false);
  const chunkTmrRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef = useRef(false);

  // Refs config
  const engineRef = useRef(engine);
  const transcriptRef = useRef(transcript);

  useEffect(() => { engineRef.current = engine; }, [engine]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  // Timer
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  // ── Groq : appel direct HTTPS (pas de WebSocket) ─────────────────────────
  const processGroqChunk = useCallback(async (wav: Blob) => {
    const prompt = lastWords(transcriptRef.current, PROMPT_WORDS);
    const formData = new FormData();
    formData.append('file', wav, 'chunk.wav');
    formData.append('model', 'whisper-large-v3');
    formData.append('language', 'fr');
    formData.append('response_format', 'verbose_json');
    if (prompt) formData.append('prompt', prompt);

    console.log('[Transcription] Groq HTTPS request (%d bytes)', wav.size);

    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq API ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return (data.text || '').trim();
  }, []);

  // ── Whisper : WebSocket vers le serveur local ─────────────────────────────
  const buildPayload = useCallback((b64: string): Record<string, unknown> => {
    const prompt = lastWords(transcriptRef.current, PROMPT_WORDS);
    return {
      audio: b64,
      engine: 'whisper',
      nb_locuteurs: 2,
      config_whisper: 'cpu_rapide',
      methode_bruit: 'false',
      type_environnement: '2',
      initial_prompt: prompt,
    };
  }, []);

  const processQueue = useCallback(() => {
    if (wsBusyRef.current || wsQueueRef.current.length === 0) return;
    const wav = wsQueueRef.current.shift()!;
    wsBusyRef.current = true;

    const eng = engineRef.current;

    if (eng === 'groq') {
      // ── Mode Groq : fetch HTTPS ───────────────────────────────────────
      processGroqChunk(wav)
        .then((txt) => {
          setStatDone(n => n + 1);
          if (txt) {
            setTranscript(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + txt);
          }
        })
        .catch((err) => {
          console.error('[Transcription] Groq error:', err);
          setError(err.message || 'Erreur API Groq');
          setWsStatus('error');
        })
        .finally(() => {
          wsBusyRef.current = false;
          processQueue();
        });
      return;
    }

    // ── Mode Whisper : WebSocket ──────────────────────────────────────────
    blobToBase64(wav).then((b64) => {
      const payload = buildPayload(b64);
      console.log('[Transcription] Connecting to', WS_URL);

      let ws: WebSocket;
      try { ws = new WebSocket(WS_URL); }
      catch (err) {
        console.error('[Transcription] WebSocket creation failed:', err);
        wsBusyRef.current = false;
        processQueue();
        return;
      }

      ws.onopen = () => {
        console.log('[Transcription] WS opened, sending payload (%d bytes audio)', b64.length);
        ws.send(JSON.stringify(payload));
      };

      ws.onmessage = (ev) => {
        console.log('[Transcription] WS message received:', ev.data);
        try {
          const d = JSON.parse(ev.data as string);
          if (d.type === 'result') {
            setStatDone(n => n + 1);
            const txt = (d.transcription_complete || '').trim();
            if (txt) {
              setTranscript(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + txt);
            }
          } else if (d.type === 'error') {
            console.error('[Transcription] Server error:', d.message);
            setError(d.message);
          } else if (d.type === 'status') {
            console.log('[Transcription] Server status:', d.message);
          }
        } catch (err) {
          console.error('[Transcription] Failed to parse WS message:', err, ev.data);
        }
      };

      ws.onerror = (ev) => {
        console.error('[Transcription] WS error:', ev);
        setError('Impossible de joindre le serveur de transcription.');
        setWsStatus('error');
      };

      ws.onclose = (ev) => {
        console.log('[Transcription] WS closed: code=%d reason=%s', ev.code, ev.reason);
        wsBusyRef.current = false;
        processQueue();
      };
    }).catch((err) => {
      console.error('[Transcription] blobToBase64 failed:', err);
      wsBusyRef.current = false;
      processQueue();
    });
  }, [buildPayload, processGroqChunk]);

  const flushChunk = useCallback(() => {
    if (pcmBufRef.current.length === 0) return;
    const total = pcmBufRef.current.reduce((s, a) => s + a.length, 0);
    const merged = new Float32Array(total);
    let off = 0;
    for (const a of pcmBufRef.current) { merged.set(a, off); off += a.length; }
    pcmBufRef.current = [];

    const rms = Math.sqrt(merged.reduce((s, v) => s + v * v, 0) / merged.length);
    if (rms < SILENCE) {
      console.log('[Transcription] Chunk skipped (silence), rms=', rms);
      return;
    }

    const wav = toWav(resample(merged, nativeSRRef.current), TARGET_SR);
    console.log('[Transcription] Chunk flushed: %d samples, rms=%.4f, wav=%d bytes', merged.length, rms, wav.size);
    setStatSent(n => n + 1);
    wsQueueRef.current.push(wav);
    processQueue();
  }, [processQueue]);

  const startRecording = useCallback(async () => {
    setError(null);
    setWsStatus('connecting');
    setStatSent(0);
    setStatDone(0);

    if (engineRef.current === 'groq' && !GROQ_API_KEY) {
      setError('VITE_GROQ_API_KEY manquante. Ajoutez-la dans .env');
      setWsStatus('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: true },
      });
      streamRef.current = stream;

      const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
      actxRef.current = actx;
      nativeSRRef.current = actx.sampleRate;

      const src = actx.createMediaStreamSource(stream);
      const proc = actx.createScriptProcessor(4096, 1, 1);
      procRef.current = proc;
      proc.onaudioprocess = (e) => {
        if (runningRef.current)
          pcmBufRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      src.connect(proc);
      proc.connect(actx.destination);

      runningRef.current = true;
      pcmBufRef.current = [];
      wsQueueRef.current = [];
      wsBusyRef.current = false;
      chunkTmrRef.current = setInterval(flushChunk, CHUNK_MS);

      setWsStatus('ready');
      setIsRecording(true);
    } catch {
      setError("Impossible d'acceder au microphone.");
      setWsStatus('error');
    }
  }, [flushChunk]);

  const stopRecording = useCallback(() => {
    runningRef.current = false;
    setIsRecording(false);
    setWsStatus('disconnected');
    if (chunkTmrRef.current) clearInterval(chunkTmrRef.current);
    flushChunk();
    try { procRef.current?.disconnect(); } catch { /* ignore */ }
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch { /* ignore */ }
    try { actxRef.current?.close(); } catch { /* ignore */ }
    procRef.current = null;
    streamRef.current = null;
    actxRef.current = null;
  }, [flushChunk]);

  const clearTranscript = useCallback(() => setTranscript(''), []);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return {
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
  };
}
