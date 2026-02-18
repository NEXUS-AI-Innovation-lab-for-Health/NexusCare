import React, { useState } from 'react';
import { api } from "../src/services/api";

interface LoginProps {
    onLogin: () => void;
    onNavigateToRegister: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onNavigateToRegister }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await api.login(email, password);
            if (data && (data.email || data.id)) {
                localStorage.setItem('user', JSON.stringify(data));
            }
            onLogin();
        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message || 'Échec de la connexion');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 font-sans">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="mx-auto w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-teal-500/20">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Bon retour</h1>
                    <p className="text-slate-400">Connectez-vous pour accéder à votre tableau de bord</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg text-center">
                            {error}
                        </div>
                    )}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-300">Adresse e-mail</label>
                        <input
                            type="email"
                            required
                            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all hover:bg-slate-800"
                            placeholder="nom@exemple.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-300">Mot de passe</label>
                        <input
                            type="password"
                            required
                            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all hover:bg-slate-800"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center justify-between text-sm">
                        <label className="flex items-center text-slate-400 hover:text-slate-300 cursor-pointer">
                            <input type="checkbox" className="form-checkbox h-4 w-4 text-teal-500 rounded border-slate-700 bg-slate-800 focus:ring-offset-slate-900 focus:ring-teal-500" />
                            <span className="ml-2">Se souvenir de moi</span>
                        </label>
                        <a href="#" className="text-teal-400 hover:text-teal-300 transition-colors">Mot de passe oublié ?</a>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full bg-linear-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-semibold py-3.5 rounded-lg shadow-lg hover:shadow-teal-500/25 transition-all duration-300 transform hover:-translate-y-0.5 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? 'Connexion...' : 'Se connecter'}
                    </button>
                </form>

                <div className="mt-8 text-center text-sm text-slate-400">
                    Vous n'avez pas de compte ?{' '}
                    <button
                        onClick={onNavigateToRegister}
                        className="text-teal-400 hover:text-teal-300 font-semibold hover:underline transition-all"
                    >
                        Créer un compte
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
