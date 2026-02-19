import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const inputClass =
  'bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors w-full';

const saveButtonClass =
  'px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors';

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
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Retour
          </Link>
          <div className="h-5 w-px bg-slate-700" />
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-teal-500 rounded-full" />
            <h1 className="text-lg font-semibold text-white">
              Paramètres du profil
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* User summary card */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 flex items-center gap-5">
          <div className="shrink-0 w-16 h-16 rounded-full bg-teal-600 flex items-center justify-center text-2xl font-bold text-white select-none">
            {getInitials()}
          </div>
          <div>
            <p className="text-xl font-semibold text-white">
              {fullName || 'Utilisateur'}
            </p>
            {professionName && (
              <p className="text-sm text-slate-400 mt-0.5">{professionName}</p>
            )}
          </div>
        </div>

        {/* Section 1 : Informations personnelles */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800">
            <div className="w-1 h-5 bg-teal-500 rounded-full" />
            <h2 className="text-base font-semibold text-white">
              Informations personnelles
            </h2>
          </div>
          <form onSubmit={handleInfoSave} className="px-6 py-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">
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
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">
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
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">
                Email
              </label>
              <input
                type="email"
                value={email}
                disabled
                className={`${inputClass} opacity-50 cursor-not-allowed`}
                placeholder="Email"
              />
              <p className="text-xs text-slate-500">
                L'adresse email ne peut pas être modifiée.
              </p>
            </div>

            {infoSuccess && (
              <p className="text-sm text-teal-400 font-medium">{infoSuccess}</p>
            )}
            {infoError && (
              <p className="text-sm text-red-400 font-medium">{infoError}</p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={infoLoading}
                className={`${saveButtonClass} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {infoLoading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>

        {/* Section 2 : Changer le mot de passe */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800">
            <div className="w-1 h-5 bg-teal-500 rounded-full" />
            <h2 className="text-base font-semibold text-white">
              Changer le mot de passe
            </h2>
          </div>
          <form onSubmit={handlePasswordSave} className="px-6 py-6 space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">
                Mot de passe actuel
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                minLength={6}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">
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
              <p className="text-sm text-teal-400 font-medium">{pwSuccess}</p>
            )}
            {pwError && (
              <p className="text-sm text-red-400 font-medium">{pwError}</p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={pwLoading}
                className={`${saveButtonClass} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {pwLoading ? 'Mise à jour...' : 'Mettre à jour'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
