import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, User, Shield, CheckCheck } from 'lucide-react';
import { UserAvatar } from './UserAvatar.js';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  avatarUrl?: string;
  message: string;
  timestamp: number;
}

interface SessionChatProps {
  sessionId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  currentUserAvatarUrl?: string;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

export const SessionChat: React.FC<SessionChatProps> = ({
  sessionId,
  currentUserId,
  currentUserName,
  currentUserRole,
  currentUserAvatarUrl,
  messages,
  onSendMessage
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-white/70 dark:bg-[#0f172a]/70 border border-slate-200/80 dark:border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
      {/* Chat Header */}
      <div className="p-3 bg-slate-50/80 dark:bg-black/30 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 font-heading">
              <span>Session Chat</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Low-latency channel
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-full font-semibold">
          {messages.length} msgs
        </span>
      </div>

      {/* Messages Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {messages.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-400 dark:text-slate-500 text-xs">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">No messages yet</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Collaborate and ask questions in real time.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            const isInterviewer = msg.senderRole === 'INTERVIEWER' || msg.senderRole === 'ADMIN';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {isMe ? 'You' : msg.senderName}
                  </span>
                  <span
                    className={`px-1 py-0.2 rounded text-[9px] font-mono font-medium ${
                      isInterviewer
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                    }`}
                  >
                    {isInterviewer ? 'Host' : 'Peer'}
                  </span>
                  <span className="text-slate-400 text-[9px]">{formatTime(msg.timestamp)}</span>
                </div>

                <div
                  className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs break-words shadow-xs leading-relaxed ${
                    isMe
                      ? 'bg-indigo-600 text-white rounded-tr-xs shadow-indigo-600/20'
                      : 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-white/10 rounded-tl-xs'
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-2.5 bg-slate-50/80 dark:bg-black/40 border-t border-slate-200/80 dark:border-white/10 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Send message to room..."
          className="flex-1 px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-40 cursor-pointer shadow-md shadow-indigo-600/25 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
