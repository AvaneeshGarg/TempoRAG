
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message } from '../types';
import { HeartIcon } from './Icons';
import { MarkdownText } from './MarkdownText';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

const ScoreBar: React.FC<{ score: number }> = ({ score }) => {
  const pct = Math.round((score ?? 0) * 100);
  const filled = Math.round(pct / 10);
  return (
    <span className="font-mono text-[10px] text-slate-400">
      {'█'.repeat(filled)}{'░'.repeat(10 - filled)} {pct}%
    </span>
  );
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isStreaming }) => {
  const isAssistant = message.role === 'assistant';
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleFeedback = (type: 'up' | 'down') => {
    setFeedback(type);
    if (type === 'down') {
      // Log to localStorage for future fine-tuning
      try {
        const log = JSON.parse(localStorage.getItem('crag_feedback') || '[]');
        log.push({ timestamp: new Date().toISOString(), question: '', answer: message.content, verdict: 'thumbs_down' });
        localStorage.setItem('crag_feedback', JSON.stringify(log.slice(-100)));
      } catch { }
    }
  };

  const hasSources = isAssistant && message.sources && message.sources.length > 0;

  return (
    <div className={`flex flex-col mb-8 group ${isAssistant ? 'items-start' : 'items-end'}`}>
      <div className="max-w-[85%] lg:max-w-[75%]">
        {/* Role header */}
        <div className={`flex items-center gap-2 mb-2 ${isAssistant ? 'flex-row' : 'flex-row-reverse'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm flex-shrink-0 ${isAssistant ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
            {isAssistant ? <HeartIcon className="w-5 h-5" /> : <span className="text-xs font-bold">MD</span>}
          </div>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            {isAssistant ? 'Clinical Assistant' : 'Physician'}
          </span>
          <span className="text-[10px] text-slate-400">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isStreaming && (
            <span className="flex gap-0.5 ml-1">
              {[0, 1, 2].map(i => (
                <motion.span key={i} className="w-1 h-1 rounded-full bg-rose-400 inline-block"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }} />
              ))}
            </span>
          )}
        </div>

        {/* Message bubble */}
        <div className={`px-5 py-4 rounded-2xl shadow-sm leading-relaxed ${isAssistant
          ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
          : 'bg-rose-700 text-white rounded-tr-none'}`}>
          {isAssistant
            ? <MarkdownText text={message.content || (isStreaming ? '▌' : '')} />
            : <p className="text-sm md:text-base leading-relaxed">{message.content}</p>
          }
        </div>

        {/* Per-message actions (hover) */}
        {isAssistant && message.content && (
          <motion.div
            className="flex items-center gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            initial={false}
          >
            <button onClick={handleCopy}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100">
              {copied ? '✅ Copied' : '📋 Copy'}
            </button>
            <button onClick={() => handleFeedback('up')}
              className={`text-lg transition-transform hover:scale-110 ${feedback === 'up' ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}>
              👍
            </button>
            <button onClick={() => handleFeedback('down')}
              className={`text-lg transition-transform hover:scale-110 ${feedback === 'down' ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}
              title="Saves to local feedback log">
              👎
            </button>
            {feedback && (
              <span className="text-[10px] text-slate-400 italic">
                {feedback === 'up' ? 'Thanks!' : 'Logged for improvement'}
              </span>
            )}
          </motion.div>
        )}

        {/* Collapsible sources panel */}
        {hasSources && (
          <div className="mt-3">
            <button
              onClick={() => setSourcesOpen(!sourcesOpen)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors px-1 py-1"
            >
              <motion.span
                animate={{ rotate: sourcesOpen ? 90 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-rose-400"
              >▶</motion.span>
              {sourcesOpen ? '▼' : ''} {message.sources!.length} Sources
              <span className="text-[10px] font-normal text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 uppercase tracking-wider">
                ETVD
              </span>
            </button>

            <AnimatePresence>
              {sourcesOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 space-y-1.5 border-l-2 border-rose-200 pl-3">
                    {message.sources!.map((src, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-slate-700 leading-snug">
                              [{idx + 1}]{' '}
                              {src.pmid ? (
                                <a
                                  href={`https://pubmed.ncbi.nlm.nih.gov/${src.pmid}/`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-rose-600 underline decoration-dotted transition-colors"
                                >
                                  {src.title}
                                </a>
                              ) : src.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-slate-400 font-mono">{src.year}</span>
                              <ScoreBar score={src.score} />
                            </div>
                          </div>
                          {src.pmid && (
                            <a href={`https://pubmed.ncbi.nlm.nih.gov/${src.pmid}/`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-[10px] text-rose-500 hover:text-rose-700 font-bold flex-shrink-0 border border-rose-200 rounded px-1.5 py-0.5 hover:bg-rose-50 transition-colors">
                              PubMed ↗
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};
