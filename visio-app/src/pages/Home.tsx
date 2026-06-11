import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Stethoscope,
    Video,
    MessageSquare,
    Microscope,
    FileText,
    User,
    LogOut,
    Settings,
    ArrowRight,
    Activity,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Clock,
} from 'lucide-react';
import { api } from '../services/api';

const Home: React.FC = () => {
    const [user, setUser] = React.useState<any>(null);
    const navigate = useNavigate();

    React.useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        } else {
            navigate('/login');
        }
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/login');
    };

    const displayUser = user || {
        firstName: "",
        lastName: "",
        job: ""
    };

    // ── Calendar & meetings state ──
    const [meetings, setMeetings] = React.useState<any[]>([]);
    const [calMonth, setCalMonth] = React.useState(() => new Date());
    const [hoveredDay, setHoveredDay] = React.useState<string | null>(null);
    const hoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleDayEnter = (key: string) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setHoveredDay(key);
    };
    const handleDayLeave = () => {
        hoverTimeoutRef.current = setTimeout(() => setHoveredDay(null), 150);
    };
    const handleTooltipEnter = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
    const handleTooltipLeave = () => {
        hoverTimeoutRef.current = setTimeout(() => setHoveredDay(null), 150);
    };

    React.useEffect(() => {
        if (!user?.id) return;
        api.getMeetingsByParticipant(user.id).then(setMeetings).catch(() => {});
    }, [user]);

    const toDateKey = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const getDaysInMonth = (d: Date) => {
        const [y, mo] = [d.getFullYear(), d.getMonth()];
        const startDow = (new Date(y, mo, 1).getDay() + 6) % 7;
        const totalDays = new Date(y, mo + 1, 0).getDate();
        return [
            ...Array<null>(startDow).fill(null),
            ...Array.from({ length: totalDays }, (_, i) => new Date(y, mo, i + 1)),
        ];
    };

    const meetingsByDate = React.useMemo(() => {
        const map: Record<string, any[]> = {};
        meetings.forEach(m => {
            const k = m.scheduledDate?.split('T')[0];
            if (k) map[k] = [...(map[k] ?? []), m];
        });
        return map;
    }, [meetings]);

    const todayKey = toDateKey(new Date());
    const activeMeetingsCount = meetings.filter(m =>
        ['scheduled', 'in_progress', 'pending'].includes(m.status ?? '')
    ).length;

    const menuItems = [
        {
            title: "Réunions",
            description: "Gérer et rejoindre vos réunions de concertation pluridisciplinaire",
            icon: Video,
            link: "/meetings",
            accent: "cyan",
            iconBg: "bg-cyan-500/15",
            iconColor: "text-cyan-400",
            borderHover: "hover:border-cyan-500/30",
            glowHover: "hover:shadow-cyan-500/10",
            large: true,
        },
        {
            title: "Messagerie",
            description: "Conversations individuelles et groupées avec votre équipe",
            icon: MessageSquare,
            link: "/chat",
            accent: "purple",
            iconBg: "bg-purple-500/15",
            iconColor: "text-purple-400",
            borderHover: "hover:border-purple-500/30",
            glowHover: "hover:shadow-purple-500/10",
            large: false,
        },
        {
            title: "Analyse WSI",
            description: "Visualisation et analyse de lames histologiques",
            icon: Microscope,
            link: "/wsi-analysis",
            accent: "blue",
            iconBg: "bg-blue-500/15",
            iconColor: "text-blue-400",
            borderHover: "hover:border-blue-500/30",
            glowHover: "hover:shadow-blue-500/10",
            large: false,
        },
        {
            title: "Rapports",
            description: "Génération et consultation de rapports médicaux",
            icon: FileText,
            link: "/reports",
            accent: "emerald",
            iconBg: "bg-emerald-500/15",
            iconColor: "text-emerald-400",
            borderHover: "hover:border-emerald-500/30",
            glowHover: "hover:shadow-emerald-500/10",
            large: false,
        },
    ];

    return (
        <div className="min-h-screen bg-[#080D1A] font-sans relative overflow-x-hidden">

            {/* Ambient radial glow — top-right */}
            <div
                className="pointer-events-none fixed top-0 right-0 w-[600px] h-[600px] rounded-full opacity-20"
                style={{
                    background: 'radial-gradient(circle at 70% 20%, #06b6d4 0%, transparent 65%)',
                }}
            />
            {/* Ambient radial glow — bottom-left */}
            <div
                className="pointer-events-none fixed bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-10"
                style={{
                    background: 'radial-gradient(circle at 30% 80%, #6366f1 0%, transparent 65%)',
                }}
            />

            {/* ── Navbar ── */}
            <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/4 border-b border-white/8">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

                    {/* Logo */}
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                            <Stethoscope className="w-4 h-4 text-cyan-400" />
                        </div>
                        <span className="font-[Figtree] font-bold text-slate-50 text-lg tracking-tight">
                            NexusCare
                        </span>
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-2">
                        {/* User chip */}
                        <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl backdrop-blur-xl bg-white/4 border border-white/8">
                            <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
                                <User className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <div className="leading-none">
                                <p className="text-xs font-semibold text-slate-100">
                                    {displayUser.firstName} {displayUser.lastName}
                                </p>
                                {displayUser.job && (
                                    <p className="text-[10px] text-slate-500 mt-0.5">{displayUser.job}</p>
                                )}
                            </div>
                        </div>

                        <Link
                            to="/profile"
                            className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-xl backdrop-blur-xl bg-white/4 border border-white/8 text-slate-400 hover:text-slate-200 hover:bg-white/7 hover:border-white/14 transition-all duration-200 text-sm"
                            aria-label="Paramètres du profil"
                        >
                            <Settings className="w-4 h-4" />
                            <span className="hidden md:inline">Paramètres</span>
                        </Link>

                        <button
                            onClick={handleLogout}
                            className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-xl backdrop-blur-xl bg-white/4 border border-white/8 text-slate-400 hover:text-red-400 hover:bg-red-500/7 hover:border-red-500/20 transition-all duration-200 text-sm"
                            aria-label="Se déconnecter"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden md:inline">Déconnexion</span>
                        </button>
                    </div>
                </div>
            </nav>

            {/* ── Main content ── */}
            <main className="max-w-6xl mx-auto px-6 py-10">

                {/* Welcome section */}
                <div className="mb-10">
                    <p className="text-sm text-cyan-400 font-medium mb-1 tracking-wide uppercase">
                        Tableau de bord
                    </p>
                    <h1 className="font-[Figtree] font-bold text-3xl text-slate-50 mb-2">
                        {displayUser.firstName
                            ? `Bonjour, ${displayUser.firstName}`
                            : 'Bienvenue sur NexusCare'}
                    </h1>
                    <p className="text-slate-400 text-base max-w-xl leading-relaxed">
                        Plateforme collaborative pour les réunions de concertation pluridisciplinaire en télémédecine.
                    </p>
                </div>

                {/* Quick stats row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    {[
                        { label: 'Réunions actives', value: String(activeMeetingsCount), icon: Video, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                        { label: 'Messages non lus', value: '0', icon: MessageSquare, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                        { label: 'Analyses en attente', value: '0', icon: Activity, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    ].map((stat) => (
                        <div
                            key={stat.label}
                            className="backdrop-blur-xl bg-white/4 border border-white/8 rounded-2xl px-5 py-4 flex items-center gap-4"
                        >
                            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                            </div>
                            <div>
                                <p className="text-2xl font-[Figtree] font-bold text-slate-50 leading-none">{stat.value}</p>
                                <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bento navigation grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                    {/* Large card — Réunions (spans 2 cols on lg) */}
                    {menuItems.slice(0, 1).map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.title}
                                to={item.link}
                                className={`group cursor-pointer lg:col-span-2 backdrop-blur-xl bg-white/4 border border-white/8 rounded-2xl p-6 flex flex-col justify-between min-h-[180px] transition-all duration-200 ${item.borderHover} hover:bg-white/7 hover:shadow-xl ${item.glowHover}`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className={`w-12 h-12 rounded-xl ${item.iconBg} border border-white/6 flex items-center justify-center`}>
                                        <Icon className={`w-6 h-6 ${item.iconColor}`} />
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all duration-200" />
                                </div>
                                <div className="mt-4">
                                    <h2 className="font-[Figtree] font-semibold text-lg text-slate-50 mb-1">
                                        {item.title}
                                    </h2>
                                    <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
                                        {item.description}
                                    </p>
                                </div>
                                <div className={`mt-5 inline-flex items-center gap-1.5 text-xs font-semibold ${item.iconColor} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
                                    Accéder <ArrowRight className="w-3 h-3" />
                                </div>
                            </Link>
                        );
                    })}

                    {/* Regular cards */}
                    {menuItems.slice(1).map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.title}
                                to={item.link}
                                className={`group cursor-pointer backdrop-blur-xl bg-white/4 border border-white/8 rounded-2xl p-6 flex flex-col justify-between min-h-40 transition-all duration-200 ${item.borderHover} hover:bg-white/7 hover:shadow-xl ${item.glowHover}`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className={`w-11 h-11 rounded-xl ${item.iconBg} border border-white/6 flex items-center justify-center`}>
                                        <Icon className={`w-5 h-5 ${item.iconColor}`} />
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all duration-200" />
                                </div>
                                <div className="mt-4">
                                    <h2 className="font-[Figtree] font-semibold text-base text-slate-50 mb-1">
                                        {item.title}
                                    </h2>
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        {item.description}
                                    </p>
                                </div>
                            </Link>
                        );
                    })}
                </div>

                {/* ── Calendrier des réunions ── */}
                <div className="mt-6 backdrop-blur-xl bg-white/4 border border-white/8 rounded-2xl px-6 py-5">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-cyan-400" />
                            <h3 className="font-[Figtree] font-semibold text-sm text-slate-200">
                                Calendrier des réunions
                            </h3>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                                aria-label="Mois précédent"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/8 transition-all duration-200 cursor-pointer"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm text-slate-300 font-medium px-2 min-w-[140px] text-center capitalize">
                                {calMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                            </span>
                            <button
                                onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                                aria-label="Mois suivant"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/8 transition-all duration-200 cursor-pointer"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 mb-1">
                        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                            <div key={d} className="text-center text-[11px] text-slate-500 font-medium py-1">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-0.5">
                        {getDaysInMonth(calMonth).map((day, idx) => {
                            if (!day) {
                                return <div key={`e-${idx}`} className="aspect-square" />;
                            }
                            const key = toDateKey(day);
                            const dayMeetings = meetingsByDate[key] ?? [];
                            const isToday = key === todayKey;
                            const hasMeetings = dayMeetings.length > 0;
                            const col = idx % 7;
                            const isRightEdge = col >= 5;

                            return (
                                <div
                                    key={key}
                                    className="relative"
                                    onMouseEnter={() => { if (hasMeetings) handleDayEnter(key); }}
                                    onMouseLeave={handleDayLeave}
                                >
                                    <div className={[
                                        'aspect-square flex flex-col items-center justify-center rounded-lg transition-all duration-150',
                                        isToday
                                            ? 'bg-cyan-500/20 border border-cyan-500/40'
                                            : hasMeetings
                                                ? 'bg-white/6 border border-cyan-500/20 hover:bg-cyan-500/10 hover:border-cyan-500/30 cursor-pointer'
                                                : 'hover:bg-white/4',
                                    ].join(' ')}>
                                        <span className={`text-xs font-medium leading-none ${
                                            isToday ? 'text-cyan-300' : hasMeetings ? 'text-slate-200' : 'text-slate-500'
                                        }`}>
                                            {day.getDate()}
                                        </span>
                                        {hasMeetings && (
                                            <div className="flex gap-0.5 mt-1">
                                                {dayMeetings.slice(0, 3).map((_, i) => (
                                                    <div key={i} className={`w-1 h-1 rounded-full ${isToday ? 'bg-cyan-300' : 'bg-cyan-500'}`} />
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Hover tooltip */}
                                    {hoveredDay === key && (
                                        <div
                                            onMouseEnter={handleTooltipEnter}
                                            onMouseLeave={handleTooltipLeave}
                                            className={[
                                            'absolute z-50 bottom-full mb-2 w-60',
                                            'backdrop-blur-2xl bg-[#0D1526]/95 border border-white/12',
                                            'rounded-xl shadow-2xl p-3 space-y-2',
                                            isRightEdge ? 'right-0' : 'left-0',
                                        ].join(' ')}>
                                            {/* Arrow */}
                                            <div className={[
                                                'absolute top-full w-0 h-0',
                                                'border-l-4 border-r-4 border-t-4',
                                                'border-l-transparent border-r-transparent border-t-white/12',
                                                isRightEdge ? 'right-3' : 'left-3',
                                            ].join(' ')} />

                                            <p className="text-[10px] text-slate-500 font-medium capitalize">
                                                {day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                            </p>

                                            {dayMeetings.map((meeting, mi) => (
                                                <div key={meeting.id}>
                                                    {mi > 0 && <div className="border-t border-white/8 pt-2" />}
                                                    <p className="text-xs font-semibold text-slate-100 truncate mb-1">
                                                        {meeting.subject}
                                                    </p>
                                                    {meeting.time && (
                                                        <p className="text-[10px] text-cyan-400 flex items-center gap-1 mb-1">
                                                            <Clock className="w-3 h-3" />
                                                            {meeting.time}{meeting.duration ? ` · ${meeting.duration}min` : ''}
                                                        </p>
                                                    )}
                                                    {(meeting.patientLastName || meeting.patientFirstName) && (
                                                        <p className="text-[10px] text-slate-400 mb-1.5">
                                                            Patient : {meeting.patientLastName} {meeting.patientFirstName}
                                                        </p>
                                                    )}
                                                    <div className="flex gap-1.5">
                                                        <button
                                                            onClick={() => navigate(`/meeting/${meeting.id}/premeeting`)}
                                                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-semibold transition-all duration-150 cursor-pointer"
                                                        >
                                                            <Video className="w-3 h-3" />
                                                            Rejoindre
                                                        </button>
                                                        <button
                                                            onClick={() => navigate('/chat', { state: { roomId: meeting.roomId } })}
                                                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white/8 hover:bg-white/12 text-slate-200 text-[10px] font-semibold border border-white/10 transition-all duration-150 cursor-pointer"
                                                        >
                                                            <MessageSquare className="w-3 h-3" />
                                                            Chat
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {meetings.length === 0 && (
                        <p className="text-center text-xs text-slate-600 mt-3">Aucune réunion planifiée ce mois</p>
                    )}
                </div>

                {/* Activité récente */}
                <div className="mt-4 backdrop-blur-xl bg-white/4 border border-white/8 rounded-2xl px-6 py-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-cyan-400" />
                        <h3 className="font-[Figtree] font-semibold text-sm text-slate-200">
                            Activité récente
                        </h3>
                    </div>
                    {meetings.length > 0 ? (
                        <ul className="space-y-2">
                            {meetings.slice(0, 4).map(m => (
                                <li key={m.id} className="flex items-center gap-3 text-sm">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                                    <span className="text-slate-300 truncate flex-1">{m.subject}</span>
                                    {m.scheduledDate && (
                                        <span className="text-slate-500 text-xs shrink-0">
                                            {new Date(m.scheduledDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-slate-500">Aucune activité récente à afficher.</p>
                    )}
                </div>

            </main>
        </div>
    );
};

export default Home;
