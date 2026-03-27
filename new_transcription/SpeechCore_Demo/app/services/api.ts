/**
 * api.ts — Services pour communiquer avec l'API Python
 *
 * PORT 8000 → api_websocket.py  (WebSocket /ws/transcribe + REST /extract)
 *
 * La connexion WebSocket est gérée directement dans voice-recognition-page.tsx.
 * Ce fichier gère uniquement les appels HTTP REST (/extract pour le formulaire).
 */

const API_REST_URL = "http://localhost:8000";

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

export interface FormField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  semantic_hint?: string;
}

export interface FormSchema {
  fields: FormField[];
}

export interface TranscriptionResponse {
  transcription_complete: string;
  transcription_avec_locuteurs: string;
  statistiques: {
    nombre_mots: number;
    nombre_locuteurs: number;
    nombre_segments: number;
    langue_detectee: string;
  };
  locution_separee: Array<{ locuteur: string; texte: string }>;
}

export interface ExtractResponse {
  success: boolean;
  data: Record<string, string>;
}

// ══════════════════════════════════════════════════════════
// SANTÉ DU SERVEUR (port 8000)
// Vérifier que api_rest.py est lancé
// ══════════════════════════════════════════════════════════

export const checkServerHealth = async (): Promise<void> => {
  const response = await fetch(`${API_REST_URL}/`, {
    method: "GET",
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error("Serveur inaccessible");
};

// ══════════════════════════════════════════════════════════
// TRANSCRIPTION FICHIER COMPLET (port 8000)
// Optionnel — pour transcrire un fichier WAV entier
// ══════════════════════════════════════════════════════════

export const transcribeAudio = async (
  audioBlob: Blob,
  engine: "vosk" | "whisper" | "gladia" = "whisper"
): Promise<TranscriptionResponse> => {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.wav");

  const response = await fetch(`${API_REST_URL}/${engine}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Erreur ${response.status}`);
  }

  return response.json();
};

// ══════════════════════════════════════════════════════════
// EXTRACTION FORMULAIRE AVEC OLLAMA (port 8000)
// Utilisée par forms-page.tsx
// ══════════════════════════════════════════════════════════

export const extractFormData = async (
  form: FormSchema,
  transcript: string
): Promise<ExtractResponse> => {
  const response = await fetch(`${API_REST_URL}/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript: transcript,
      fields: form.fields,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.detail || "Erreur extraction. Vérifiez que Ollama est lancé (ollama serve)"
    );
  }

  return response.json();
};