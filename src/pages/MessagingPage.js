import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Send, MessageSquare, User, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// ─── Shared: Chat Window ──────────────────────────────────────────────────────

const ChatWindow = ({ messages, currentUserId, otherUser, onSend, sending }) => {
    const [text, setText] = useState('');
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onSend(text.trim());
        setText('');
    };

    const formatTime = (ts) => {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (ts) => {
        const d = new Date(ts);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === today.toDateString()) return 'Today';
        if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Group messages by date
    const grouped = [];
    let lastDate = null;
    messages.forEach((msg) => {
        const d = formatDate(msg.created_at);
        if (d !== lastDate) {
            grouped.push({ type: 'date', label: d });
            lastDate = d;
        }
        grouped.push({ type: 'msg', msg });
    });

    return (
        <div className="flex flex-col h-full">
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card">
                <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                    {otherUser?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                    <p className="font-semibold text-sm">{otherUser?.name || '…'}</p>
                    <p className="text-xs text-muted-foreground capitalize">{otherUser?.role || ''}</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
                {grouped.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                        <MessageSquare className="h-10 w-10 opacity-30" />
                        <p className="text-sm">No messages yet. Say hello!</p>
                    </div>
                )}
                {grouped.map((item, i) => {
                    if (item.type === 'date') {
                        return (
                            <div key={`date-${i}`} className="flex items-center gap-3 my-4">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-xs text-muted-foreground px-2">{item.label}</span>
                                <div className="flex-1 h-px bg-border" />
                            </div>
                        );
                    }
                    const { msg } = item;
                    const isMine = msg.sender_id === currentUserId;
                    return (
                        <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
                            <div
                                className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${isMine
                                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                                    : 'bg-muted text-foreground rounded-bl-sm'
                                    }`}
                            >
                                <p className="leading-relaxed break-words">{msg.content}</p>
                                <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground'}`}>
                                    {formatTime(msg.created_at)}
                                </p>
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="flex items-center gap-3 px-6 py-4 border-t border-border bg-card">
                <Input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type a message…"
                    className="flex-1"
                    autoComplete="off"
                    disabled={sending}
                />
                <Button type="submit" disabled={!text.trim() || sending} data-testid="send-message-btn">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
            </form>
        </div>
    );
};

// ─── Employee View ────────────────────────────────────────────────────────────

const EmployeeMessaging = ({ token, currentUser }) => {
    const [admin, setAdmin] = useState(null);
    const [messages, setMessages] = useState([]);
    const [sending, setSending] = useState(false);

    const fetchAdmin = useCallback(async () => {
        try {
            const res = await axios.get(`${API}/messages/admin`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setAdmin(res.data);
        } catch { }
    }, [token]);

    const fetchMessages = useCallback(async () => {
        if (!admin) return;
        try {
            const res = await axios.get(`${API}/messages/${admin.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setMessages(res.data);
            // Mark as read
            await axios.put(`${API}/messages/read/${admin.id}`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
        } catch { }
    }, [token, admin]);

    useEffect(() => { fetchAdmin(); }, [fetchAdmin]);
    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 5000);
        return () => clearInterval(interval);
    }, [fetchMessages]);

    const handleSend = async (content) => {
        if (!admin) return;
        setSending(true);
        try {
            const res = await axios.post(
                `${API}/messages`,
                { receiver_id: admin.id, content },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessages((prev) => [...prev, res.data]);
        } catch { }
        setSending(false);
    };

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 140px)' }}>
            <ChatWindow
                messages={messages}
                currentUserId={currentUser.id}
                otherUser={admin}
                onSend={handleSend}
                sending={sending}
            />
        </div>
    );
};

// ─── Admin View ───────────────────────────────────────────────────────────────

const AdminMessaging = ({ token, currentUser }) => {
    const [conversations, setConversations] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [messages, setMessages] = useState([]);
    const [sending, setSending] = useState(false);
    const [loadingConversations, setLoadingConversations] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);

    const fetchConversations = useCallback(async () => {
        try {
            const res = await axios.get(`${API}/messages/conversations`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setConversations(res.data);
        } catch { } finally {
            setLoadingConversations(false);
        }
    }, [token]);

    const fetchMessages = useCallback(async () => {
        if (!selectedEmployee) return;
        setLoadingMessages(true);
        try {
            const res = await axios.get(`${API}/messages/${selectedEmployee.user_id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setMessages(res.data);
            // Mark as read
            await axios.put(`${API}/messages/read/${selectedEmployee.user_id}`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            // Refresh conversations to clear badge
            fetchConversations();
        } catch { } finally {
            setLoadingMessages(false);
        }
    }, [token, selectedEmployee, fetchConversations]);

    useEffect(() => {
        fetchConversations();
        const interval = setInterval(fetchConversations, 5000);
        return () => clearInterval(interval);
    }, [fetchConversations]);

    useEffect(() => {
        // Initial fetch only
        fetchMessages();
        if (!selectedEmployee) return;
        const interval = setInterval(async () => {
            // Background update, no loading spinner
            if (!selectedEmployee) return;
            try {
                const res = await axios.get(`${API}/messages/${selectedEmployee.user_id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const incoming = res.data || [];
                setMessages(incoming);
                // While the chat is open, keep marking incoming messages as read
                const hasUnread = incoming.some(
                    (m) => m.sender_id !== currentUser.id && !m.is_read
                );
                if (hasUnread) {
                    await axios.put(`${API}/messages/read/${selectedEmployee.user_id}`, {}, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    fetchConversations();
                }
            } catch { }
        }, 5000);
        return () => clearInterval(interval);
    }, [fetchMessages, selectedEmployee, token, currentUser.id, fetchConversations]);

    const handleSelectEmployee = (emp) => {
        setSelectedEmployee(emp);
        setMessages([]);
    };

    const handleSend = async (content) => {
        if (!selectedEmployee) return;
        setSending(true);
        try {
            const res = await axios.post(
                `${API}/messages`,
                { receiver_id: selectedEmployee.user_id, content },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessages((prev) => [...prev, res.data]);
            fetchConversations();
        } catch { }
        setSending(false);
    };

    return (
        <div
            className="bg-card border border-border rounded-xl overflow-hidden flex"
            style={{ height: 'calc(100vh - 140px)' }}
        >
            {/* Left: conversation list */}
            <div className="w-72 border-r border-border flex flex-col flex-shrink-0">
                <div className="px-5 py-4 border-b border-border">
                    <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Conversations</h2>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loadingConversations ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="p-6 text-sm text-muted-foreground text-center">No employees yet.</div>
                    ) : conversations.map((emp) => (
                        <button
                            key={emp.user_id}
                            onClick={() => handleSelectEmployee(emp)}
                            data-testid={`conversation-${emp.user_id}`}
                            className={`w-full flex items-start gap-3 px-5 py-4 hover:bg-muted/30 transition-colors text-left border-b border-border/50 ${selectedEmployee?.user_id === emp.user_id ? 'bg-muted/40' : ''
                                }`}
                        >
                            {/* Avatar */}
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                                {emp.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm truncate">{emp.name}</span>
                                    {emp.unread_count > 0 && (
                                        <span className="ml-2 flex-shrink-0 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                                            {emp.unread_count}
                                        </span>
                                    )}
                                </div>
                                {emp.last_message ? (
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">{emp.last_message}</p>
                                ) : (
                                    <p className="text-xs text-muted-foreground/50 italic mt-0.5">No messages yet</p>
                                )}
                            </div>
                        </button>
                    ))}

                </div>
            </div>

            {/* Right: chat */}
            <div className="flex-1 flex flex-col min-w-0">
                {selectedEmployee ? (
                    loadingMessages && messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        </div>
                    ) : (
                        <ChatWindow
                            messages={messages}
                            currentUserId={currentUser.id}
                            otherUser={{ name: selectedEmployee.name, role: 'employee' }}
                            onSend={handleSend}
                            sending={sending}
                        />
                    )
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                        <User className="h-12 w-12 opacity-20" />
                        <p className="text-sm">Select a conversation to start messaging</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const MessagingPage = () => {
    const { token, user } = useAuth();
    const isAdmin = user?.role === 'admin';

    return (
        <div className="space-y-6" data-testid="messaging-page">
            <div>
                <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                    Messages
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    {isAdmin ? 'Reply to messages from your team.' : 'Send a message to Admin.'}
                </p>
            </div>

            {isAdmin ? (
                <AdminMessaging token={token} currentUser={user} />
            ) : (
                <EmployeeMessaging token={token} currentUser={user} />
            )}
        </div>
    );
};

export default MessagingPage;
