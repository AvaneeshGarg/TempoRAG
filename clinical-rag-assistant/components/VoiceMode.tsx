import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeartIcon } from './Icons';
import { clinicalApi } from '../services/api';

// ─── Web Speech API types ────────────────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

export const VoiceMode: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState('');
  const [isActive, setIsActive] = useState(false);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const transcriptRef = useRef('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');

  const setStatusSafe = (s: 'idle' | 'listening' | 'thinking' | 'speaking') => {
    statusRef.current = s;
    setStatus(s);
  };

  // ─── Auto-scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, interimText]);

  // ─── Speech synthesis ─────────────────────────────────────────────────────
  const speak = useCallback((text: string, onDone: () => void) => {
    setStatusSafe('speaking');
    synthRef.current.cancel();
    const utter = new SpeechSynthesisUtterance(text);

    // Prefer a natural English voice
    const voices = synthRef.current.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel')
    ) || voices[0];
    if (preferred) utter.voice = preferred;
    utter.rate = 0.95;
    utter.pitch = 1.0;

    utter.onend = () => onDone();
    utter.onerror = () => onDone();
    synthRef.current.speak(utter);
  }, []);

  // ─── Ask backend with transcribed text ────────────────────────────────────
  const askBackend = useCallback(async (question: string) => {
    setStatusSafe('thinking');
    setTurns(prev => [...prev, { role: 'user', text: question }]);
    try {
      const res = await clinicalApi.query(question, 'etvd');
      const answer = res.answer || 'No response from backend.';
      setTurns(prev => [...prev, { role: 'assistant', text: answer }]);
      speak(answer, () => {
        setStatusSafe('listening');
        recognitionRef.current?.start();
      });
    } catch (e: any) {
      const msg = `Error: ${e.message || 'Backend unavailable.'}`;
      setTurns(prev => [...prev, { role: 'assistant', text: msg }]);
      speak(msg, () => {
        setStatusSafe('listening');
        recognitionRef.current?.start();
      });
    }
  }, [speak]);

  // ─── Initialise Web Speech Recognition ────────────────────────────────────
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;       // one utterance at a time
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setStatusSafe('listening');
      setInterimText('');
      transcriptRef.current = '';
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      setInterimText(interim);
      if (final) transcriptRef.current = final;
    };

    recognition.onend = () => {
      setInterimText('');
      const said = transcriptRef.current.trim();
      if (said && statusRef.current !== 'thinking' && statusRef.current !== 'speaking') {
        askBackend(said);
      } else if (!said) {
        // Nothing heard — restart
        setTimeout(() => recognition.start(), 500);
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error === 'no-speech') {
        // silently restart
        setTimeout(() => recognition.start(), 500);
      } else {
        setError(`Microphone error: ${e.error}`);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [askBackend, isActive, status]);

  // ─── Start session ────────────────────────────────────────────────────────
  const startSession = useCallback(() => {
    setIsActive(true);
    setTurns([]);
    setError('');

    // Welcome message
    const welcome = 'Live Clinical Assistant is ready. How can I help you today?';
    setTurns([{ role: 'assistant', text: welcome }]);
    speak(welcome, () => startListening());
  }, [speak, startListening]);

  useEffect(() => {
    // Pre-load voices
    synthRef.current.getVoices();
    startSession();
    return () => {
      recognitionRef.current?.abort();
      synthRef.current.cancel();
    };
  }, []);

  const handleEnd = () => {
    recognitionRef.current?.abort();
    synthRef.current.cancel();
    onClose();
  };

  // ─── Status color / label ─────────────────────────────────────────────────
  const statusInfo = {
    idle: { label: 'Initializing...', color: 'bg-slate-400' },
    listening: { label: 'Listening — speak now', color: 'bg-emerald-500' },
    thinking: { label: 'Consulting knowledge base...', color: 'bg-amber-500' },
    speaking: { label: 'Speaking response', color: 'bg-rose-500' },
  }[status];

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
      <motion.div
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 flex items-center gap-4">
          <div className="relative">
            <motion.div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}
              animate={status === 'listening' ? { scale: [1, 1.12, 1] } : {}}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <HeartIcon className="w-7 h-7 text-white" />
            </motion.div>
            {/* Status dot */}
            <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${statusInfo.color}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold text-lg">Live Clinical Assistant</h3>
            <p className="text-slate-400 text-xs font-medium">{statusInfo.label}</p>
          </div>

          {/* Waveform bars */}
          <AnimatePresence>
            {status === 'listening' && (
              <motion.div className="flex items-center gap-0.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <motion.div
                    key={i}
                    className="w-1 rounded-full bg-emerald-400"
                    animate={{ height: ['8px', `${8 + Math.random() * 20}px`, '8px'] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.08 }}
                  />
                ))}
              </motion.div>
            )}
            {status === 'thinking' && (
              <motion.div className="flex items-center gap-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {[0, 1, 2].map(i => (
                  <motion.div key={i} className="w-2 h-2 rounded-full bg-amber-400"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.25 }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Conversation area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50" style={{ minHeight: '220px', maxHeight: '400px' }}>
          {turns.map((turn, i) => (
            <motion.div
              key={i}
              className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {turn.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-rose-600 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                  <HeartIcon className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${turn.role === 'user'
                  ? 'bg-slate-900 text-white rounded-tr-sm'
                  : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm'
                  }`}
              >
                {turn.text}
              </div>
            </motion.div>
          ))}

          {/* Interim transcription */}
          {interimText && (
            <motion.div
              className="flex justify-end"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="max-w-[80%] px-4 py-3 rounded-2xl text-sm bg-slate-200 text-slate-500 italic rounded-tr-sm border border-dashed border-slate-300">
                {interimText}...
              </div>
            </motion.div>
          )}

          {turns.length === 0 && !interimText && (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-sm text-center">
              <span className="text-2xl mb-2">🎙️</span>
              <p>Speak your clinical question and I'll respond</p>
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mb-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl">
            ⚠️ {error}
          </div>
        )}

        {/* Footer */}
        <div className="bg-white p-5 flex items-center justify-between border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${statusInfo.color}`} />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              {status === 'listening' ? 'Live' : status === 'speaking' ? 'Speaking' : status === 'thinking' ? 'Processing' : 'Standby'}
            </span>
            <span className="text-[10px] text-slate-400">· Web Speech API · Free</span>
          </div>
          <button
            onClick={handleEnd}
            className="btn-primary px-6 py-2 text-sm"
          >
            End Consultation
          </button>
        </div>
      </motion.div>
    </div>
  );
};
