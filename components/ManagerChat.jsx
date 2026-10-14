import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Send, X, MessageSquareText, Handshake, HelpCircle, Image, Search, ShieldAlert } from 'lucide-react';
import { BaseModal } from './ui/BaseModal.jsx';
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

  const scrollTimeoutRef = useRef(null);
  const persistScrollPosition = () => {
    const el = scrollRef.current;
    if (!el) return;
    updateBottomState();
    if (scrollTimeoutRef.current) return;
    scrollTimeoutRef.current = setTimeout(() => {
      scrollTimeoutRef.current = null;
      if (!scrollRef.current) return;
      sessionStorage.setItem(scrollKey, String(scrollRef.current.scrollTop));
      sessionStorage.setItem(bottomKey, JSON.stringify(wasAtBottomRef.current));
    }, 150);
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
      return <strong key={idx} className="font-bold italic text-accent-soft">{part}</strong>;
    });
  };

  return (
    <BaseModal
      isOpen={isVisible}
      onClose={handleClose}
      size="xl"
      showClose={false}
      className="!p-0 sm:!max-w-3xl h-[85vh] sm:h-[80vh]"
      contentClassName="!p-0 !overflow-hidden flex flex-col h-full min-h-0"
    >
      <div className="flex flex-col h-full min-h-0 bg-surface">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line/20 bg-surface/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <MessageSquareText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-ink">Chat de Managers</h2>
              <p className="text-xs text-ink-3 truncate">Negociaciones y traspasos directos entre equipos.</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowTutorial(true)} className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-3 hover:text-ink hover:bg-raised transition" title="Ver tutorial y reglas">
              <HelpCircle className="w-4 h-4" />
            </button>
            <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-3 hover:text-ink hover:bg-raised transition">
              <X className="w-4 h-4" />
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
              className="manager-chat-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4 space-y-2 custom-scrollbar bg-black/20"
            >
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center px-6">
                  <p className="text-xs text-ink-3 font-medium">Todavía no hay mensajes en la sala. Empieza una conversación o menciona a otro mánager.</p>
                </div>
              ) : (
                messages.map(message => {
                  const mine = message.senderId === userId;
                  const isTransfer = message.transferIntent;
                  return (
                    <div key={message.id} className={`manager-chat-message ${mine ? 'manager-chat-message--mine' : 'manager-chat-message--received'}`}>
                      <div className={`manager-chat-bubble rounded-xl px-3 py-2 border ${mine ? 'bg-accent text-ink border-accent' : ' bg-surface border-line/20 text-ink'}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <img src={message.senderLogoUrl || DEFAULT_LOGO} alt="" width={16} height={16} className="w-4 h-4 rounded object-contain bg-black/30" onError={e => { e.target.src = DEFAULT_LOGO; }} />
                          <span className={`text-[11px] font-bold truncate ${mine ? 'text-accent-soft' : ' text-ink'}`}>{message.senderTeamName || 'Manager'}</span>
                          {isTransfer && (
                            <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${mine ? 'bg-white/20 text-ink' : ' text-success-soft bg-success/10 border border-success/20'}`}>
                              <Handshake className="w-3 h-3" /> Traspaso
                            </span>
                          )}
                        </div>
                        {message.text && <p className={`text-xs whitespace-pre-wrap break-words leading-relaxed ${mine ? 'text-ink' : ' text-ink-2'}`}>{renderMessageText(message)}</p>}
                        {message.gifUrl && (
                          <img
                            src={message.gifUrl}
                            alt="GIF enviado"
                            loading="lazy"
                            className="manager-chat-gif mt-2 rounded-lg border border-line/[0.12] object-contain bg-black/30"
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                        )}
                        <div className={`text-[10px] text-right mt-1 font-medium ${mine ? 'text-accent-soft' : 'text-ink-3'}`}>{getMessageDate(message.createdAt)}</div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="manager-chat-composer shrink-0 p-3 border-t border-line/20 bg-surface/90">
              {transferIntent && (
                <div className="mb-2 inline-flex items-center gap-2 text-[11px] text-success-soft font-bold bg-success/10 border border-success/20 px-2 py-1 rounded-lg">
                  <Handshake className="w-3.5 h-3.5" /> Se marcara como conversacion de traspaso.
                </div>
              )}
              {spamWarning && (
                <div className="mb-2 inline-flex items-center gap-2 text-[11px] text-warning-soft font-bold bg-warning/10 border border-warning/20 px-2 py-1 rounded-lg">
                  <ShieldAlert className="w-3.5 h-3.5" /> {spamWarning}
                </div>
              )}
              {showGifPicker && (
                <div className="mb-3 rounded-xl border border-line/[0.12] bg-black/30 p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3" />
                      <input
                        value={gifQuery}
                        onChange={e => setGifQuery(e.target.value)}
                        placeholder={`Buscar GIF en ${gifProvider === 'giphy' ? 'GIPHY' : 'KLIPY'}...`}
                        className="w-full bg-slate-950 border border-line/[0.12] rounded-lg pl-9 pr-3 py-2 text-xs text-ink outline-none focus:border-accent/60"
                      />
                    </div>
                    <button type="button" onClick={() => setShowGifPicker(false)} className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-3 hover:text-ink hover:bg-white/5">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {(GIPHY_API_KEY || KLIPY_API_KEY) ? (
                    <>
                    <div className="flex gap-2 mb-3">
                      {GIPHY_API_KEY && <button type="button" onClick={() => setGifProvider('giphy')} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border ${gifProvider === 'giphy' ? 'bg-accent/20 border-accent text-accent-soft' : 'border-line/[0.12] text-ink-3 hover:text-ink'}`}>GIPHY</button>}
                      {KLIPY_API_KEY && <button type="button" onClick={() => setGifProvider('klipy')} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border ${gifProvider === 'klipy' ? 'bg-accent/20 border-accent text-accent-soft' : 'border-line/[0.12] text-ink-3 hover:text-ink'}`}>KLIPY</button>}
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {isLoadingGifs && <p className="col-span-full text-xs text-ink-3 font-bold">Buscando magia barata...</p>}
                      {!isLoadingGifs && gifResults.map(result => {
                        const selected = selectedGifUrl === result.gifUrl;
                        return (
                          <button
                            key={result.id}
                            type="button"
                            onClick={() => selectGif(result)}
                            className={`aspect-video rounded-lg overflow-hidden border ${selected ? 'border-accent ring-2 ring-accent/30' : 'border-line/[0.12] hover:border-white/30'} bg-surface`}
                          >
                            <img src={result.previewUrl} alt={result.title || 'GIF'} className="w-full h-full object-cover" loading="lazy" />
                          </button>
                        );
                      })}
                    </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-warning-soft font-bold">Falta configurar VITE_GIPHY_API_KEY o VITE_KLIPY_API_KEY. Mientras tanto, pega una URL de GIF directo y sale igual.</p>
                      <input
                        value={gifUrl}
                        onChange={e => setGifUrl(e.target.value)}
                        placeholder="https://media.giphy.com/... o https://media.klipy.com/..."
                        className="w-full bg-slate-950 border border-line/[0.12] rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-accent/60"
                      />
                    </div>
                  )}
                  {selectedGifUrl && (
                    <div className="mt-3 flex items-center gap-3">
                      <img src={selectedGifUrl} alt="GIF seleccionado" className="h-14 rounded-lg border border-line/[0.12] bg-black/30" />
                      <button type="button" onClick={() => setGifUrl('')} className="text-xs text-danger-soft hover:text-danger-soft font-bold">Sacar GIF</button>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-end gap-2">
                <div className="relative flex-1">
                  {mentionSuggestions.length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-line/[0.12] bg-slate-950 shadow-2xl overflow-hidden">
                      {mentionSuggestions.map((team, idx) => (
                        <button
                          key={team.id}
                          type="button"
                          onMouseEnter={() => setActiveMentionIndex(idx)}
                          onClick={() => insertMention(team)}
                          className={`w-full px-3 py-2 flex items-center gap-2 text-left transition ${idx === activeMentionIndex ? 'bg-accent/10' : 'hover:bg-white/[0.06]'}`}
                        >
                          <img src={team.logoUrl || DEFAULT_LOGO} alt="" width={24} height={24} className="w-6 h-6 rounded object-contain bg-black/30" onError={e => { e.target.src = DEFAULT_LOGO; }} />
                          <span className="text-xs font-bold italic text-accent-soft">@{team.handle}</span>
                          <span className="text-xs text-ink-3 font-bold truncate">{team.teamName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder={`Escribe un mensaje como ${userProfile?.teamName || 'manager'}...`}
                    aria-label="Escribir mensaje para los managers"
                    className="w-full max-h-28 min-h-[44px] resize-none bg-slate-950 border border-line/20 rounded-xl px-3 py-2 text-xs text-ink outline-none focus:border-accent placeholder:text-ink-3"
                    maxLength={500}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowGifPicker(prev => !prev)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${showGifPicker || selectedGifUrl ? 'bg-accent text-ink' : ' bg-white/[0.05] text-ink-3 hover:text-ink'}`}
                  title="Mandar GIF"
                  aria-label="Seleccionar o buscar GIF"
                >
                  <Image className="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  disabled={(!text.trim() && !selectedGifUrl) || isSending}
                  className="w-9 h-9 rounded-lg bg-accent text-ink flex items-center justify-center hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0"
                  title={isSending ? 'Hay una operación en curso' : (!text.trim() && !selectedGifUrl) ? 'Completa los datos requeridos primero' : 'Enviar'}
                  aria-label="Enviar mensaje al chat"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </section>
        </div>

        {showTutorial && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-accent/20 bg-slate-950 shadow-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-line/[0.12] bg-accent/10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-ink uppercase tracking-tight">Chat de Managers</h3>
                    <p className="text-sm text-accent-soft/80 font-semibold mt-1">Para hablar de traspasos, tantear jugadores y dejar constancia antes de que alguno se haga el distraido.</p>
                  </div>
                  <button onClick={closeTutorial} className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-3 hover:text-ink hover:bg-white/10">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-accent-soft mb-2">Como se usa</h4>
                  <ul className="space-y-2 text-sm text-ink-2 font-medium">
                    <li>Escribi <span className="text-ink font-bold">@aspra</span> o las primeras letras y elegi el autocomplete. Si engancha bien, queda en negrita e italica y llega notificacion.</li>
                    <li>Si escribis palabras como oferta, traspaso, vender o negociar, el mensaje queda marcado como tema de traspaso.</li>
                    <li>El boton de GIF busca en GIPHY o KLIPY. Si no hay clave configurada, pega una URL de GIF y listo, modo potrero.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-warning-soft mb-2">Reglas anti-spam</h4>
                  <ul className="space-y-2 text-sm text-ink-2 font-medium">
                    <li>Maximo 6 mensajes por minuto por navegador. Respira, Bielsa tampoco manda todo junto.</li>
                    <li>No repetir el mismo mensaje en loop. Si la oferta es mala, spamearla no la hace Champions.</li>
                    <li>GIFs si, catarata eterna no. Uno bueno pega mas que diez medio pelo.</li>
                    <li>Chicana futbolera vale; bardo personal, insultos pesados o romper las bolas porque si, afuera.</li>
                  </ul>
                </div>
                <button onClick={closeTutorial} className="w-full py-3 rounded-xl bg-accent hover:bg-accent text-ink font-bold uppercase tracking-wide transition">
                  Entendido, vamos a negociar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </BaseModal>
  );
});
