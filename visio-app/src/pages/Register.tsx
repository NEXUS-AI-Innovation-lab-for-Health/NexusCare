import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, AlertCircle, Mail, Lock, User, Briefcase, UserPlus } from 'lucide-react';
import { api } from '../services/api';

const Register: React.FC = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = React.useState({
        email: '',
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: '',
        profession: ''
    });
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Les mots de passe ne correspondent pas');
            return;
        }

        setLoading(true);

        try {
            const { confirmPassword, ...userData } = formData;
            await api.register(userData);
            navigate('/login');
        } catch (err: any) {
            setError(err.message || 'Erreur lors de l\'inscription');
        } finally {
            setLoading(false);
        }
    };

    const [jobs, setJobs] = React.useState<Array<{id: string; name: string}>>([]);

    React.useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const profs = await api.getProfessions();
                if (mounted && Array.isArray(profs)) setJobs(profs);
            } catch (e) {
                // ignorer : la liste des professions sera vide
            }
        })();
        return () => { mounted = false };
    }, []);

    const inputClass = "bg-white/6 border border-white/12 rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all duration-200 w-full";

    return (
        <div className="min-h-screen bg-[#080D1A] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Decorative background glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(8,145,178,0.15),transparent_70%)] pointer-events-none" />

            <div className="relative w-full max-w-lg">
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
                    <h2 className="text-lg font-semibold text-slate-50 mb-6">Créer votre compte</h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="flex items-start gap-3 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* First name + Last name — 2-column grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="reg-firstName" className="text-sm font-medium text-slate-300 mb-1.5 block">
                                    Prénom
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                    <input
                                        id="reg-firstName"
                                        type="text"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                        className={`${inputClass} pl-10`}
                                        placeholder="Jean"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="reg-lastName" className="text-sm font-medium text-slate-300 mb-1.5 block">
                                    Nom
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                    <input
                                        id="reg-lastName"
                                        type="text"
                                        name="lastName"
                                        value={formData.lastName}
                                        onChange={handleChange}
                                        className={`${inputClass} pl-10`}
                                        placeholder="Dupont"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Profession */}
                        <div>
                            <label htmlFor="reg-profession" className="text-sm font-medium text-slate-300 mb-1.5 block">
                                Profession
                            </label>
                            <div className="relative">
                                <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                <select
                                    id="reg-profession"
                                    name="profession"
                                    value={formData.profession}
                                    onChange={handleChange}
                                    className={`${inputClass} pl-10 cursor-pointer appearance-none`}
                                    required
                                >
                                    <option value="" className="bg-[#0f1729] text-slate-400">Sélectionnez votre profession…</option>
                                    {jobs.map((job) => (
                                        <option key={job.id} value={job.id} className="bg-[#0f1729] text-slate-100">{job.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label htmlFor="reg-email" className="text-sm font-medium text-slate-300 mb-1.5 block">
                                Adresse email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                <input
                                    id="reg-email"
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className={`${inputClass} pl-10`}
                                    placeholder="votre@email.com"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="reg-password" className="text-sm font-medium text-slate-300 mb-1.5 block">
                                Mot de passe
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                <input
                                    id="reg-password"
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className={`${inputClass} pl-10`}
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        {/* Confirm password */}
                        <div>
                            <label htmlFor="reg-confirmPassword" className="text-sm font-medium text-slate-300 mb-1.5 block">
                                Confirmer le mot de passe
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                <input
                                    id="reg-confirmPassword"
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className={`${inputClass} pl-10`}
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
                                    Inscription…
                                </>
                            ) : (
                                <>
                                    <UserPlus className="w-4 h-4" />
                                    Créer mon compte
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-white/8 text-center">
                        <p className="text-slate-400 text-sm">
                            Déjà un compte ?{' '}
                            <button
                                onClick={() => navigate('/login')}
                                className="text-cyan-400 hover:text-cyan-300 cursor-pointer transition-colors duration-200 font-medium"
                            >
                                Se connecter
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
