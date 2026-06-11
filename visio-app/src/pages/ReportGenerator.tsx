import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  FileText,
  Download,
  Trash2,
  Clock,
} from 'lucide-react';

const REPORTS_KEY = 'nexuscare_reports';

export interface StoredReport {
  id: string;
  generatedAt: string;
  meetingType: string;
  mode: 'audio' | 'text';
  label: string;
}

const TYPE_LABEL: Record<string, string> = {
  medical: 'Médicale',
  general: 'Générale',
  business: 'Business',
  technical: 'Technique',
};

const TYPE_COLOR: Record<string, string> = {
  medical: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  general: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  business: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  technical: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
};

const ReportGenerator: React.FC = () => {
  const [reports, setReports] = useState<StoredReport[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(REPORTS_KEY);
      if (raw) setReports(JSON.parse(raw));
    } catch {}
  }, []);

  const deleteReport = useCallback((id: string) => {
    setReports(prev => {
      const next = prev.filter(r => r.id !== id);
      try { localStorage.setItem(REPORTS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#080D1A] text-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 bg-white/6 hover:bg-white/10 border border-white/8 text-slate-300 hover:text-slate-50 px-3 py-2 rounded-xl transition-all duration-200 cursor-pointer text-sm font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            Retour
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-slate-50">Rapports</h1>
            <p className="text-xs text-slate-500 mt-0.5">Historique des rapports générés lors des réunions</p>
          </div>
        </div>

        {/* Report list */}
        <div className="backdrop-blur-xl bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <h2 className="font-semibold text-sm text-slate-200">Historique des rapports</h2>
            {reports.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold border border-emerald-500/25">
                {reports.length}
              </span>
            )}
          </div>

          {reports.length === 0 ? (
            <div className="px-5 py-16 flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center">
                <FileText className="w-7 h-7 text-slate-600" />
              </div>
              <p className="text-slate-400 text-sm font-medium">Aucun rapport généré</p>
              <p className="text-slate-600 text-xs max-w-xs">
                Les rapports générés lors de vos réunions apparaîtront ici
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {reports.map(r => {
                const colorClass = TYPE_COLOR[r.meetingType] ?? TYPE_COLOR.general;
                const date = new Date(r.generatedAt);
                return (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors duration-150">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 font-medium truncate">{r.label}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${colorClass}`}>
                          {TYPE_LABEL[r.meetingType] ?? r.meetingType}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Clock className="w-3 h-3" />
                          {date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {' à '}
                          {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[10px] text-slate-600">
                          {r.mode === 'audio' ? 'Enregistrement audio' : 'Texte manuel'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-slate-600 px-2 py-1 rounded-lg border border-white/6 flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        PDF
                      </span>
                      <button
                        onClick={() => deleteReport(r.id)}
                        aria-label="Supprimer"
                        className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
};

export default ReportGenerator;
