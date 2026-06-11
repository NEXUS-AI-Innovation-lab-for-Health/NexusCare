import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { api } from '../services/api';
import {
    MessageSquare,
    Users,
    Plus,
    Search,
    Send,
    X,
    ChevronLeft,
    Hash,
    UserCircle,
    Check,
    CheckCheck,
    Menu,
} from 'lucide-react';

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
    const location = useLocation();
    const hasAutoJoinedRef = useRef(false);
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
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
    const socketRef = useRef<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const usersRef = useRef<User[]>([]);
    const userRef = useRef<User | null>(null);

    // Group details modal
    const [showGroupDetails, setShowGroupDetails] = useState(false);

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
        // Sur mobile, on referme le menu une fois la conversation choisie
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
        await joinRoom(getDmRoomId(user.id, targetUser.id));
    }, [user, joinRoom]);

    const selectGroupConversation = useCallback(async (group: Group) => {
        setSelectedGroup(group);
        setSelectedUser(null);
        setConversationType('group');
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
        await joinRoom(`group_${group.id}`);
    }, [joinRoom]);

    // Auto-join room from navigation state (e.g. navigate('/chat', { state: { roomId: 'group_xxx' } }))
    useEffect(() => {
        if (hasAutoJoinedRef.current) return;
        const roomId = (location.state as { roomId?: string } | null)?.roomId;
        if (!roomId || !user) return;

        if (roomId.startsWith('group_')) {
            if (groups.length === 0) return;
            const groupId = roomId.slice('group_'.length);
            const group = groups.find((g) => g.id === groupId);
            if (group) {
                hasAutoJoinedRef.current = true;
                setSidebarTab('groups');
                selectGroupConversation(group);
            }
        } else if (roomId.startsWith('dm_')) {
            if (users.length === 0) return;
            const parts = roomId.slice('dm_'.length).split('_');
            const otherUserId = parts.find((p) => p !== user.id);
            if (otherUserId) {
                const otherUser = users.find((u) => u.id === otherUserId);
                if (otherUser) {
                    hasAutoJoinedRef.current = true;
                    selectConversation(otherUser);
                }
            }
        }
    }, [location.state, user, groups, users, selectGroupConversation, selectConversation]);

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
            // Sélection automatique du nouveau groupe
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
                <div
                    onClick={() => setShowGroupDetails(true)}
                    className="px-5 py-3.5 bg-white/3 border-b border-white/8 flex items-center gap-3 shrink-0 cursor-pointer hover:bg-white/5 transition-colors duration-150"
                >
                    <div className="w-9 h-9 rounded-full bg-cyan-600/30 border border-cyan-500/30 flex items-center justify-center shrink-0">
                        <Hash className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-50 truncate">{selectedGroup.name}</p>
                        <p className="text-xs text-cyan-400">{selectedGroup.members.length} membre(s)</p>
                    </div>
                    <Users className="w-4 h-4 text-slate-500 shrink-0" />
                </div>
            );
        }
        if (selectedUser) {
            return (
                <div className="px-5 py-3.5 bg-white/3 border-b border-white/8 flex items-center gap-3 shrink-0">
                    <div className="w-9 h-9 rounded-full bg-cyan-600/20 border border-cyan-500/20 flex items-center justify-center shrink-0">
                        <span className="text-cyan-300 text-xs font-bold">{getInitials(selectedUser)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-50 truncate">{selectedUser.fistName} {selectedUser.lastName}</p>
                        {getProfessionName(selectedUser) && (
                            <p className="text-xs text-cyan-400 truncate">{getProfessionName(selectedUser)}</p>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex h-screen bg-[#080D1A] text-slate-100 font-sans overflow-hidden relative">

            {/* ── LEFT SIDEBAR ── */}
            <div
                className={`fixed inset-y-0 left-0 z-30 w-72 sm:static sm:w-72 shrink-0 bg-white/3 border-r border-white/8 flex flex-col transform transition-transform duration-200 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}`}
            >
                {/* Sidebar top bar */}
                <div className="h-14 px-4 flex items-center gap-3 border-b border-white/8 shrink-0">
                    <Link
                        to="/"
                        className="p-1.5 rounded-lg hover:bg-white/7 text-slate-400 hover:text-slate-200 transition-colors duration-150 cursor-pointer"
                        aria-label="Retour"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <MessageSquare className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="text-sm font-semibold text-slate-50 truncate">NexusCare Chat</span>
                    </div>
                </div>

                {/* Search bar */}
                <div className="px-3 pt-3 pb-2 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Rechercher…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/6 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all duration-150"
                        />
                    </div>
                </div>

                {/* Create group button */}
                <div className="px-3 pb-3 shrink-0">
                    <button
                        onClick={() => setShowCreateGroup(true)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-600/10 border border-cyan-500/20 hover:bg-cyan-600/20 text-cyan-400 text-xs font-medium transition-colors duration-150 cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        Créer groupe
                    </button>
                </div>

                {/* Sections */}
                <div className="flex-1 overflow-y-auto">

                    {/* Direct messages section */}
                    <div className="px-3 pb-1">
                        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5 px-1">
                            <UserCircle className="w-3 h-3" />
                            Messages directs
                        </p>
                        {filteredUsers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-6 text-slate-600">
                                <UserCircle className="w-8 h-8 mb-2 text-slate-700" />
                                <p className="text-xs">Aucun contact</p>
                            </div>
                        ) : (
                            filteredUsers.map((u) => {
                                const isSelected = conversationType === 'dm' && selectedUser?.id === u.id;
                                return (
                                    <button
                                        key={u.id}
                                        onClick={() => selectConversation(u)}
                                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors duration-150 cursor-pointer mb-0.5 ${isSelected ? 'bg-white/8 border-l-2 border-cyan-500' : 'hover:bg-white/5'}`}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-cyan-600/20 border border-cyan-500/20 flex items-center justify-center shrink-0">
                                            <span className="text-cyan-300 text-[10px] font-bold">{getInitials(u)}</span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium text-slate-100 truncate">{u.fistName} {u.lastName}</p>
                                            {getProfessionName(u) && (
                                                <p className="text-[10px] text-slate-500 truncate">{getProfessionName(u)}</p>
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Groups section */}
                    <div className="px-3 pt-3 pb-1">
                        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5 px-1">
                            <Hash className="w-3 h-3" />
                            Groupes
                        </p>
                        {filteredGroups.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-6 text-slate-600">
                                <Hash className="w-8 h-8 mb-2 text-slate-700" />
                                <p className="text-xs">Aucun groupe</p>
                            </div>
                        ) : (
                            filteredGroups.map((g) => {
                                const isSelected = conversationType === 'group' && selectedGroup?.id === g.id;
                                return (
                                    <button
                                        key={g.id}
                                        onClick={() => selectGroupConversation(g)}
                                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors duration-150 cursor-pointer mb-0.5 ${isSelected ? 'bg-white/8 border-l-2 border-cyan-500' : 'hover:bg-white/5'}`}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-white/7 border border-white/10 flex items-center justify-center shrink-0">
                                            <Hash className="w-3.5 h-3.5 text-slate-400" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium text-slate-100 truncate">{g.name}</p>
                                            <p className="text-[10px] text-slate-500 truncate">{g.members.length} membre(s)</p>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-20 bg-slate-950/60 backdrop-blur-sm sm:hidden cursor-pointer"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* ── MAIN AREA ── */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* Mobile top bar */}
                <div className="sm:hidden h-14 flex items-center justify-between px-4 bg-white/3 border-b border-white/8 shrink-0">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 rounded-lg hover:bg-white/7 text-slate-400 hover:text-slate-200 transition-colors duration-150 cursor-pointer flex items-center gap-2"
                    >
                        <Menu className="w-5 h-5" />
                        <span className="text-sm font-medium text-slate-300">Conversations</span>
                    </button>
                    {hasConversation && (
                        <span className="text-[10px] text-slate-500">Swipe ← pour la discussion</span>
                    )}
                </div>

                {!hasConversation ? (
                    /* Empty state */
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600 select-none">
                        <div className="w-16 h-16 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center mb-4">
                            <MessageSquare className="w-7 h-7 text-slate-600" />
                        </div>
                        <p className="text-base font-semibold text-slate-400">Aucune conversation</p>
                        <p className="text-sm text-slate-600 mt-1">Choisissez un contact ou un groupe</p>
                    </div>
                ) : (
                    <div className="flex flex-col flex-1 min-h-0">
                        {/* Conversation header */}
                        {conversationHeader()}

                        {/* Messages area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {loading ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="w-7 h-7 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <p className="text-sm text-slate-500">Aucun message. Commencez la conversation !</p>
                                </div>
                            ) : (
                                messages.map((msg, index) => (
                                    <div key={index} className={`flex items-end gap-2 ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
                                        {/* Other: avatar */}
                                        {!msg.isOwn && (
                                            <div className="w-6 h-6 rounded-full bg-white/7 border border-white/10 flex items-center justify-center shrink-0 mb-0.5">
                                                <UserCircle className="w-4 h-4 text-slate-500" />
                                            </div>
                                        )}

                                        <div className={`flex flex-col ${msg.isOwn ? 'items-end' : 'items-start'}`}>
                                            {!msg.isOwn && (
                                                <span className="text-[10px] text-slate-500 mb-1 ml-1">{msg.senderName}</span>
                                            )}
                                            <div className={msg.isOwn
                                                ? 'bg-cyan-600/80 text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[75%] text-sm leading-relaxed'
                                                : 'bg-white/7 text-slate-100 rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[75%] text-sm leading-relaxed'
                                            }>
                                                {msg.content}
                                            </div>
                                            <span className="text-[10px] text-slate-600 mt-1 mx-1">{formatTime(msg.timestamp)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input area */}
                        <div className="bg-white/4 border-t border-white/8 p-4 flex items-end gap-3 shrink-0">
                            <input
                                type="text"
                                placeholder="Écrire un message…"
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="flex-1 bg-white/6 border border-white/12 rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 text-sm resize-none transition-all duration-150"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!messageInput.trim()}
                                aria-label="Envoyer"
                                className="p-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl transition-colors duration-150 shrink-0 cursor-pointer"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── GROUP DETAILS MODAL ── */}
            {showGroupDetails && selectedGroup && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="w-full max-w-md backdrop-blur-2xl bg-[#0D1526] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">

                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8 shrink-0">
                            <h2 className="text-base font-semibold text-slate-50">Détails du groupe</h2>
                            <button
                                onClick={() => setShowGroupDetails(false)}
                                className="p-1.5 rounded-lg hover:bg-white/7 text-slate-400 hover:text-slate-200 transition-colors duration-150 cursor-pointer"
                                aria-label="Fermer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="p-6 space-y-5 overflow-y-auto flex-1">
                            {/* Group identity */}
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                                    <Hash className="w-6 h-6 text-cyan-400" />
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-slate-50">{selectedGroup.name}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Créé par {selectedGroup.createdBy.firstName} {selectedGroup.createdBy.lastName}
                                    </p>
                                </div>
                            </div>

                            {/* Members list */}
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                                    {selectedGroup.members.length} membre(s)
                                </p>
                                <div className="space-y-1 border border-white/8 rounded-xl overflow-hidden">
                                    {selectedGroup.members.map((member) => {
                                        const isCreator = member.userId === selectedGroup.createdById;
                                        return (
                                            <div key={member.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/4 transition-colors duration-150">
                                                <div className="w-8 h-8 rounded-full bg-cyan-600/20 border border-cyan-500/20 flex items-center justify-center shrink-0">
                                                    <span className="text-cyan-300 text-[10px] font-bold">
                                                        {(member.user.firstName?.[0] || '').toUpperCase()}{(member.user.lastName?.[0] || '').toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm text-slate-100 truncate">
                                                        {member.user.firstName} {member.user.lastName}
                                                        {member.userId === user?.id && <span className="text-cyan-400 ml-1">(vous)</span>}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 truncate">{member.user.email}</p>
                                                </div>
                                                {isCreator && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                                        Admin
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className="flex items-center justify-end px-6 py-4 border-t border-white/8 shrink-0">
                            <button
                                onClick={() => setShowGroupDetails(false)}
                                className="px-5 py-2.5 rounded-xl bg-white/7 hover:bg-white/12 text-slate-200 text-sm font-medium transition-colors duration-150 cursor-pointer"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── CREATE GROUP MODAL ── */}
            {showCreateGroup && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="w-full max-w-md backdrop-blur-2xl bg-[#0D1526] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">

                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8 shrink-0">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-cyan-400" />
                                <h2 className="text-base font-semibold text-slate-50">Nouveau groupe</h2>
                            </div>
                            <button
                                onClick={() => { setShowCreateGroup(false); setNewGroupName(''); setSelectedMemberIds([]); setMemberSearchQuery(''); }}
                                className="p-1.5 rounded-lg hover:bg-white/7 text-slate-400 hover:text-slate-200 transition-colors duration-150 cursor-pointer"
                                aria-label="Fermer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="p-6 space-y-5 overflow-y-auto flex-1">
                            {/* Group name */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                                    Nom du groupe
                                </label>
                                <input
                                    type="text"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    placeholder="Ex : Équipe cardiologie…"
                                    className="w-full bg-white/6 border border-white/12 rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 text-sm transition-all duration-150"
                                />
                            </div>

                            {/* Member selection */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                                    Membres ({selectedMemberIds.length} sélectionné(s))
                                </label>

                                {/* Member search */}
                                <div className="relative mb-2">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                                    <input
                                        type="text"
                                        value={memberSearchQuery}
                                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                                        placeholder="Rechercher des membres…"
                                        className="w-full bg-white/6 border border-white/12 rounded-xl pl-8 pr-3 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 text-sm transition-all duration-150"
                                    />
                                </div>

                                {/* Selected chips */}
                                {selectedMemberIds.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {selectedMemberIds.map((id) => {
                                            const u = users.find((usr) => usr.id === id);
                                            if (!u) return null;
                                            return (
                                                <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs">
                                                    {u.fistName} {u.lastName}
                                                    <button
                                                        onClick={() => toggleMember(id)}
                                                        className="hover:text-white transition-colors cursor-pointer ml-0.5"
                                                        aria-label={`Retirer ${u.fistName}`}
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Users list */}
                                <div className="max-h-44 overflow-y-auto border border-white/8 rounded-xl">
                                    {memberFilteredUsers.map((u) => {
                                        const isChecked = selectedMemberIds.includes(u.id);
                                        return (
                                            <button
                                                key={u.id}
                                                onClick={() => toggleMember(u.id)}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 cursor-pointer ${isChecked ? 'bg-cyan-600/10' : 'hover:bg-white/5'}`}
                                            >
                                                {/* Checkbox */}
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors duration-150 ${isChecked ? 'bg-cyan-600 border-cyan-600' : 'border-white/20'}`}>
                                                    {isChecked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                                                </div>
                                                {/* Avatar */}
                                                <div className="w-7 h-7 rounded-full bg-cyan-600/20 border border-cyan-500/20 flex items-center justify-center shrink-0">
                                                    <span className="text-cyan-300 text-[10px] font-bold">{getInitials(u)}</span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm text-slate-100 truncate">{u.fistName} {u.lastName}</p>
                                                    {getProfessionName(u) && (
                                                        <p className="text-[10px] text-slate-500 truncate">{getProfessionName(u)}</p>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/8 shrink-0">
                            <button
                                onClick={() => { setShowCreateGroup(false); setNewGroupName(''); setSelectedMemberIds([]); setMemberSearchQuery(''); }}
                                className="px-5 py-2.5 rounded-xl bg-white/7 hover:bg-white/12 text-slate-200 text-sm font-medium transition-colors duration-150 cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleCreateGroup}
                                disabled={!newGroupName.trim() || selectedMemberIds.length === 0}
                                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors duration-150 cursor-pointer"
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
