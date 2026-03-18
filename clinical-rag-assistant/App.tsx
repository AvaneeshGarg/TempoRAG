
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clinicalApi } from './services/api';
import { Message, HealthStatus, DecayMethod } from './types';
import { MessageBubble } from './components/MessageBubble';
import { RiskPredictor } from './components/RiskPredictor';
import { MedicalSearch } from './components/MedicalSearch';
import { VoiceMode } from './components/VoiceMode';
import { EvalDashboard } from './components/EvalDashboard';
import { PulsingHeartLoader } from './components/PulsingHeartLoader';
import { HeartIcon, SendIcon, HistoryIcon, SearchIcon, AlertIcon, LibraryIcon } from './components/Icons';
import { SplashScreen } from './components/SplashScreen';
import { QuerySuggest } from './components/QuerySuggest';
import { LoginPage } from './components/LoginPage';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './components/Toast';

type AppView = 'chat' | 'predictor' | 'research' | 'evaluation';

const LOADING_PHRASES = [
  'Retrieving evidence...',
  'Fetching studies...',
  'Analyzing literature...',
  'Consulting knowledge base...',
  'Synthesizing evidence...',
  'Reviewing guidelines...',
];

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

const SESSIONS_KEY = 'clinical-rag-sessions';
const ACTIVE_KEY = 'clinical-rag-active-session';
const DARK_MODE_KEY = 'clinical-rag-dark';
const newSessionId = () => `session-${Date.now()}`;

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map((s: any) => ({
      ...s,
      messages: s.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
    }));
  } catch { return []; }
}
function saveSessions(s: ChatSession[]) {
  try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(s)); } catch { }
}
function createSession(): ChatSession {
  return { id: newSessionId(), title: 'New Chat', messages: [], createdAt: new Date().toISOString() };
}

const BASE_URL = (import.meta.env.VITE_BACKEND_URL as string) || '';

const App: React.FC = () => {
  const { user, logout, canAccess } = useAuth();
  const toast = useToast();

  const [view, setView] = useState<AppView>('chat');
  const [showSplash, setSplashVisible] = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem(DARK_MODE_KEY) === 'true');

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const s = loadSessions(); return s.length > 0 ? s : [createSession()];
  });
  const [activeId, setActiveId] = useState<string>(() => {
    const saved = localStorage.getItem(ACTIVE_KEY);
    const s = loadSessions();
    return (saved && s.find(x => x.id === saved)) ? saved : (s[0]?.id ?? newSessionId());
  });

  const activeSession = sessions.find(s => s.id === activeId) ?? sessions[0];
  const messages = activeSession?.messages ?? [];

  const [input, setInput] = useState('');
  const [method, setMethod] = useState<DecayMethod>('etvd');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingPhrase, setLoadingPhrase] = useState(LOADING_PHRASES[0]);
  const [health, setHealth] = useState<HealthStatus>({ status: 'checking' });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const phraseIdxRef = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Dark mode
  useEffect(() => {
    localStorage.setItem(DARK_MODE_KEY, String(darkMode));
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => { saveSessions(sessions); }, [sessions]);
  useEffect(() => { localStorage.setItem(ACTIVE_KEY, activeId); }, [activeId]);
  useEffect(() => {
    if (view === 'chat') messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, view]);

  useEffect(() => {
    if (!isLoading) return;
    phraseIdxRef.current = 0;
    setLoadingPhrase(LOADING_PHRASES[0]);
    const interval = setInterval(() => {
      phraseIdxRef.current = (phraseIdxRef.current + 1) % LOADING_PHRASES.length;
      setLoadingPhrase(LOADING_PHRASES[phraseIdxRef.current]);
    }, 1800);
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => { clinicalApi.checkHealth().then(setHealth); }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K → focus chat input
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        setView('chat');
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      // Ctrl+1-4 → switch views
      if (e.ctrlKey && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const views: AppView[] = ['chat', 'predictor', 'research', 'evaluation'];
        const nextView = views[parseInt(e.key) - 1];
        if (!canAccess(nextView === 'predictor' ? 'risk' : nextView === 'evaluation' ? 'eval' : nextView as any)) {
          toast.warn('🔒 Sign in for full access.');
          return;
        }
        setView(nextView);
      }
      // Esc → close voice modal
      if (e.key === 'Escape' && isVoiceActive) setIsVoiceActive(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isVoiceActive, canAccess]);

  const updateActiveMessages = (updater: (prev: Message[]) => Message[]) =>
    setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: updater(s.messages) } : s));

  const setSessionTitle = (sessionId: string, title: string) =>
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: title.slice(0, 40) } : s));

  const handleNewChat = () => {
    const session = createSession();
    setSessions(prev => [session, ...prev]);
    setActiveId(session.id);
    setInput('');
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => {
      const next = prev.filter(s => s.id !== sessionId);
      if (next.length === 0) { const f = createSession(); setActiveId(f.id); return [f]; }
      if (activeId === sessionId) setActiveId(next[0].id);
      return next;
    });
  };

  // ── Streaming submit ──────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading || isStreaming) return;

    if (!canAccess('chat')) { toast.warn('🔒 Sign in to access Evidence Chat.'); return; }

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date() };
    if (messages.length === 0) setSessionTitle(activeId, input);
    updateActiveMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    // Add an empty assistant message placeholder for streaming
    const assistantId = (Date.now() + 1).toString();
    updateActiveMessages(prev => [...prev, {
      id: assistantId, role: 'assistant', content: '', sources: [], timestamp: new Date()
    }]);

    setIsLoading(false);
    setIsStreaming(true);

    abortRef.current = new AbortController();
    try {
      const params = new URLSearchParams({ question: currentInput, method });
      const response = await fetch(`${BASE_URL}/query/stream?${params}`, {
        signal: abortRef.current.signal,
        credentials: 'include',
        headers: { Accept: 'text/event-stream' }
      });

      if (!response.ok || !response.body) throw new Error('Stream unavailable');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'token') {
              setSessions(prev => prev.map(s => s.id === activeId ? {
                ...s,
                messages: s.messages.map(m => m.id === assistantId
                  ? { ...m, content: m.content + evt.content }
                  : m)
              } : s));
            } else if (evt.type === 'sources') {
              setSessions(prev => prev.map(s => s.id === activeId ? {
                ...s,
                messages: s.messages.map(m => m.id === assistantId
                  ? { ...m, sources: evt.content }
                  : m)
              } : s));
              const ms = evt.timings?.generate_ms;
              if (ms) toast.success(`✅ Response in ${(ms / 1000).toFixed(1)}s · ${method.toUpperCase()}`);
            } else if (evt.type === 'error') {
              setSessions(prev => prev.map(s => s.id === activeId ? {
                ...s,
                messages: s.messages.map(m => m.id === assistantId
                  ? { ...m, content: `Error: ${evt.content}` }
                  : m)
              } : s));
              toast.error(`Backend error: ${evt.content}`);
            }
          } catch { /* skip malformed lines */ }
        }
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      // Fallback to non-streaming
      try {
        const res = await clinicalApi.query(currentInput, method);
        setSessions(prev => prev.map(s => s.id === activeId ? {
          ...s,
          messages: s.messages.map(m => m.id === assistantId
            ? { ...m, content: res.answer, sources: res.sources }
            : m)
        } : s));
      } catch (fallbackErr: any) {
        setSessions(prev => prev.map(s => s.id === activeId ? {
          ...s,
          messages: s.messages.map(m => m.id === assistantId
            ? { ...m, content: `Error: ${fallbackErr.message}` }
            : m)
        } : s));
        toast.error(fallbackErr.message);
      }
    } finally {
      setIsStreaming(false);
    }
  }, [input, method, activeId, isLoading, isStreaming, canAccess, messages.length]);

  // ── Nav helper with access control ───────────────────────────────────────
  const navBtn = (v: AppView, accessKey: 'chat' | 'risk' | 'research' | 'eval', icon: React.ReactNode, label: string) => {
    const accessible = canAccess(accessKey);
    return (
      <button
        onClick={() => {
          if (!accessible) { toast.warn(`🔒 Sign in to access ${label}.`); return; }
          setView(v);
        }}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${view === v ? 'bg-rose-600/10 text-rose-400 border border-rose-600/20' : 'text-slate-400 hover:bg-slate-800'}`}
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        {!accessible && <span className="text-slate-600 text-xs">🔒</span>}
      </button>
    );
  };

  // ── If not logged in → show login ─────────────────────────────────────────
  if (!user) return <LoginPage />;

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setSplashVisible(false)} />}
      <div className={`flex h-screen text-slate-900 overflow-hidden font-sans ${darkMode ? 'dark bg-slate-900' : 'bg-slate-50'} ${showSplash ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}`}>
        {isVoiceActive && <VoiceMode onClose={() => setIsVoiceActive(false)} />}

        {/* ── Sidebar ── */}
        <aside className={`${sidebarOpen ? 'w-80' : 'w-0'} bg-slate-900 text-white flex flex-col transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0`}>
          <div className="p-6 flex items-center gap-3 border-b border-slate-800">
            <div className="bg-rose-600 p-2 rounded-lg">
              <HeartIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">Clinical RAG</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Diagnostics Hub</p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-2 flex flex-col">
            {/* New Chat */}
            <button onClick={handleNewChat}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold transition-colors mb-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Chat
            </button>

            <div className="px-1 mb-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Workbench</div>
            {navBtn('chat', 'chat', <SearchIcon className="w-5 h-5" />, 'Evidence Chat')}
            {navBtn('predictor', 'risk', <AlertIcon className="w-5 h-5" />, 'Risk Forecaster')}
            {navBtn('research', 'research', <LibraryIcon className="w-5 h-5" />, 'Research Pulse')}
            {navBtn('evaluation', 'eval',
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>, 'Eval Dashboard')}

            {/* Session list */}
            {sessions.length > 0 && (
              <div className="pt-4 flex-1 flex flex-col min-h-0">
                <div className="px-1 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Recent Chats</div>
                <div className="space-y-1 overflow-y-auto flex-1">
                  {sessions.map(session => (
                    <button key={session.id}
                      onClick={() => { setActiveId(session.id); setView('chat'); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors group ${session.id === activeId ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                      <HistoryIcon className="w-3 h-3 flex-shrink-0 opacity-60" />
                      <span className="flex-1 truncate">{session.title}</span>
                      <span onClick={(e) => handleDeleteSession(session.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition-opacity cursor-pointer px-1">×</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 space-y-2">
              <button onClick={() => setIsVoiceActive(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors text-sm font-bold border border-rose-500/20">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                Live Consult Mode
              </button>
              {/* User info + logout */}
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 rounded-lg">
                <div className="w-7 h-7 rounded-full bg-rose-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                  <p className="text-[10px] text-slate-500 capitalize">{user.role}</p>
                </div>
                <button onClick={() => logout()} className="text-slate-500 hover:text-rose-400 text-xs transition-colors" title="Sign out">↩</button>
              </div>
            </div>
          </nav>

          <div className="p-4 bg-slate-950 border-t border-slate-800">
            <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-bold tracking-widest">
              <span>Status: {health.status}</span>
              <span className={`w-2 h-2 rounded-full ${health.status === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className={`flex-1 flex flex-col relative min-w-0 ${darkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
          <header className={`h-16 border-b flex items-center justify-between px-6 z-10 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`p-1.5 rounded-md transition-colors ${darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
              </button>
              <h2 className={`font-semibold truncate max-w-xs ${darkMode ? 'text-white' : 'text-slate-700'}`}>
                {view === 'chat'
                  ? (activeSession?.title === 'New Chat' ? 'Evidence-Based Consultation' : activeSession?.title)
                  : view === 'predictor' ? 'Predictive Analytics'
                    : view === 'research' ? 'Medical Research Pulse'
                      : 'Evaluation Dashboard'}
              </h2>
              {isStreaming && (
                <span className="text-xs text-rose-400 font-medium animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />Streaming
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Dark mode toggle */}
              <button onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg transition-colors text-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
                title={darkMode ? 'Light mode' : 'Dark mode'}>
                {darkMode ? '☀️' : '🌙'}
              </button>

              {view === 'chat' && (
                <div className={`flex items-center gap-2 p-1 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                  <span className="text-[10px] font-bold text-slate-500 px-2 uppercase">Decay</span>
                  <select value={method} onChange={e => setMethod(e.target.value as DecayMethod)}
                    className={`border text-xs rounded-md px-2 py-1 outline-none font-medium ${darkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
                    <option value="etvd">ETVD</option>
                    <option value="sigmoid">Sigmoid</option>
                    <option value="bioscore">BioScore</option>
                  </select>
                </div>
              )}
            </div>
          </header>

          <div className={`flex-1 overflow-y-auto px-6 py-8 md:px-12 ${darkMode ? 'bg-slate-900' : 'bg-slate-50/50'}`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className={view === 'chat' ? 'h-full' : ''}
              >
                {view === 'predictor' ? <RiskPredictor /> :
                  view === 'research' ? <MedicalSearch /> :
                    view === 'evaluation' ? <EvalDashboard /> : (
                      <div className="max-w-5xl mx-auto w-full flex flex-col h-full">
                        {messages.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                            <motion.div
                              className="w-20 h-20 rounded-2xl flex items-center justify-center text-white"
                              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)', boxShadow: '0 8px 24px rgba(225,29,72,0.25)' }}
                              animate={{ scale: [1, 1.05, 1] }}
                              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                            >
                              <HeartIcon className="w-10 h-10" />
                            </motion.div>
                            <div>
                              <h3 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>Evidence-Based Clinical Chat</h3>
                              <p className="text-slate-500 max-w-lg mx-auto">Grounded in PubMed, providing synthesized clinical data for cardiology and heart failure cases.</p>
                            </div>
                            <div className="flex flex-wrap gap-3 justify-center max-w-lg">
                              {['Heart failure management', 'SGLT2 inhibitors efficacy', 'Ejection fraction criteria'].map((hint, i) => (
                                <motion.button
                                  key={hint}
                                  onClick={() => setInput(hint)}
                                  className="text-xs text-slate-600 border border-slate-200 px-4 py-2 rounded-xl hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50/50 transition-all"
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.3 + i * 0.1 }}
                                >
                                  {hint}
                                </motion.button>
                              ))}
                            </div>
                            <button onClick={handleNewChat} className="btn-primary text-sm px-6 py-2.5 flex items-center gap-2 mt-2">
                              + Start a new chat
                            </button>
                          </div>
                        ) : messages.map(msg => (
                          <MessageBubble key={msg.id} message={msg} isStreaming={isStreaming && msg === messages[messages.length - 1] && msg.role === 'assistant'} />
                        ))}

                        {isLoading && <PulsingHeartLoader phrase={loadingPhrase} />}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
              </motion.div>
            </AnimatePresence>
          </div>

          {view === 'chat' && (
            <div className={`p-6 border-t ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
              <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-3 relative">
                <div className="flex-1 relative">
                  <QuerySuggest value={input} onSelect={v => { setInput(v); setTimeout(() => inputRef.current?.focus(), 50); }} />
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmit())}
                    placeholder="Consult the clinical knowledge base... (Ctrl+K to focus)"
                    className={`w-full border rounded-xl px-6 py-3 outline-none focus:ring-2 focus:ring-rose-400 resize-none h-14 text-sm ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                  />
                </div>
                <button
                  disabled={isLoading || isStreaming || !input.trim()}
                  className="p-3 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:shadow-none text-white"
                  style={{ background: isLoading || isStreaming || !input.trim() ? '#94a3b8' : 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)' }}>
                  <SendIcon />
                </button>
              </form>
              <p className={`text-center text-[10px] mt-2 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                Ctrl+K focus · Ctrl+1-4 switch views · Streaming via SSE
              </p>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default App;
