/**
 * forms-page.tsx — Formulaire médical avec remplissage automatique par IA
 * 
 * FONCTIONNALITÉS :
 * - Sélection d'une transcription existante (depuis la page Reconnaissance vocale)
 * - Remplissage automatique du formulaire avec Ollama
 * - Extraction des données : nom, prénom, âge, symptômes, etc.
 */

import { useState, useEffect } from "react";
import { Sparkles, Save, AlertCircle, FileText, ChevronDown } from "lucide-react";
import { extractFormData, type FormSchema } from "../services/api";

// ══════════════════════════════════════════════════════════════
// DÉFINITION DU FORMULAIRE MÉDICAL
// ══════════════════════════════════════════════════════════════

const MEDICAL_FORM: FormSchema = {
  fields: [
    {
      name: "nom",
      label: "Nom du patient",
      type: "text",
      required: true,
      semantic_hint: "Nom de famille du patient"
    },
    {
      name: "prenom",
      label: "Prénom du patient",
      type: "text",
      required: true,
      semantic_hint: "Prénom du patient"
    },
    {
      name: "age",
      label: "Âge",
      type: "number",
      required: false,
      semantic_hint: "Âge du patient en années"
    },
    {
      name: "sexe",
      label: "Sexe",
      type: "text",
      required: false,
      semantic_hint: "Homme, Femme ou Autre"
    },
    {
      name: "symptomes",
      label: "Symptômes",
      type: "textarea",
      required: true,
      semantic_hint: "Liste des symptômes présentés par le patient"
    },
    {
      name: "temperature",
      label: "Température (°C)",
      type: "number",
      required: false,
      semantic_hint: "Température corporelle en degrés Celsius"
    },
    {
      name: "tension",
      label: "Tension artérielle",
      type: "text",
      required: false,
      semantic_hint: "Tension artérielle (ex: 120/80)"
    },
    {
      name: "antecedents",
      label: "Antécédents médicaux",
      type: "textarea",
      required: false,
      semantic_hint: "Historique médical, maladies chroniques, allergies"
    },
    {
      name: "traitement",
      label: "Traitement actuel",
      type: "textarea",
      required: false,
      semantic_hint: "Médicaments pris actuellement"
    },
    {
      name: "diagnostic",
      label: "Diagnostic préliminaire",
      type: "textarea",
      required: false,
      semantic_hint: "Première évaluation du médecin"
    }
  ]
};

// ══════════════════════════════════════════════════════════════
// TYPE : Enregistrement sauvegardé
// ══════════════════════════════════════════════════════════════

interface SavedRecording {
  id: string;
  text: string;
  date: string;
  nom?: string;
  prenom?: string;
}

export default function FormsPage() {
  // ══════════════════════════════════════════════════════════
  // ÉTAT
  // ══════════════════════════════════════════════════════════
  
  const [transcript, setTranscript] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Enregistrements sauvegardés
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([]);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string>("");
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Valeurs du formulaire
  const [formData, setFormData] = useState<Record<string, string>>({});

  // ══════════════════════════════════════════════════════════
  // EFFET : Charger les enregistrements sauvegardés
  // ══════════════════════════════════════════════════════════
  
  useEffect(() => {
    loadSavedRecordings();
  }, []);

  const loadSavedRecordings = () => {
    try {
      const recordings = JSON.parse(localStorage.getItem("medvoice_recordings") || "[]");
      setSavedRecordings(recordings);
    } catch (err) {
      console.error("Erreur chargement enregistrements:", err);
    }
  };

  // ══════════════════════════════════════════════════════════
  // FONCTION : Charger une transcription existante
  // ══════════════════════════════════════════════════════════
  
  const loadExistingRecording = (recordingId: string) => {
    const recording = savedRecordings.find(r => r.id === recordingId);
    
    if (recording) {
      setTranscript(recording.text);
      setSelectedRecordingId(recordingId);
      setShowDropdown(false);
      setError(null);
      // Réinitialise le formulaire quand on change d'enregistrement
      setFormData({});
    }
  };

  // ══════════════════════════════════════════════════════════
  // FONCTION : Remplir automatiquement le formulaire
  // ══════════════════════════════════════════════════════════
  
  const autoFillForm = async () => {
    if (!transcript.trim()) {
      setError('Veuillez d\'abord sélectionner une transcription');
      return;
    }
    
    setIsExtracting(true);
    setError(null);
    
    try {
      const result = await extractFormData(MEDICAL_FORM, transcript);
      
      if (result.success) {
        setFormData(result.data);
        setError(null);
      } else {
        setError('Extraction échouée');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur d\'extraction. Vérifiez que Ollama est lancé (ollama serve).');
    } finally {
      setIsExtracting(false);
    }
  };

  // ══════════════════════════════════════════════════════════
  // FONCTION : Changer la valeur d'un champ
  // ══════════════════════════════════════════════════════════
  
  const handleFieldChange = (fieldName: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  // ══════════════════════════════════════════════════════════
  // FONCTION : Sauvegarder le formulaire
  // ══════════════════════════════════════════════════════════
  
  const saveForm = () => {
    const requiredFields = MEDICAL_FORM.fields.filter(f => f.required);
    const missingFields = requiredFields.filter(f => !formData[f.name]?.trim());
    
    if (missingFields.length > 0) {
      setError(`Champs obligatoires manquants : ${missingFields.map(f => f.label).join(', ')}`);
      return;
    }
    
    const savedForms = JSON.parse(localStorage.getItem("medvoice_forms") || "[]");
    const newForm = {
      id: Date.now().toString(),
      data: formData,
      transcript: transcript,
      date: new Date().toISOString(),
    };
    
    savedForms.push(newForm);
    localStorage.setItem("medvoice_forms", JSON.stringify(savedForms));
    
    alert("Formulaire sauvegardé avec succès!");
    
    setFormData({});
    setTranscript("");
    setSelectedRecordingId("");
  };

  // ══════════════════════════════════════════════════════════
  // FORMAT : Date lisible
  // ══════════════════════════════════════════════════════════
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ══════════════════════════════════════════════════════════
  // RENDU
  // ══════════════════════════════════════════════════════════

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* En-tête */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Formulaire Médical Intelligent</h1>
        <p className="text-gray-600">
          Sélectionnez un enregistrement et laissez l'IA remplir le formulaire
        </p>
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Layout principal : Colonne gauche + Colonne droite */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ═══════════════════════════════════════════════════
            COLONNE GAUCHE : Sélection + Transcription
        ════════════════════════════════════════════════════ */}
        <div className="space-y-4">

          {/* Sélection de l'enregistrement */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border-2 border-purple-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-purple-900">
                1. Sélectionner un enregistrement
              </h2>
            </div>

            {savedRecordings.length === 0 ? (
              /* Aucun enregistrement disponible */
              <div className="bg-white rounded-lg p-4 border border-purple-200 text-center">
                <p className="text-gray-600 text-sm">Aucun enregistrement disponible.</p>
                <p className="text-purple-700 text-sm mt-1 font-medium">
                  Allez sur la page "Reconnaissance vocale" pour en créer un !
                </p>
              </div>
            ) : (
              /* Dropdown de sélection */
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white border-2 border-purple-300 rounded-lg hover:bg-purple-50 transition-all"
                >
                  <span className="text-gray-700 truncate">
                    {selectedRecordingId
                      ? (() => {
                          const rec = savedRecordings.find(r => r.id === selectedRecordingId);
                          return rec
                            ? `${rec.prenom || ''} ${rec.nom || 'Enregistrement'} — ${formatDate(rec.date)}`
                            : 'Sélectionné';
                        })()
                      : `${savedRecordings.length} enregistrement(s) disponible(s) — Choisissez`
                    }
                  </span>
                  <ChevronDown className={`w-5 h-5 flex-shrink-0 ml-2 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showDropdown && (
                  <div className="absolute z-10 w-full mt-2 bg-white border-2 border-purple-300 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                    {savedRecordings.map((recording) => (
                      <button
                        key={recording.id}
                        onClick={() => loadExistingRecording(recording.id)}
                        className="w-full text-left px-4 py-3 hover:bg-purple-50 border-b border-gray-100 last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-gray-900">
                          {recording.prenom && recording.nom
                            ? `${recording.prenom} ${recording.nom}`
                            : 'Enregistrement sans nom'
                          }
                        </div>
                        <div className="text-sm text-gray-500 mt-0.5">
                          {formatDate(recording.date)}
                        </div>
                        <div className="text-sm text-gray-400 mt-1 truncate">
                          {recording.text.substring(0, 80)}...
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-sm text-purple-700 mt-3">
              💡 Les enregistrements viennent de la page "Reconnaissance vocale"
            </p>
          </div>

          {/* Transcription sélectionnée */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-3">2. Transcription</h2>
            <div className="bg-gray-50 rounded-lg p-4 min-h-[150px] border border-gray-200">
              {transcript ? (
                <p className="text-gray-900 text-sm leading-relaxed">{transcript}</p>
              ) : (
                <p className="text-gray-400 italic text-sm">
                  La transcription de l'enregistrement sélectionné apparaîtra ici...
                </p>
              )}
            </div>
          </div>

          {/* Bouton remplissage automatique */}
          <button
            onClick={autoFillForm}
            disabled={!transcript || isExtracting}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg font-semibold text-lg"
          >
            <Sparkles className="w-6 h-6" />
            {isExtracting
              ? "Extraction en cours..."
              : "3. Remplir automatiquement avec l'IA"}
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════
            COLONNE DROITE : Formulaire médical
        ════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4">Formulaire Médical</h2>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {MEDICAL_FORM.fields.map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>

                {field.type === 'textarea' ? (
                  <textarea
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder={`Entrez ${field.label.toLowerCase()}`}
                  />
                ) : (
                  <input
                    type={field.type}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder={`Entrez ${field.label.toLowerCase()}`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Bouton sauvegarder */}
          <button
            onClick={saveForm}
            disabled={Object.keys(formData).length === 0}
            className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            4. Sauvegarder le formulaire
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-3">💡 Comment utiliser</h3>
        <ol className="space-y-2 text-blue-800 list-decimal list-inside">
          <li>Allez sur la page <strong>Reconnaissance vocale</strong> pour créer des enregistrements</li>
          <li>Revenez ici et <strong>sélectionnez un enregistrement</strong> dans la liste</li>
          <li>Cliquez sur <strong>"Remplir automatiquement avec l'IA"</strong> — les champs se remplissent !</li>
          <li><strong>Vérifiez et corrigez</strong> les valeurs si nécessaire</li>
          <li>Cliquez sur <strong>"Sauvegarder le formulaire"</strong></li>
        </ol>
      </div>
    </div>
  );
}