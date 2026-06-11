import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import {
  ChevronLeft,
  User,
  Lock,
  Save,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

const inputClass =
  'bg-white/6 border border-white/12 rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all duration-200 w-full';

export default function Profile() {
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);

  // Section 1 état
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [infoSuccess, setInfoSuccess] = useState('');
  const [infoError, setInfoError] = useState('');
  const [infoLoading, setInfoLoading] = useState(false);

  // Section 2 état
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      navigate('/login');
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      setUser(parsed);
      setFirstName(parsed.firstName || '');
      setLastName(parsed.lastName || '');
      setEmail(parsed.email || '');
    } catch {
      navigate('/login');
    }
  }, [navigate]);

  const getInitials = () => {
    if (!user) return '?';
    const f = (user.firstName || '').charAt(0).toUpperCase();
    const l = (user.lastName || '').charAt(0).toUpperCase();
    return f + l || '?';
  };

  const fullName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
    : '';

  const professionName =
    user?.profession?.name || user?.professionName || '';

  const handleInfoSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoSuccess('');
    setInfoError('');
    setInfoLoading(true);
    try {
      const updated = await api.updateUser(user.id, { firstName, lastName });
      const newUser = { ...user, ...updated, firstName, lastName };
      localStorage.setItem('user', JSON.stringify(newUser));
      setUser(newUser);
      setInfoSuccess('Profil mis à jour ✓');
    } catch (err: any) {
      setInfoError(err.message || 'Une erreur est survenue.');
    } finally {
      setInfoLoading(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSuccess('');
    setPwError('');

    if (newPassword.length < 6) {
      setPwError('Le nouveau mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Les mots de passe ne correspondent pas.');
      return;
    }

    setPwLoading(true);
    try {
      await api.updateUser(user.id, {
        password: newPassword,
        currentPassword,
      });
      setPwSuccess('Mot de passe mis à jour ✓');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err.message || 'Une erreur est survenue.');
    } finally {
      setPwLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#080D1A] text-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 bg-white/6 hover:bg-white/10 border border-white/8 text-slate-300 hover:text-slate-50 px-3 py-2 rounded-xl transition-all duration-200 cursor-pointer text-sm font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            Retour
          </Link>
          <h1 className="text-xl font-semibold text-slate-50">Mon Profil</h1>
        </div>

        {/* Profile card */}
        <div className="backdrop-blur-xl bg-white/4 border border-white/8 rounded-2xl p-6 flex items-center gap-5">
          <div className="shrink-0 w-20 h-20 rounded-full bg-cyan-600 flex items-center justify-center text-2xl font-bold text-white select-none ring-4 ring-cyan-500/20">
            {getInitials()}
          </div>
          <div className="min-w-0">
            <p className="text-xl font-semibold text-slate-50 truncate">
              {fullName || 'Utilisateur'}
            </p>
            {professionName && (
              <span className="inline-block mt-1.5 text-xs font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-lg">
                {professionName}
              </span>
            )}
            <p className="text-sm text-slate-400 mt-1.5 truncate">{email}</p>
          </div>
        </div>

        {/* Section 1 : Informations personnelles */}
        <div className="backdrop-blur-xl bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
            <User className="w-4 h-4 text-cyan-400 shrink-0" />
            <h2 className="text-base font-semibold text-slate-50">
              Informations personnelles
            </h2>
          </div>
          <form onSubmit={handleInfoSave} className="px-6 py-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">
                  Prénom
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClass}
                  placeholder="Prénom"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">
                  Nom
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass}
                  placeholder="Nom"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">
                Email
              </label>
              <input
                type="email"
                value={email}
                disabled
                className={`${inputClass} opacity-50 cursor-not-allowed`}
                placeholder="Email"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                L'adresse email ne peut pas être modifiée.
              </p>
            </div>

            {infoSuccess && (
              <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 px-4 py-2.5 rounded-xl">
                <CheckCircle className="w-4 h-4 shrink-0" />
                {infoSuccess}
              </div>
            )}
            {infoError && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {infoError}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={infoLoading}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {infoLoading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>

        {/* Section 2 : Changer le mot de passe */}
        <div className="backdrop-blur-xl bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
            <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
            <h2 className="text-base font-semibold text-slate-50">
              Changer le mot de passe
            </h2>
          </div>
          <form onSubmit={handlePasswordSave} className="px-6 py-6 space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">
                Mot de passe actuel
              </label>
              <div className="relative">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={`${inputClass} pr-11`}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer focus:outline-none"
                  aria-label={showCurrentPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`${inputClass} pr-11`}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer focus:outline-none"
                  aria-label={showNewPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">
                Confirmer le nouveau mot de passe
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                minLength={6}
              />
            </div>

            {pwSuccess && (
              <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 px-4 py-2.5 rounded-xl">
                <CheckCircle className="w-4 h-4 shrink-0" />
                {pwSuccess}
              </div>
            )}
            {pwError && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {pwError}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={pwLoading}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {pwLoading ? 'Mise à jour...' : 'Mettre à jour'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
