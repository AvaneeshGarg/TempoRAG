
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clinicalApi } from '../services/api';
import { LibraryIcon, SearchIcon } from './Icons';
import { SearchResponse } from '../types';
import { MarkdownText } from './MarkdownText';
import { EKGPulseLoader } from './EKGPulseLoader';
import { useToast } from './Toast';

const FAV_KEY = 'crag_fav_articles';
const loadFavs = (): string[] => { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; } };
const saveFavs = (f: string[]) => { try { localStorage.setItem(FAV_KEY, JSON.stringify(f)); } catch { } };

type FilterChip = 'all' | 'recent' | 'rct' | 'meta' | 'guidelines';
const CHIPS: { id: FilterChip; label: string; keywords?: string[] }[] = [
  { id: 'all', label: 'All' },
  { id: 'recent', label: 'Last 5 Years' },
  { id: 'rct', label: 'RCTs', keywords: ['randomized', 'rct', 'trial', 'placebo'] },
  { id: 'meta', label: 'Meta-analyses', keywords: ['meta-analysis', 'systematic review', 'meta analysis'] },
  { id: 'guidelines', label: 'Guidelines', keywords: ['guideline', 'recommendation', 'consensus', 'statement'] },
];

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.4, ease: 'easeOut' }
  })
};

export const MedicalSearch: React.FC = () => {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterChip>('all');
  const [favs, setFavs] = useState<string[]>(loadFavs);

  const performSearch = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError('');
    setActiveFilter('all');
    try {
      const response = await clinicalApi.searchPubMed(query);
      setResult(response);
    } catch (err: any) {
      setError(err.message || 'Search failed. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  };

  const parsePubMed = (text: string) => {
    if (!text || text.includes('unavailable')) return [];
    return text.split(/\n\n+/).filter(a => a.trim().length > 20).map((article, i) => {
      const lines = article.split('\n');
      const title = lines[0]?.replace(/^Published:\s*/, '').trim() || `Article ${i + 1}`;
      const body = lines.slice(1).join('\n').trim();
      const yearMatch = body.match(/(20[0-9]{2}|19[0-9]{2})/);
      const year = yearMatch ? parseInt(yearMatch[1]) : 0;
      return { title, body, year };
    });
  };

  const allArticles = result ? parsePubMed(result.pubmed_results) : [];

  const toggleFav = (title: string) => {
    setFavs(prev => {
      const next = prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title];
      saveFavs(next);
      toast.success(prev.includes(title) ? 'Removed from favourites' : '⭐ Saved to favourites');
      return next;
    });
  };

  const pubmedArticles = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const chip = CHIPS.find(c => c.id === activeFilter);
    return allArticles.filter(a => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'recent') return a.year >= currentYear - 5;
      return chip?.keywords?.some(kw => a.body.toLowerCase().includes(kw) || a.title.toLowerCase().includes(kw)) ?? true;
    });
  }, [allArticles, activeFilter]);

  return (
    <div className="max-w-5xl mx-auto py-6">
      {/* Gradient Header */}
      <div className="page-gradient-header">
        <div className="header-badge">
          <span className="dot"></span>
          Research Intelligence
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-rose-600 p-2.5 rounded-xl" style={{ position: 'relative', zIndex: 1 }}>
            <LibraryIcon className="w-6 h-6 text-white" />
          </div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2>Medical Research Pulse</h2>
            <p>Synthesized findings from NIH, WHO, AHA, CDC, Cochrane, NEJM, The Lancet & more</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <motion.div
        className="glass-card p-2 flex gap-2 mb-8"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center pl-4 text-slate-400">
          <SearchIcon className="w-5 h-5" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && performSearch()}
          className="flex-1 bg-transparent px-2 py-3 focus:outline-none text-sm"
          placeholder="e.g. impact of oily foods on heart failure in youngsters..."
        />
        <button
          onClick={performSearch}
          disabled={isLoading || !query.trim()}
          className="btn-primary px-6 py-2.5 rounded-xl"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </motion.div>

      {/* Loading state */}
      {isLoading && <EKGPulseLoader />}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 text-rose-700 p-4 rounded-2xl border border-rose-200 text-sm"
        >
          {error}
        </motion.div>
      )}

      <AnimatePresence>
        {result && !isLoading && (
          <motion.div
            className="space-y-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* LLM Synthesis Panel */}
            {result.synthesis && !result.synthesis.includes('unavailable') && (
              <motion.div
                className="glass-card p-8 border-l-4 border-l-rose-500"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="bg-gradient-to-br from-rose-600 to-rose-700 text-white p-2 rounded-lg shadow-sm">
                    <LibraryIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">Multi-Source Synthesis</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                      NIH · WHO · AHA · CDC · Cochrane · NEJM · Lancet
                    </p>
                  </div>
                </div>
                <MarkdownText text={result.synthesis} className="text-slate-700" />
              </motion.div>
            )}

            {result.synthesis?.includes('unavailable') && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-sm">
                ⚠️ LLM synthesis unavailable — check that <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">GROQ_API_KEY</code> is set in <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">.env</code>.
              </div>
            )}

            {/* PubMed Papers */}
            {allArticles.length > 0 && (
              <div>
                {/* Filter chips */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {CHIPS.map(chip => (
                    <button key={chip.id} onClick={() => setActiveFilter(chip.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${activeFilter === chip.id
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300 hover:text-rose-600'
                        }`}>
                      {chip.label}
                      {chip.id === 'all' && <span className="ml-1 opacity-60">({allArticles.length})</span>}
                    </button>
                  ))}
                  {favs.length > 0 && (
                    <span className="ml-auto text-xs text-slate-400 flex items-center gap-1">⭐ {favs.length} saved</span>
                  )}
                </div>

                <div className="section-label">
                  <LibraryIcon className="w-3.5 h-3.5" />
                  <span>PubMed Papers ({pubmedArticles.length} shown)</span>
                </div>
                <div className="space-y-4">
                  {pubmedArticles.map((article, i) => {
                    const relevancePct = Math.max(10, 100 - i * (100 / Math.max(pubmedArticles.length, 1)));
                    const isFav = favs.includes(article.title);
                    return (
                      <motion.div
                        key={i}
                        custom={i}
                        initial="hidden"
                        animate="visible"
                        variants={cardVariants}
                        className="glass-card p-6 hover:border-rose-300 group cursor-default"
                      >
                        <div className="flex items-start gap-4">
                          <div className="bg-rose-50 text-rose-600 p-2 rounded-lg flex-shrink-0 group-hover:bg-rose-100 transition-colors">
                            <LibraryIcon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase mb-2 inline-block">PubMed</span>
                                {article.year > 0 && <span className="ml-2 text-[10px] text-slate-400 font-mono">{article.year}</span>}
                              </div>
                              <button onClick={() => toggleFav(article.title)}
                                className={`text-xl flex-shrink-0 transition-transform hover:scale-125 ${isFav ? 'opacity-100' : 'opacity-30 hover:opacity-70'}`}
                                title={isFav ? 'Remove from favourites' : 'Save to favourites'}>
                                ⭐
                              </button>
                            </div>
                            <h4 className="font-bold text-slate-800 mb-2">{article.title}</h4>
                            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{article.body}</p>
                            {/* Relevance score bar */}
                            <div className="flex items-center gap-2 mt-3">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Relevance</span>
                              <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-600"
                                  style={{ width: 0 }}
                                  animate={{ width: `${relevancePct}%` }}
                                  transition={{ delay: 0.3 + i * 0.05, duration: 0.6, ease: 'easeOut' }}
                                />
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono">{Math.round(relevancePct)}%</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                {pubmedArticles.length === 0 && activeFilter !== 'all' && (
                  <p className="text-center text-slate-400 text-sm py-8">No articles match the "{CHIPS.find(c => c.id === activeFilter)?.label}" filter.</p>
                )}
              </div>
            )}

            {pubmedArticles.length === 0 && result.pubmed_results && !result.pubmed_results.includes('unavailable') && (
              <div className="glass-card p-6">
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{result.pubmed_results}</p>
              </div>
            )}

            {result.pubmed_results?.includes('unavailable') && (
              <div className="bg-slate-50 border border-slate-200 text-slate-500 p-4 rounded-2xl text-sm">
                PubMed search unavailable — results shown from LLM synthesis only.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!isLoading && !result && !error && (
        <motion.div
          className="flex flex-col items-center justify-center py-24 text-center text-slate-400 space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div
            className="bg-slate-100 p-4 rounded-2xl"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <LibraryIcon className="w-8 h-8 opacity-40" />
          </motion.div>
          <p className="text-sm max-w-md">
            Enter any medical research question. Results will be synthesized from NIH, WHO, AHA, CDC,
            Cochrane Reviews, and major journals — not just PubMed.
          </p>
        </motion.div>
      )}
    </div>
  );
};
