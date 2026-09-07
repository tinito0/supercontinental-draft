import React, { memo, useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { APP_ID, DEFAULT_LOGO } from '../utils/constants.js';

function formatMessageTime(timestamp, isoString) {
  if (timestamp && typeof timestamp.toDate === 'function') {
    const d = timestamp.toDate();
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
  if (isoString) {
    const d = new Date(isoString);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    }
  }
  return '';
}

export const ProposalChat = memo(function ProposalChat({
  offerId,
  userId,
  userProfile,
  isClosed = false,
  defaultExpanded = false,
}) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!offerId) return;

    const messagesQuery = query(
      collection(db, `artifacts/${APP_ID}/public/data/offers/${offerId}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(
      messagesQuery,
      (snap) => {
        const msgs = [];
        snap.forEach((docSnap) => {
          msgs.push({ id: docSnap.id, ...docSnap.data() });
        });
        setMessages(msgs);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error in proposal chat snapshot:', err);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [offerId]);

  useEffect(() => {
    if (isExpanded && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isExpanded]);

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isSending || isClosed) return;

    setIsSending(true);
    try {
      const messagesRef = collection(db, `artifacts/${APP_ID}/public/data/offers/${offerId}/messages`);
      await addDoc(messagesRef, {
        senderId: userId || userProfile?.uid || '',
        senderTeamName: userProfile?.teamName || 'Manager',
        senderTeamLogo: userProfile?.logoUrl || '',
        text: trimmed,
        createdAt: serverTimestamp(),
        createdAtIso: new Date().toISOString(),
      });
      setText('');
    } catch (err) {
      console.error('Error sending negotiation message:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/40 overflow-hidden shadow-inner">
      {/* Header / Toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="w-full px-3 py-2.5 flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.06] transition text-left"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-black uppercase tracking-wider text-gray-300">
            Chat de negociación
          </span>
          {messages.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {messages.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-gray-500 text-xs font-bold">
          <span>{isExpanded ? 'Ocultar' : 'Ver chat'}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Body */}
      {isExpanded && (
        <div className="p-3 border-t border-white/5 space-y-3">
          {/* Message List */}
          <div className="max-h-56 min-h-[80px] overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
            {isLoading ? (
              <p className="text-center text-xs text-gray-600 py-4 font-semibold">Cargando mensajes...</p>
            ) : messages.length === 0 ? (
              <p className="text-center text-xs text-gray-500 py-4 font-medium italic">
                {isClosed
                  ? 'No hubo mensajes en esta negociación.'
                  : 'Todavía no hay mensajes. Podés negociar el precio o condiciones acá.'}
              </p>
            ) : (
              messages.map((msg) => {
                const isMine = msg.senderId === userId || (userProfile?.uid && msg.senderId === userProfile.uid);
                const timeStr = formatMessageTime(msg.createdAt, msg.createdAtIso);

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    {!isMine && (
                      <div className="flex items-center gap-1.5 mb-1 pl-1">
                        <img
                          src={msg.senderTeamLogo || DEFAULT_LOGO}
                          alt=""
                          className="w-4 h-4 rounded object-contain bg-black/40"
                          onError={(e) => { e.target.src = DEFAULT_LOGO; }}
                        />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wide truncate max-w-[150px]">
                          {msg.senderTeamName || 'Rival'}
                        </span>
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-xs break-words shadow-sm ${
                        isMine
                          ? 'bg-cyan-600/25 border border-cyan-500/40 text-cyan-50'
                          : 'bg-white/[0.06] border border-white/10 text-gray-200'
                      }`}
                    >
                      <p className="leading-snug">{msg.text}</p>
                      {timeStr && (
                        <span className={`block text-[9px] mt-1 text-right font-medium ${
                          isMine ? 'text-cyan-300/70' : 'text-gray-500'
                        }`}>
                          {timeStr}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer / Closed Banner */}
          {isClosed ? (
            <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5 text-gray-500 text-[11px] font-bold">
              <Lock className="w-3.5 h-3.5" />
              <span>Esta negociación fue cerrada. Chat en modo solo lectura.</span>
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escribí un mensaje..."
                maxLength={400}
                disabled={isSending}
                className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-500 transition placeholder:text-gray-600"
              />
              <button
                type="submit"
                disabled={!text.trim() || isSending}
                className="w-8 h-8 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                title="Enviar mensaje"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
});
