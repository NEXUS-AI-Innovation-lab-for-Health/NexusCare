import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

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

    const menuItems = [
        {
            title: "Réunions",
            description: "Gérer et rejoindre vos réunions de concertation",
            icon: (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            ),
            link: "/meetings",
            color: "teal"
        },
        {
            title: "Messagerie",
            description: "Conversations individuelles et groupées",
            icon: (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            ),
            link: "/chat",
            color: "blue"
        },
        {
            title: "Analyse WSI",
            description: "Visualisation et analyse de lames histologiques",
            icon: (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
            ),
            link: "/wsi-analysis",
            color: "purple"
        }
    ];

    const getColorClasses = (color: string) => {
        const colors: Record<string, { bg: string; border: string; text: string; hover: string }> = {
            teal: {
                bg: "bg-teal-500/10",
                border: "border-teal-500/20 hover:border-teal-500/50",
                text: "text-teal-400",
                hover: "hover:bg-teal-500/20"
            },
            blue: {
                bg: "bg-blue-500/10",
                border: "border-blue-500/20 hover:border-blue-500/50",
                text: "text-blue-400",
                hover: "hover:bg-blue-500/20"
            },
            purple: {
                bg: "bg-purple-500/10",
                border: "border-purple-500/20 hover:border-purple-500/50",
                text: "text-purple-400",
                hover: "hover:bg-purple-500/20"
            }
        };
        return colors[color] || colors.teal;
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 md:p-8 font-sans">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8 md:mb-12">
                    <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800 backdrop-blur-sm">
                        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-teal-500/50 shadow-lg shadow-teal-500/20 flex items-center justify-center bg-slate-800">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">{displayUser.firstName} {displayUser.lastName}</h1>
                            <p className="text-teal-400 text-sm font-medium">{displayUser.job}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-auto">
                        <Link
                            to="/profile"
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-all flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Paramètres
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-all flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Déconnexion
                        </button>
                    </div>
                </div>

                <div className="mb-8 md:mb-12">
                    <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <span className="w-2 h-8 bg-teal-500 rounded-full inline-block"></span>
                        Bienvenue sur Nexus Care
                    </h2>
                    <p className="text-slate-400 ml-5">Plateforme collaborative pour les réunions de concertation pluridisciplinaire</p>
                </div>

                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {menuItems.map((item, index) => {
                        const colors = getColorClasses(item.color);
                        return (
                            <Link
                                key={index}
                                to={item.link}
                                className={`group bg-slate-900 border ${colors.border} rounded-xl p-6 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1`}
                            >
                                <div className={`w-16 h-16 ${colors.bg} ${colors.hover} rounded-xl flex items-center justify-center mb-4 transition-colors`}>
                                    <div className={colors.text}>
                                        {item.icon}
                                    </div>
                                </div>
                                <h3 className={`text-xl font-semibold text-white mb-2 group-hover:${colors.text} transition-colors`}>
                                    {item.title}
                                </h3>
                                <p className="text-slate-400 text-sm">
                                    {item.description}
                                </p>
                                <div className={`mt-4 flex items-center gap-2 ${colors.text} text-sm font-medium`}>
                                    Accéder
                                    <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </Link>
                        );
                    })}
                </div>

                <div className="mt-12 bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Activité récente
                    </h3>
                    <div className="text-slate-400 text-sm">
                        Aucune activité récente à afficher.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;
