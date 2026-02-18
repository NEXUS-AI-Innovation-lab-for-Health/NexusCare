import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { api } from '../services/api';

interface Message {
    content: string;
    senderId: string;
    senderName: string;
    timestamp: string;
    isOwn: boolean;
}

interface User {
    id: string;
    fistName: string;
    lastName: string;
    job?: string;
    profession?: { name: string };
}

interface Group {
    id: string;
    name: string;
    createdById: string;
    createdBy: { id: string; firstName: string; lastName: string };
    members: { id: string; userId: string; user: { id: string; firstName: string; lastName: string; email: string } }[];
}

type ConversationType = 'dm' | 'group';

const SERVER_URL = import.meta.env.VITE_WS_URL || "http://localhost:4000";

const Chat: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [conversationType, setConversationType] = useState<ConversationType>('dm');
    const [currentRoom, setCurrentRoom] = useState<string>('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageInput, setMessageInput] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [sidebarTab, setSidebarTab] = useState<'contacts' | 'groups'>('contacts');
    const socketRef = useRef<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const usersRef = useRef<User[]>([]);
    const userRef = useRef<User | null>(null);

    // Group creation modal
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [memberSearchQuery, setMemberSearchQuery] = useState('');

    useEffect(() => { usersRef.current = users; }, [users]);
    useEffect(() => { userRef.current = user; }, [user]);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        } else {
            navigate('/login');
        }
    }, [navigate]);

    // Connect socket on mount
    useEffect(() => {
        const socket = io(SERVER_URL, {
            transports: ['polling', 'websocket'],
            extraHeaders: { "ngrok-skip-browser-warning": "true" },
        });
        socketRef.current = socket;

        socket.on('receive-chat-message', (data: { content: string; senderId: string; senderName: string; timestamp: string }) => {
            const currentUser = userRef.current;
            setMessages((prev) => [
                ...prev,
                {
                    content: data.content,
                    senderId: data.senderId,
                    senderName: data.senderName,
                    timestamp: data.timestamp,
                    isOwn: currentUser ? data.senderId === currentUser.id : false,
                },
            ]);
        });

        return () => { socket.disconnect(); };
    }, []);

    // Fetch users
    useEffect(() => {
        api.getUsers()
            .then((data: User[]) => setUsers(data))
            .catch(() => setUsers([]));
    }, []);

    // Fetch groups when user is loaded
    useEffect(() => {
        if (!user) return;
        api.getGroupsByUser(user.id)
            .then((data: Group[]) => setGroups(data))
            .catch(() => setGroups([]));
    }, [user]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const getDmRoomId = (userId1: string, userId2: string): string => {
        return `dm_${[userId1, userId2].sort().join('_')}`;
    };

    const formatTime = (timestamp: string): string => {
        const date = new Date(timestamp);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    const getInitials = (u: User): string => {
        const first = u.fistName?.[0] || '';
        const last = u.lastName?.[0] || '';
        return (first + last).toUpperCase();
    };

    const getProfessionName = (u: User): string => {
        if (u.profession?.name) return u.profession.name;
        if (u.job) return u.job;
        return '';
    };

    const joinRoom = useCallback(async (roomId: string) => {
        if (!socketRef.current) return;
        const socket = socketRef.current;

        if (currentRoom) socket.emit('leave-room', currentRoom);
        socket.emit('join-room', roomId);
        setCurrentRoom(roomId);
        setMessages([]);
        setLoading(true);

        try {
            const history = await api.getMessages(roomId);
            const currentUsers = usersRef.current;
            const mapped: Message[] = (history || []).map((msg: any) => {
                const senderUser = currentUsers.find((u2) => u2.id === msg.sender);
                const senderName = senderUser
                    ? `${senderUser.fistName} ${senderUser.lastName}`
                    : 'Inconnu';
                return {
                    content: msg.content,
                    senderId: msg.sender,
                    senderName,
                    timestamp: msg.createdAt,
                    isOwn: msg.sender === userRef.current?.id,
                };
            });
            setMessages(mapped);
        } catch {
            setMessages([]);
        } finally {
            setLoading(false);
        }
    }, [currentRoom]);

    const selectConversation = useCallback(async (targetUser: User) => {
        if (!user) return;
        setSelectedUser(targetUser);
        setSelectedGroup(null);
        setConversationType('dm');
        await joinRoom(getDmRoomId(user.id, targetUser.id));
    }, [user, joinRoom]);

    const selectGroupConversation = useCallback(async (group: Group) => {
        setSelectedGroup(group);
        setSelectedUser(null);
        setConversationType('group');
        await joinRoom(`group_${group.id}`);
    }, [joinRoom]);

    const sendMessage = useCallback(() => {
        if (!messageInput.trim() || !user || !currentRoom || !socketRef.current) return;
        const content = messageInput.trim();
        const ownMessage: Message = {
            content,
            senderId: user.id,
            senderName: `${user.fistName} ${user.lastName}`,
            timestamp: new Date().toISOString(),
            isOwn: true,
        };
        setMessages((prev) => [...prev, ownMessage]);
        setMessageInput('');
        socketRef.current.emit('send-chat-message', content, currentRoom, user.id);
    }, [messageInput, user, currentRoom]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') sendMessage();
    };

    const handleCreateGroup = async () => {
        if (!user || !newGroupName.trim() || selectedMemberIds.length === 0) return;
        try {
            const group = await api.createGroup({
                name: newGroupName.trim(),
                createdById: user.id,
                memberIds: selectedMemberIds,
            });
            setGroups((prev) => [group, ...prev]);
            setShowCreateGroup(false);
            setNewGroupName('');
            setSelectedMemberIds([]);
            setMemberSearchQuery('');
            // Auto-select the new group
            selectGroupConversation(group);
        } catch (err) {
            console.error('Erreur création groupe:', err);
        }
    };

    const toggleMember = (userId: string) => {
        setSelectedMemberIds((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    };

    const filteredUsers = users.filter((u) => {
        if (!user) return false;
        if (u.id === user.id) return false;
        if (!searchQuery) return true;
        const fullName = `${u.fistName} ${u.lastName}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
    });

    const filteredGroups = groups.filter((g) => {
        if (!searchQuery) return true;
        return g.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const memberFilteredUsers = users.filter((u) => {
        if (!user) return false;
        if (u.id === user.id) return false;
        if (!memberSearchQuery) return true;
        const fullName = `${u.fistName} ${u.lastName}`.toLowerCase();
        return fullName.includes(memberSearchQuery.toLowerCase());
    });

    const hasConversation = selectedUser || selectedGroup;

    const conversationHeader = () => {
        if (conversationType === 'group' && selectedGroup) {
            return (
                <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center gap-3 shrink-0">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="font-semibold text-white">{selectedGroup.name}</p>
                        <p className="text-xs text-teal-400">{selectedGroup.members.length} membre(s)</p>
                    </div>
                </div>
            );
        }
        if (selectedUser) {
            return (
                <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center gap-3 shrink-0">
                    <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center shrink-0">
                        <span className="text-white text-sm font-semibold">{getInitials(selectedUser)}</span>
                    </div>
                    <div>
                        <p className="font-semibold text-white">{selectedUser.fistName} {selectedUser.lastName}</p>
                        {getProfessionName(selectedUser) && (
                            <p className="text-xs text-teal-400">{getProfessionName(selectedUser)}</p>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
            {/* Left Sidebar */}
            <div className="w-80 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
                {/* Sidebar Header */}
                <div className="p-4 border-b border-slate-800 flex items-center gap-3">
                    <Link
                        to="/"
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        title="Retour"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <h1 className="text-lg font-bold text-white">Messagerie</h1>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-800">
                    <button
                        onClick={() => setSidebarTab('contacts')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${sidebarTab === 'contacts' ? 'text-teal-400 border-b-2 border-teal-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Contacts
                    </button>
                    <button
                        onClick={() => setSidebarTab('groups')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${sidebarTab === 'groups' ? 'text-teal-400 border-b-2 border-teal-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Groupes
                    </button>
                </div>

                {/* Search */}
                <div className="p-3 border-b border-slate-800">
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder={sidebarTab === 'contacts' ? "Rechercher un contact..." : "Rechercher un groupe..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {sidebarTab === 'contacts' ? (
                        filteredUsers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6 text-center">
                                <svg className="w-12 h-12 mb-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <p className="text-sm">Aucun contact</p>
                            </div>
                        ) : (
                            filteredUsers.map((u) => {
                                const isSelected = conversationType === 'dm' && selectedUser?.id === u.id;
                                return (
                                    <button
                                        key={u.id}
                                        onClick={() => selectConversation(u)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800 ${isSelected ? 'bg-slate-800 border-r-2 border-teal-500' : ''}`}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center shrink-0">
                                            <span className="text-white text-sm font-semibold">{getInitials(u)}</span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-white truncate">{u.fistName} {u.lastName}</p>
                                            {getProfessionName(u) && (
                                                <p className="text-xs text-slate-400 truncate">{getProfessionName(u)}</p>
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        )
                    ) : (
                        <>
                            {/* New group button */}
                            <button
                                onClick={() => setShowCreateGroup(true)}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800 border-b border-slate-800"
                            >
                                <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center shrink-0">
                                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                                <p className="text-sm font-medium text-teal-400">Nouveau groupe</p>
                            </button>

                            {filteredGroups.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-500 p-6 text-center">
                                    <svg className="w-12 h-12 mb-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <p className="text-sm">Aucun groupe</p>
                                </div>
                            ) : (
                                filteredGroups.map((g) => {
                                    const isSelected = conversationType === 'group' && selectedGroup?.id === g.id;
                                    return (
                                        <button
                                            key={g.id}
                                            onClick={() => selectGroupConversation(g)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800 ${isSelected ? 'bg-slate-800 border-r-2 border-teal-500' : ''}`}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                                                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-white truncate">{g.name}</p>
                                                <p className="text-xs text-slate-400 truncate">{g.members.length} membre(s)</p>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {!hasConversation ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                        <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                            <svg className="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <p className="text-lg font-medium text-slate-400">Aucune conversation</p>
                        <p className="text-sm text-slate-600 mt-1">Choisissez un contact ou un groupe</p>
                    </div>
                ) : (
                    <>
                        {conversationHeader()}

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
                            {loading ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-slate-500">
                                    <p className="text-sm">Aucun message. Commencez la conversation !</p>
                                </div>
                            ) : (
                                messages.map((msg, index) => (
                                    <div key={index} className={`flex flex-col ${msg.isOwn ? 'items-end' : 'items-start'}`}>
                                        {!msg.isOwn && (
                                            <span className="text-xs text-slate-400 mb-1 ml-1">{msg.senderName}</span>
                                        )}
                                        <div className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-2 rounded-2xl text-sm text-white ${msg.isOwn ? 'bg-teal-600 rounded-br-sm' : 'bg-slate-700 rounded-bl-sm'}`}>
                                            {msg.content}
                                        </div>
                                        <span className="text-xs text-slate-500 mt-1 mx-1">{formatTime(msg.timestamp)}</span>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex items-center gap-3 shrink-0">
                            <input
                                type="text"
                                placeholder="Ecrire un message..."
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!messageInput.trim()}
                                className="p-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors shrink-0"
                                title="Envoyer"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Create Group Modal */}
            {showCreateGroup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-800">
                            <h2 className="text-lg font-bold text-white">Nouveau groupe</h2>
                            <button onClick={() => { setShowCreateGroup(false); setNewGroupName(''); setSelectedMemberIds([]); setMemberSearchQuery(''); }} className="text-slate-400 hover:text-white transition-colors">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            {/* Group name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Nom du groupe</label>
                                <input
                                    type="text"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                                    placeholder="Nom du groupe"
                                />
                            </div>

                            {/* Member search */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Membres ({selectedMemberIds.length} choisi(s))
                                </label>
                                <input
                                    type="text"
                                    value={memberSearchQuery}
                                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors mb-2"
                                    placeholder="Rechercher des membres..."
                                />

                                {/* Selected members chips */}
                                {selectedMemberIds.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {selectedMemberIds.map((id) => {
                                            const u = users.find((usr) => usr.id === id);
                                            if (!u) return null;
                                            return (
                                                <span key={id} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-teal-600/20 text-teal-300 text-xs">
                                                    {u.fistName} {u.lastName}
                                                    <button onClick={() => toggleMember(id)} className="hover:text-white">
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Users list */}
                                <div className="max-h-48 overflow-y-auto border border-slate-700 rounded-lg">
                                    {memberFilteredUsers.map((u) => {
                                        const isChecked = selectedMemberIds.includes(u.id);
                                        return (
                                            <button
                                                key={u.id}
                                                onClick={() => toggleMember(u.id)}
                                                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-800 ${isChecked ? 'bg-teal-600/10' : ''}`}
                                            >
                                                <div className={`w-5 h-5 rounded border ${isChecked ? 'bg-teal-600 border-teal-600' : 'border-slate-600'} flex items-center justify-center shrink-0`}>
                                                    {isChecked && (
                                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center shrink-0">
                                                    <span className="text-white text-xs font-semibold">{getInitials(u)}</span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm text-white truncate">{u.fistName} {u.lastName}</p>
                                                    {getProfessionName(u) && <p className="text-xs text-slate-400 truncate">{getProfessionName(u)}</p>}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-800">
                            <button
                                onClick={() => { setShowCreateGroup(false); setNewGroupName(''); setSelectedMemberIds([]); setMemberSearchQuery(''); }}
                                className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleCreateGroup}
                                disabled={!newGroupName.trim() || selectedMemberIds.length === 0}
                                className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
                            >
                                Créer le groupe
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chat;
