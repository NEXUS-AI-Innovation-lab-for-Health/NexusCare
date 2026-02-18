import React, { useState } from 'react';
import { api } from "../src/services/api";

interface RegisterProps {
    onRegister: () => void;
    onNavigateToLogin: () => void;
}

const Register: React.FC<RegisterProps> = ({ onRegister, onNavigateToLogin }) => {
    const [formData, setFormData] = useState({
        email: '',
        fistName: '',
        lastName: '',
        job: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError("Les mots de passe ne correspondent pas");
            return;
        }

        setLoading(true);
        try {
            const { confirmPassword, ...registerData } = formData;
            if (!registerData.job) throw new Error("Veuillez sélectionner un rôle professionnel");

            await api.register(registerData);
            alert("Compte créé avec succès ! Veuillez vous connecter.");
            onNavigateToLogin();
        } catch (err: any) {
            console.error('Registration error:', err);
            setError(err.message || "Échec de l'inscription");
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Créer un compte</h1>
                    <p className="text-slate-400">Rejoignez Nexus Care aujourd'hui</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg text-center col-span-2">
                            {error}
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-300">Prénom</label>
                            <input
                                type="text"
                                name="fistName"
                                required
                                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all hover:bg-slate-800"
                                value={formData.fistName}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-300">Nom</label>
                            <input
                                type="text"
                                name="lastName"
                                required
                                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all hover:bg-slate-800"
                                value={formData.lastName}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-300">Adresse e-mail</label>
                        <input
                            type="email"
                            name="email"
                            required
                            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all hover:bg-slate-800"
                            placeholder="nom@exemple.com"
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-300">Rôle professionnel</label>
                        <div className="relative">
                            <select
                                name="job"
                                required
                                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all hover:bg-slate-800 cursor-pointer [&>option]:bg-slate-900"
                                value={formData.job}
                                onChange={handleChange}
                            >
                                <option value="" disabled>Sélectionnez votre rôle</option>
                                <option value="Oncologue">Oncologue</option>
                                <option value="Anatomopathologiste">Anatomopathologiste</option>
                                <option value="Radiologue">Radiologue</option>
                                <option value="Chirurgien">Chirurgien</option>
                                <option value="Infirmier(ère)">Infirmier(ère)</option>
                                <option value="Autre">Autre</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-300">Mot de passe</label>
                        <input
                            type="password"
                            name="password"
                            required
                            minLength={6}
                            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all hover:bg-slate-800"
                            placeholder="Min. 6 caractères"
                            value={formData.password}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-300">Confirmer le mot de passe</label>
                        <input
                            type="password"
                            name="confirmPassword"
                            required
                            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all hover:bg-slate-800"
                            placeholder="Répétez le mot de passe"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full bg-linear-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-semibold py-3.5 rounded-lg shadow-lg hover:shadow-teal-500/25 transition-all duration-300 transform hover:-translate-y-0.5 mt-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? 'Création du compte...' : 'Créer un compte'}
                    </button>
                </form>

                <div className="mt-8 text-center text-sm text-slate-400">
                    Vous avez déjà un compte ?{' '}
                    <button
                        onClick={onNavigateToLogin}
                        className="text-teal-400 hover:text-teal-300 font-semibold hover:underline transition-all"
                    >
                        Se connecter
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Register;
