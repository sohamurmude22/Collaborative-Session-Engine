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
    <div className="flex flex-col h-full bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-md">
      {/* Chat Header */}
      <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-600/20 text-sky-400 border border-sky-500/30">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <span>In-Session Live Chat</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </h3>
            <p className="text-[10px] text-slate-400">
              Communicate directly while session is ON
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
          {messages.length} msgs
        </span>
      </div>

      {/* Messages Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-500 text-xs">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
            <p className="font-medium">No messages yet</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Ask questions or collaborate in real time.
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
                  <span className="font-semibold text-slate-300">
                    {isMe ? 'You' : msg.senderName}
                  </span>
                  <span
                    className={`px-1 py-0.2 rounded text-[9px] font-medium ${
                      isInterviewer
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    }`}
                  >
                    {isInterviewer ? 'Host' : 'Candidate'}
                  </span>
                  <span className="text-slate-500 text-[9px]">{formatTime(msg.timestamp)}</span>
                </div>

                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs break-words shadow-sm leading-relaxed ${
                    isMe
                      ? 'bg-indigo-600 text-white rounded-tr-xs'
                      : 'bg-slate-800 text-slate-100 border border-slate-700/80 rounded-tl-xs'
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
      <form onSubmit={handleSubmit} className="p-2 bg-slate-900/90 border-t border-slate-800 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type message and press Enter..."
          className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-40 disabled:hover:bg-indigo-600 cursor-pointer shadow-sm shadow-indigo-600/30 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
