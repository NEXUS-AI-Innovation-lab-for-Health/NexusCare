import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, AlertCircle, Mail, Lock, LogIn } from 'lucide-react';
import { api } from '../services/api';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await api.login(email, password);
            localStorage.setItem('user', JSON.stringify(response));
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'Erreur de connexion');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#080D1A] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Decorative background glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(8,145,178,0.15),transparent_70%)] pointer-events-none" />

            <div className="relative w-full max-w-md">
                {/* Brand mark */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-600/20 border border-cyan-500/30 mb-4">
                        <Stethoscope className="w-7 h-7 text-cyan-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-50 font-[Figtree] mb-1">NexusCare</h1>
                    <p className="text-slate-400 text-sm">Plateforme de télémédecine</p>
                </div>

                {/* Auth card */}
                <div className="backdrop-blur-2xl bg-white/6 border border-white/12 rounded-2xl p-8">
                    <h2 className="text-lg font-semibold text-slate-50 mb-6">Connexion à votre compte</h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="flex items-start gap-3 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div>
                            <label htmlFor="login-email" className="text-sm font-medium text-slate-300 mb-1.5 block">
                                Adresse email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                <input
                                    id="login-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-white/6 border border-white/12 rounded-xl pl-10 pr-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all duration-200 w-full"
                                    placeholder="votre@email.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="login-password" className="text-sm font-medium text-slate-300 mb-1.5 block">
                                Mot de passe
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                <input
                                    id="login-password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="bg-white/6 border border-white/12 rounded-xl pl-10 pr-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all duration-200 w-full"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50 w-full flex items-center justify-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Connexion…
                                </>
                            ) : (
                                <>
                                    <LogIn className="w-4 h-4" />
                                    Se connecter
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-white/8 text-center">
                        <p className="text-slate-400 text-sm">
                            Pas encore de compte ?{' '}
                            <button
                                onClick={() => navigate('/register')}
                                className="text-cyan-400 hover:text-cyan-300 cursor-pointer transition-colors duration-200 font-medium"
                            >
                                Créer un compte
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
