import { useState, useEffect } from "react";
import { Trash2, Calendar, User, Activity, FileText, Search } from "lucide-react";

interface Recording {
  id: string;
  text: string;
  date: string;
  nom: string;
  prenom: string;
  symptomes: string;
}

export default function HistoryPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = () => {
    const stored = localStorage.getItem("medvoice_recordings");
    if (stored) {
      const parsed = JSON.parse(stored);
      setRecordings(parsed.reverse()); // Les plus récents en premier
    }
  };

  const deleteRecording = (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet enregistrement ?")) {
      return;
    }

    const updated = recordings.filter((r) => r.id !== id);
    localStorage.setItem("medvoice_recordings", JSON.stringify(updated.reverse()));
    setRecordings(updated);
    
    if (selectedRecording?.id === id) {
      setSelectedRecording(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const filteredRecordings = recordings.filter((recording) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      recording.text.toLowerCase().includes(searchLower) ||
      recording.nom.toLowerCase().includes(searchLower) ||
      recording.prenom.toLowerCase().includes(searchLower) ||
      recording.symptomes.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="mb-2">Historique des Enregistrements</h1>
        <p className="text-muted-foreground">
          Consultez et gérez tous les enregistrements de patients sauvegardés
        </p>
      </div>

      {/* Barre de recherche */}
      <div className="mb-6 relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Rechercher par nom, symptômes ou contenu..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {recordings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card rounded-xl border border-border">
          <FileText className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="mb-2">Aucun enregistrement</h2>
          <p className="text-muted-foreground">
            Les enregistrements vocaux apparaîtront ici une fois sauvegardés
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Liste des enregistrements */}
          <div className="space-y-4">
            {filteredRecordings.length === 0 ? (
              <div className="bg-card rounded-lg p-8 text-center border border-border">
                <p className="text-muted-foreground">
                  Aucun résultat pour "{searchTerm}"
                </p>
              </div>
            ) : (
              filteredRecordings.map((recording) => (
                <div
                  key={recording.id}
                  onClick={() => setSelectedRecording(recording)}
                  className={`bg-card border rounded-lg p-5 cursor-pointer transition-all hover:shadow-lg ${
                    selectedRecording?.id === recording.id
                      ? "border-primary shadow-lg shadow-primary/20"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5 text-primary" />
                      <div>
                        {recording.nom || recording.prenom ? (
                          <h3 className="text-foreground">
                            {recording.prenom} {recording.nom}
                          </h3>
                        ) : (
                          <h3 className="text-muted-foreground">Patient non identifié</h3>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRecording(recording.id);
                      }}
                      className="p-2 hover:bg-destructive/10 rounded-lg transition-all group"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground group-hover:text-destructive" />
                    </button>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(recording.date)}</span>
                    </div>
                    
                    {recording.symptomes && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <Activity className="w-4 h-4 mt-0.5" />
                        <span>{recording.symptomes}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {recording.text}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Panneau de détails */}
          <div className="lg:sticky lg:top-6 h-fit">
            {selectedRecording ? (
              <div className="bg-card border border-primary rounded-xl p-6 shadow-xl shadow-primary/10">
                <div className="flex items-center justify-between mb-6">
                  <h2>Détails de l'enregistrement</h2>
                  <button
                    onClick={() => deleteRecording(selectedRecording.id)}
                    className="p-2 bg-destructive/10 hover:bg-destructive/20 rounded-lg transition-all"
                  >
                    <Trash2 className="w-5 h-5 text-destructive" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Informations du patient */}
                  <div className="bg-background rounded-lg p-4 border border-border">
                    <h3 className="mb-3 flex items-center gap-2">
                      <User className="w-5 h-5 text-primary" />
                      Informations du patient
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Prénom</p>
                        <p className="text-foreground">
                          {selectedRecording.prenom || "Non renseigné"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Nom</p>
                        <p className="text-foreground">
                          {selectedRecording.nom || "Non renseigné"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="bg-background rounded-lg p-4 border border-border">
                    <h3 className="mb-2 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" />
                      Date d'enregistrement
                    </h3>
                    <p className="text-sm">{formatDate(selectedRecording.date)}</p>
                  </div>

                  {/* Symptômes */}
                  {selectedRecording.symptomes && (
                    <div className="bg-background rounded-lg p-4 border border-border">
                      <h3 className="mb-2 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-primary" />
                        Symptômes détectés
                      </h3>
                      <p className="text-sm">{selectedRecording.symptomes}</p>
                    </div>
                  )}

                  {/* Transcription complète */}
                  <div className="bg-background rounded-lg p-4 border border-border">
                    <h3 className="mb-2 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      Transcription complète
                    </h3>
                    <p className="text-sm leading-relaxed max-h-64 overflow-y-auto">
                      {selectedRecording.text}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Sélectionnez un enregistrement pour voir les détails
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
