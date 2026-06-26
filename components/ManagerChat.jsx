import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Send, X, MessageSquareText, Handshake, HelpCircle, Image, Search, ShieldAlert } from 'lucide-react';
import { DEFAULT_LOGO } from '../utils/constants.js';
import { getTeamMentionOptions, hasTransferIntent, normalizeChatText } from '../utils/managerChatUtils.js';

const CHAT_TUTORIAL_KEY = 'managerChatTutorialSeen';
const CHAT_SPAM_KEY = 'managerChatSendTimes';
const MAX_MESSAGES_PER_MINUTE = 6;
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY;
const KLIPY_API_KEY = import.meta.env.VITE_KLIPY_API_KEY;

function getMessageDate(value) {
  if (!value) return '';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export const ManagerChat = memo(function ManagerChat({
  isVisible,
  onClose,
  messages,
  allTeams,
  userId,
  userProfile,
  onSendMessage,
  chatId = 'manager',
}) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifQuery, setGifQuery] = useState('futbol argentina');
  const [gifResults, setGifResults] = useState([]);
  const [gifUrl, setGifUrl] = useState('');
  const [gifProvider, setGifProvider] = useState(GIPHY_API_KEY ? 'giphy' : 'klipy');
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);
  const [spamWarning, setSpamWarning] = useState('');
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const messagesEndRef = useRef(null);
  const scrollRef = useRef(null);
  const wasAtBottomRef = useRef(true);
  const restoredScrollRef = useRef(false);
  const scrollKey = `chat_scroll_${chatId}`;
  const bottomKey = `${scrollKey}_wasAtBottom`;

  const teams = useMemo(() => getTeamMentionOptions(allTeams, userId), [allTeams, userId]);
  const allMentionTeams = useMemo(() => getTeamMentionOptions(allTeams, null), [allTeams]);
  const mentionMatch = text.match(/(?:^|\s)@([a-z0-9_-]*)$/i);
  const mentionQuery = normalizeChatText(mentionMatch?.[1] || '');
  const mentionSuggestions = mentionMatch
    ? teams.filter(team => team.handle.includes(mentionQuery) || normalizeChatText(team.teamName).includes(mentionQuery)).slice(0, 5)
    : [];

  useEffect(() => {
    setActiveMentionIndex(0);
  }, [mentionQuery, mentionSuggestions.length]);

  useEffect(() => {
    if (!isVisible) return;
    const seen = localStorage.getItem(CHAT_TUTORIAL_KEY) === 'true';
    if (!seen) setShowTutorial(true);
  }, [isVisible]);

  const updateBottomState = () => {
    const el = scrollRef.current;
    if (!el) return true;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isAtBottom = distanceFromBottom < 56;
    wasAtBottomRef.current = isAtBottom;
    return isAtBottom;
  };

  const persistScrollPosition = () => {
    const el = scrollRef.current;
    if (!el) return;
    const isAtBottom = updateBottomState();
    sessionStorage.setItem(scrollKey, String(el.scrollTop));
    sessionStorage.setItem(bottomKey, JSON.stringify(isAtBottom));
  };

  useEffect(() => {
    if (!isVisible) {
      restoredScrollRef.current = false;
      return;
    }

    const storedScroll = sessionStorage.getItem(scrollKey);
    const storedWasAtBottom = sessionStorage.getItem(bottomKey);
    wasAtBottomRef.current = storedWasAtBottom == null ? true : storedWasAtBottom === 'true';

    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      if (storedScroll != null && !wasAtBottomRef.current) {
        el.scrollTop = Number(storedScroll) || 0;
      } else {
        messagesEndRef.current?.scrollIntoView({ block: 'end' });
      }
      restoredScrollRef.current = true;
    });
  }, [isVisible, chatId]);

  useEffect(() => {
    if (!isVisible || !restoredScrollRef.current) return;
    if (wasAtBottomRef.current) {
      requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ block: 'end' }));
    }
  }, [isVisible, messages.length]);

  useEffect(() => {
    if (!isVisible) return undefined;
    return () => persistScrollPosition();
  }, [isVisible, scrollKey, bottomKey]);

  useEffect(() => {
    if (!showGifPicker || (!GIPHY_API_KEY && !KLIPY_API_KEY)) return;
    const timeout = setTimeout(async () => {
      const query = gifQuery.trim();
      if (!query) return;
      setIsLoadingGifs(true);
      try {
        const params = new URLSearchParams({ q: query, limit: '12' });
        let url = '';
        if (gifProvider === 'giphy' && GIPHY_API_KEY) {
          params.set('api_key', GIPHY_API_KEY);
          params.set('rating', 'pg-13');
          params.set('lang', 'es');
          url = `https://api.giphy.com/v1/gifs/search?${params.toString()}`;
        } else if (KLIPY_API_KEY) {
          params.set('key', KLIPY_API_KEY);
          params.set('locale', 'es_AR');
          params.set('media_filter', 'gif,tinygif');
          url = `https://api.klipy.com/v2/search?${params.toString()}`;
        }
        if (!url) return;
        const response = await fetch(url);
        const data = await response.json();
        const results = (data.data || data.results || []).map(item => {
          if (gifProvider === 'giphy') {
            return {
              id: item.id,
              title: item.title || 'GIF',
              previewUrl: item.images?.fixed_width_small?.url || item.images?.preview_gif?.url,
              gifUrl: item.images?.original?.url || item.images?.fixed_height?.url,
            };
          }
          return {
            id: item.id,
            title: item.content_description || item.title || 'GIF',
            previewUrl: item.media_formats?.tinygif?.url || item.media_formats?.gif?.url,
            gifUrl: item.media_formats?.gif?.url || item.media_formats?.tinygif?.url,
          };
        }).filter(item => item.previewUrl && item.gifUrl);
        setGifResults(results);
      } catch (error) {
        console.error('Error loading gifs:', error);
        setGifResults([]);
      } finally {
        setIsLoadingGifs(false);
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [showGifPicker, gifQuery, gifProvider]);

  if (!isVisible) return null;

  const transferIntent = hasTransferIntent(text);
  const selectedGifUrl = gifUrl.trim();

  const closeTutorial = () => {
    localStorage.setItem(CHAT_TUTORIAL_KEY, 'true');
    setShowTutorial(false);
  };

  const canSendNow = () => {
    const now = Date.now();
    const previous = JSON.parse(localStorage.getItem(CHAT_SPAM_KEY) || '[]');
    const recent = previous.filter(timestamp => now - timestamp < 60000);
    if (recent.length >= MAX_MESSAGES_PER_MINUTE) {
      setSpamWarning('Baja un cambio, maestro. Maximo 6 mensajes por minuto, que esto no es remate de feria.');
      return false;
    }
    localStorage.setItem(CHAT_SPAM_KEY, JSON.stringify([...recent, now]));
    setSpamWarning('');
    return true;
  };

  const handleClose = () => {
    persistScrollPosition();
    onClose();
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if ((!trimmed && !selectedGifUrl) || isSending) return;
    if (!canSendNow()) return;
    setIsSending(true);
    const ok = await onSendMessage(trimmed, selectedGifUrl);
    if (ok) {
      setText('');
      setGifUrl('');
      setShowGifPicker(false);
    }
    setIsSending(false);
  };

  const handleComposerKeyDown = (e) => {
    if (mentionSuggestions.length > 0 && e.key === 'Tab') {
      e.preventDefault();
      setActiveMentionIndex(prev => (prev + (e.shiftKey ? -1 : 1) + mentionSuggestions.length) % mentionSuggestions.length);
      return;
    }
    if (mentionSuggestions.length > 0 && e.key === 'Enter') {
      e.preventDefault();
      insertMention(mentionSuggestions[activeMentionIndex] || mentionSuggestions[0]);
      return;
    }
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    handleSend(e);
  };

  const insertMention = (team) => {
    setText(prev => {
      if (mentionMatch) {
        return prev.replace(/(?:^|\s)@[a-z0-9_-]*$/i, match => `${match.startsWith(' ') ? ' ' : ''}@${team.handle} `);
      }
      const spacer = prev && !prev.endsWith(' ') ? ' ' : '';
      return `${prev}${spacer}@${team.handle} `;
    });
  };

  const selectGif = (result) => {
    if (result?.gifUrl) setGifUrl(result.gifUrl);
  };

  const renderMessageText = (message) => {
    const mentionedIds = message.mentionedTeamIds || [];
    const mentionedTeams = allMentionTeams.filter(team => mentionedIds.includes(team.id));
    if (!message.text) return null;
    const parts = String(message.text).split(/(@[a-z0-9_-]+)/gi);
    return parts.map((part, idx) => {
      const match = mentionedTeams.find(team => part.toLowerCase() === `@${team.handle}`);
      if (!match) return <React.Fragment key={idx}>{part}</React.Fragment>;
      return <strong key={idx} className="font-black italic text-cyan-200">{part}</strong>;
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200" onClick={handleClose}>
      <div className="w-full sm:max-w-3xl h-[100dvh] sm:h-[78vh] bg-gray-950 border border-white/10 sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col relative" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gray-900/90">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-300">
              <MessageSquareText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black uppercase tracking-wide text-white">Chat de Managers</h2>
              <p className="text-[11px] text-gray-500 font-semibold truncate">Para negociar, apurar un poquito y dejar todo por escrito.</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowTutorial(true)} className="w-11 h-11 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition" title="Ver tutorial y reglas">
              <HelpCircle className="w-5 h-5" />
            </button>
            <button onClick={handleClose} className="w-11 h-11 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <section className="flex-1 min-h-0 min-w-0 flex flex-col">
            <div
              ref={scrollRef}
              onScroll={updateBottomState}
              onWheel={e => e.stopPropagation()}
              onTouchMove={e => e.stopPropagation()}
              className="manager-chat-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4 space-y-2 custom-scrollbar"
            >
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center px-6">
                  <p className="text-sm text-gray-500 font-semibold">Todavia no hay mensajes. Tira una propuesta, menciona a un manager o manda un GIF con altura, no seas tibio.</p>
                </div>
              ) : (
                messages.map(message => {
                  const mine = message.senderId === userId;
                  const isTransfer = message.transferIntent;
                  return (
                    <div key={message.id} className={`manager-chat-message ${mine ? 'manager-chat-message--mine' : 'manager-chat-message--received'}`}>
                      <div className={`manager-chat-bubble rounded-xl px-3 py-2 border ${mine ? 'bg-cyan-600/16 border-cyan-500/30' : 'bg-white/[0.04] border-white/10'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <img src={message.senderLogoUrl || DEFAULT_LOGO} alt="" className="w-5 h-5 rounded object-contain bg-black/30" onError={e => { e.target.src = DEFAULT_LOGO; }} />
                          <span className="text-[11px] font-black uppercase tracking-wide text-white truncate">{message.senderTeamName || 'Manager'}</span>
                          {isTransfer && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                              <Handshake className="w-3 h-3" /> Traspaso
                            </span>
                          )}
                        </div>
                        {message.text && <p className="text-sm text-gray-100 whitespace-pre-wrap break-words leading-snug">{renderMessageText(message)}</p>}
                        {message.gifUrl && (
                          <img
                            src={message.gifUrl}
                            alt="GIF enviado"
                            loading="lazy"
                            className="manager-chat-gif mt-2 rounded-lg border border-white/10 object-contain bg-black/30"
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                        )}
                        <div className="text-[10px] text-gray-500 text-right mt-1">{getMessageDate(message.createdAt)}</div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="manager-chat-composer shrink-0 p-3 border-t border-white/10 bg-gray-900/95">
              {transferIntent && (
                <div className="mb-2 inline-flex items-center gap-2 text-[11px] text-emerald-300 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
                  <Handshake className="w-3.5 h-3.5" /> Se marcara como conversacion de traspaso.
                </div>
              )}
              {spamWarning && (
                <div className="mb-2 inline-flex items-center gap-2 text-[11px] text-amber-300 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                  <ShieldAlert className="w-3.5 h-3.5" /> {spamWarning}
                </div>
              )}
              {showGifPicker && (
                <div className="mb-3 rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        value={gifQuery}
                        onChange={e => setGifQuery(e.target.value)}
                        placeholder={`Buscar GIF en ${gifProvider === 'giphy' ? 'GIPHY' : 'KLIPY'}...`}
                        className="w-full bg-gray-950 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-cyan-500/60"
                      />
                    </div>
                    <button type="button" onClick={() => setShowGifPicker(false)} className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {(GIPHY_API_KEY || KLIPY_API_KEY) ? (
                    <>
                    <div className="flex gap-2 mb-3">
                      {GIPHY_API_KEY && <button type="button" onClick={() => setGifProvider('giphy')} className={`px-3 py-1.5 rounded-lg text-[11px] font-black border ${gifProvider === 'giphy' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200' : 'border-white/10 text-gray-500 hover:text-white'}`}>GIPHY</button>}
                      {KLIPY_API_KEY && <button type="button" onClick={() => setGifProvider('klipy')} className={`px-3 py-1.5 rounded-lg text-[11px] font-black border ${gifProvider === 'klipy' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200' : 'border-white/10 text-gray-500 hover:text-white'}`}>KLIPY</button>}
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {isLoadingGifs && <p className="col-span-full text-xs text-gray-500 font-bold">Buscando magia barata...</p>}
                      {!isLoadingGifs && gifResults.map(result => {
                        const selected = selectedGifUrl === result.gifUrl;
                        return (
                          <button
                            key={result.id}
                            type="button"
                            onClick={() => selectGif(result)}
                            className={`aspect-video rounded-lg overflow-hidden border ${selected ? 'border-cyan-400 ring-2 ring-cyan-400/30' : 'border-white/10 hover:border-white/30'} bg-gray-900`}
                          >
                            <img src={result.previewUrl} alt={result.title || 'GIF'} className="w-full h-full object-cover" loading="lazy" />
                          </button>
                        );
                      })}
                    </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-amber-300 font-bold">Falta configurar VITE_GIPHY_API_KEY o VITE_KLIPY_API_KEY. Mientras tanto, pega una URL de GIF directo y sale igual.</p>
                      <input
                        value={gifUrl}
                        onChange={e => setGifUrl(e.target.value)}
                        placeholder="https://media.giphy.com/... o https://media.klipy.com/..."
                        className="w-full bg-gray-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-500/60"
                      />
                    </div>
                  )}
                  {selectedGifUrl && (
                    <div className="mt-3 flex items-center gap-3">
                      <img src={selectedGifUrl} alt="GIF seleccionado" className="h-14 rounded-lg border border-white/10 bg-black/30" />
                      <button type="button" onClick={() => setGifUrl('')} className="text-xs text-red-300 hover:text-red-200 font-bold">Sacar GIF</button>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-end gap-2">
                <div className="relative flex-1">
                  {mentionSuggestions.length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-white/10 bg-gray-950 shadow-2xl overflow-hidden">
                      {mentionSuggestions.map((team, idx) => (
                        <button
                          key={team.id}
                          type="button"
                          onMouseEnter={() => setActiveMentionIndex(idx)}
                          onClick={() => insertMention(team)}
                          className={`w-full px-3 py-2 flex items-center gap-2 text-left transition ${idx === activeMentionIndex ? 'bg-cyan-500/10' : 'hover:bg-white/[0.06]'}`}
                        >
                          <img src={team.logoUrl || DEFAULT_LOGO} alt="" className="w-6 h-6 rounded object-contain bg-black/30" onError={e => { e.target.src = DEFAULT_LOGO; }} />
                          <span className="text-xs font-black italic text-cyan-100">@{team.handle}</span>
                          <span className="text-xs text-gray-500 font-bold truncate">{team.teamName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder={`Escribi como ${userProfile?.teamName || 'manager'}... @aspra y autocomplete, corta.`}
                    className="w-full max-h-28 min-h-[44px] resize-none bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/60 placeholder:text-gray-600"
                    maxLength={500}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowGifPicker(prev => !prev)}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition ${showGifPicker || selectedGifUrl ? 'bg-fuchsia-600 text-white' : 'bg-white/[0.05] text-gray-400 hover:text-white hover:bg-white/[0.08]'}`}
                  title="Mandar GIF"
                >
                  <Image className="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  disabled={(!text.trim() && !selectedGifUrl) || isSending}
                  className="w-11 h-11 rounded-xl bg-cyan-600 text-white flex items-center justify-center hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title="Enviar"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </section>
        </div>

        {showTutorial && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-cyan-500/20 bg-gray-950 shadow-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 bg-cyan-500/10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Chat de Managers</h3>
                    <p className="text-sm text-cyan-100/80 font-semibold mt-1">Para hablar de traspasos, tantear jugadores y dejar constancia antes de que alguno se haga el distraido.</p>
                  </div>
                  <button onClick={closeTutorial} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-cyan-300 mb-2">Como se usa</h4>
                  <ul className="space-y-2 text-sm text-gray-300 font-medium">
                    <li>Escribi <span className="text-white font-black">@aspra</span> o las primeras letras y elegi el autocomplete. Si engancha bien, queda en negrita e italica y llega notificacion.</li>
                    <li>Si escribis palabras como oferta, traspaso, vender o negociar, el mensaje queda marcado como tema de traspaso.</li>
                    <li>El boton de GIF busca en GIPHY o KLIPY. Si no hay clave configurada, pega una URL de GIF y listo, modo potrero.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-amber-300 mb-2">Reglas anti-spam</h4>
                  <ul className="space-y-2 text-sm text-gray-300 font-medium">
                    <li>Maximo 6 mensajes por minuto por navegador. Respira, Bielsa tampoco manda todo junto.</li>
                    <li>No repetir el mismo mensaje en loop. Si la oferta es mala, spamearla no la hace Champions.</li>
                    <li>GIFs si, catarata eterna no. Uno bueno pega mas que diez medio pelo.</li>
                    <li>Chicana futbolera vale; bardo personal, insultos pesados o romper las bolas porque si, afuera.</li>
                  </ul>
                </div>
                <button onClick={closeTutorial} className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-wide transition">
                  Entendido, vamos a negociar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
