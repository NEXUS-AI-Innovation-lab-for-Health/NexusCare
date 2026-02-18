import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const WSIAnalysis: React.FC = () => {
    const navigate = useNavigate();

    React.useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
            navigate('/login');
        }
    }, [navigate]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Link
                        to="/"
                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                    >
                        <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <h2 className="text-3xl font-bold flex items-center gap-3">
                        <span className="w-2 h-8 bg-purple-500 rounded-full inline-block"></span>
                        Analyse WSI
                    </h2>
                </div>

                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-32 h-32 bg-purple-500/10 rounded-full flex items-center justify-center mb-6 border border-purple-500/20">
                        <svg className="w-16 h-16 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                    </div>

                    <h3 className="text-2xl font-semibold text-white mb-4">Fonctionnalité à venir</h3>
                    <p className="text-slate-400 text-center max-w-md mb-8">
                        L'analyse de lames histologiques WSI (Whole Slide Imaging) sera bientôt disponible.
                        Cette fonctionnalité permettra de visualiser et annoter des images médicales haute résolution.
                    </p>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full">
                        <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Fonctionnalités prévues
                        </h4>
                        <ul className="space-y-3">
                            <li className="flex items-center gap-3 text-slate-300">
                                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                                Visualisation haute résolution de lames
                            </li>
                            <li className="flex items-center gap-3 text-slate-300">
                                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                                Outils d'annotation collaboratifs
                            </li>
                            <li className="flex items-center gap-3 text-slate-300">
                                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                                Zoom et navigation fluides
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WSIAnalysis;
