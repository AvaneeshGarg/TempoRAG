
import React, { useState, useEffect } from 'react';
import { motion, useSpring, useMotionValue, animate } from 'framer-motion';
import { useToast } from './Toast';

const BASE_URL = 'http://localhost:8001';

interface MethodMetrics {
    avg_keyword_overlap?: number;
    temporal_keyword_overlap?: number;
    avg_source_year?: number;
    avg_retrieve_ms?: number;
    avg_rerank_ms?: number;
    avg_generate_ms?: number;
    avg_total_ms?: number;
    pct_with_statistics?: number;
}

interface MetricsPayload {
    generated_at?: string;
    n_questions?: number;
    methods: Record<string, MethodMetrics>;
}

interface ApiResponse {
    status: string;
    message?: string;
    results: MetricsPayload | Record<string, never>;
}

const METHODS = ['no_decay', 'etvd', 'sigmoid', 'bioscore'];
const METHOD_LABELS: Record<string, string> = {
    no_decay: 'No Decay (Baseline)',
    etvd: 'ETVD',
    sigmoid: 'Sigmoid',
    bioscore: 'BioScore',
};
const METHOD_COLORS: Record<string, string> = {
    no_decay: '#94a3b8',
    etvd: '#0d9488',
    sigmoid: '#6366f1',
    bioscore: '#f59e0b',
};

// ─── Decay curve math ────────────────────────────────────────────────────────
const currentYear = 2024;
const YEARS = Array.from({ length: 30 }, (_, i) => currentYear - 29 + i);
const etvdScore = (y: number) => Math.exp(-0.05 * Math.max(0, currentYear - y));
const sigScore = (y: number) => 1 / (1 + Math.exp(0.5 * (Math.max(0, currentYear - y) - 10)));
const bioScore = (y: number) => 0.7 * 0.75 + 0.3 * Math.max(0, 1 - (currentYear - y) / 30);

const DecayChart: React.FC = () => {
    const W = 560; const H = 190; const PAD = 38;
    const iW = W - PAD * 2; const iH = H - PAD * 2;
    const toX = (y: number) => PAD + ((y - YEARS[0]) / (YEARS[YEARS.length - 1] - YEARS[0])) * iW;
    const toY = (v: number) => PAD + iH - v * iH;
    const curves = [
        { key: 'etvd', fn: etvdScore }, { key: 'sigmoid', fn: sigScore }, { key: 'bioscore', fn: bioScore },
    ];
    return (
        <motion.div
            className="glass-card p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
        >
            <div className="section-label">
                <span>Decay Curves</span>
            </div>
            <h3 className="font-bold text-slate-800 mb-1">Decay Curve Comparison</h3>
            <p className="text-xs text-slate-400 mb-3">Temporal weight vs. publication year (higher = more preferred)</p>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44">
                {[0, 0.25, 0.5, 0.75, 1].map(v => (
                    <g key={v}>
                        <line x1={PAD} y1={toY(v)} x2={W - PAD} y2={toY(v)} stroke="#e2e8f0" strokeWidth="1" />
                        <text x={PAD - 5} y={toY(v) + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{v.toFixed(2)}</text>
                    </g>
                ))}
                {[1995, 2000, 2005, 2010, 2015, 2020, 2024].map(y => (
                    <text key={y} x={toX(y)} y={H - 5} textAnchor="middle" fontSize="9" fill="#94a3b8">{y}</text>
                ))}
                {curves.map(({ key, fn }) => (
                    <motion.polyline key={key}
                        points={YEARS.map(y => `${toX(y)},${toY(fn(y))}`).join(' ')}
                        fill="none" stroke={METHOD_COLORS[key]} strokeWidth="2.5" strokeLinejoin="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ duration: 1.5, delay: 0.5 }}
                    />
                ))}
            </svg>
            <div className="flex gap-4 mt-2 flex-wrap">
                {curves.map(({ key }) => (
                    <div key={key} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full" style={{ background: METHOD_COLORS[key] }} />
                        <span className="text-xs text-slate-600 font-medium">{METHOD_LABELS[key]}</span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};

const LatencyChart: React.FC<{ methods: Record<string, MethodMetrics> }> = ({ methods }) => {
    const maxMs = Math.max(...METHODS.map(m => methods[m]?.avg_total_ms ?? 0));
    return (
        <motion.div
            className="glass-card p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
        >
            <div className="section-label">
                <span>Performance</span>
            </div>
            <h3 className="font-bold text-slate-800 mb-1">Latency Breakdown</h3>
            <p className="text-xs text-slate-400 mb-4">Average ms per stage across all benchmark questions</p>
            <div className="space-y-4">
                {METHODS.map((method, i) => {
                    const r = methods[method];
                    if (!r) return null;
                    const ret = r.avg_retrieve_ms ?? 0;
                    const rer = r.avg_rerank_ms ?? 0;
                    const gen = r.avg_generate_ms ?? 0;
                    const total = ret + rer + gen || 1;
                    const barW = `${Math.round((total / maxMs) * 100)}%`;
                    return (
                        <motion.div
                            key={method}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 + i * 0.1 }}
                        >
                            <div className="flex justify-between text-xs mb-1">
                                <span className="font-semibold text-slate-700">{METHOD_LABELS[method]}</span>
                                <span className="text-slate-400 font-mono">{Math.round(total).toLocaleString()} ms</span>
                            </div>
                            <div className="h-5 rounded-lg overflow-hidden flex bg-slate-50" style={{ width: barW }}>
                                <div className="rounded-l-lg" style={{ width: `${(ret / total) * 100}%`, background: '#0d9488' }} title={`Retrieve: ${ret.toFixed(0)}ms`} />
                                <div style={{ width: `${(rer / total) * 100}%`, background: '#6366f1' }} title={`Rerank: ${rer.toFixed(0)}ms`} />
                                <div className="rounded-r-lg" style={{ width: `${(gen / total) * 100}%`, background: '#f59e0b' }} title={`Generate: ${gen.toFixed(0)}ms`} />
                            </div>
                        </motion.div>
                    );
                })}
            </div>
            <div className="flex gap-4 mt-4">
                {[['Retrieve', '#0d9488'], ['Rerank', '#6366f1'], ['Generate', '#f59e0b']].map(([l, c]) => (
                    <div key={l} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm" style={{ background: c as string }} />
                        <span className="text-xs text-slate-500">{l}</span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};

// ─── Animated Counter ─────────────────────────────────────────────────────────
const AnimatedNumber: React.FC<{ value: number; decimals?: number }> = ({ value, decimals = 3 }) => {
    const [display, setDisplay] = React.useState(0);
    React.useEffect(() => {
        const duration = 1200;
        const startTime = performance.now();
        const tick = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(eased * value);
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, [value]);
    return <span>{display.toFixed(decimals)}</span>;
};

// ─── Radar Chart ──────────────────────────────────────────────────────────────
const RadarChart: React.FC<{ methods: Record<string, MethodMetrics> }> = ({ methods }) => {
    const CX = 200; const CY = 180; const R = 130;
    const axes = [
        { label: 'KW Overlap', key: 'avg_keyword_overlap' as keyof MethodMetrics, max: 1 },
        { label: 'Temporal KW', key: 'temporal_keyword_overlap' as keyof MethodMetrics, max: 1 },
        { label: '% Stats', key: 'pct_with_statistics' as keyof MethodMetrics, max: 1 },
        { label: 'Src Year Norm', key: 'avg_source_year' as keyof MethodMetrics, max: 2030, min: 2000 } as any,
        { label: 'Speed (inv)', key: 'avg_total_ms' as keyof MethodMetrics, max: 10000, invert: true } as any,
    ];
    const n = axes.length;
    const angleOf = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
    const pt = (i: number, r: number) => ({
        x: CX + r * Math.cos(angleOf(i)),
        y: CY + r * Math.sin(angleOf(i)),
    });
    const normalize = (val: number | undefined, ax: any) => {
        if (val == null) return 0;
        const min = ax.min ?? 0;
        const raw = ax.invert ? 1 - Math.min(val, ax.max) / ax.max : (val - min) / (ax.max - min);
        return Math.max(0, Math.min(1, raw));
    };
    const methodPolygon = (method: string, color: string) => {
        const m = methods[method];
        if (!m) return null;
        const points = axes.map((ax, i) => {
            const r = normalize(m[ax.key] as number, ax) * R;
            const p = pt(i, r);
            return `${p.x},${p.y}`;
        }).join(' ');
        return (
            <motion.polygon key={method} points={points} fill={color} fillOpacity="0.15" stroke={color} strokeWidth="2"
                initial={{ opacity: 0, scale: 0.3 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, type: 'spring' }} style={{ transformOrigin: `${CX}px ${CY}px` }} />
        );
    };
    return (
        <motion.div className="glass-card p-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <div className="section-label"><span>Radar View</span></div>
            <h3 className="font-bold text-slate-800 mb-1">Multi-Metric Radar</h3>
            <p className="text-xs text-slate-400 mb-3">All 4 methods compared across 5 radar axes simultaneously</p>
            <svg viewBox={`0 0 ${CX * 2} ${CY * 2 + 20}`} className="w-full">
                {[0.25, 0.5, 0.75, 1].map(f => (
                    <polygon key={f} points={axes.map((_: any, i: number) => { const p = pt(i, f * R); return `${p.x},${p.y}`; }).join(' ')}
                        fill="none" stroke="#e2e8f0" strokeWidth="1" />
                ))}
                {axes.map((ax: any, i: number) => {
                    const outer = pt(i, R + 5);
                    const label = pt(i, R + 22);
                    return (
                        <g key={ax.key}>
                            <line x1={CX} y1={CY} x2={outer.x} y2={outer.y} stroke="#cbd5e1" strokeWidth="1" />
                            <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#64748b">{ax.label}</text>
                        </g>
                    );
                })}
                {METHODS.filter(m => methods[m]).map(m => methodPolygon(m, METHOD_COLORS[m]))}
            </svg>
            <div className="flex flex-wrap gap-3 mt-2">
                {METHODS.filter(m => methods[m]).map(m => (
                    <div key={m} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full" style={{ background: METHOD_COLORS[m] }} />
                        <span className="text-xs text-slate-600 font-medium">{METHOD_LABELS[m]}</span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};

export const EvalDashboard: React.FC = () => {
    const toast = useToast();
    const [api, setApi] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`${BASE_URL}/metrics`)
            .then(r => r.json())
            .then((d: ApiResponse) => { setApi(d); setLoading(false); })
            .catch(() => { setError('Could not connect to backend.'); setLoading(false); });
    }, []);

    const payload = api?.results as MetricsPayload | undefined;
    const methodsData = payload?.methods;
    const hasMethods = !!methodsData && Object.keys(methodsData).length > 0;

    const bestMethod = (field: keyof MethodMetrics, higher = true) =>
        METHODS.filter(m => methodsData?.[m]).reduce((best, m) => {
            const bv = methodsData![best]?.[field] ?? (higher ? -Infinity : Infinity);
            const mv = methodsData![m]?.[field] ?? (higher ? -Infinity : Infinity);
            return higher ? (mv > bv ? m : best) : (mv < bv ? m : best);
        }, METHODS[0]);

    const exportLatex = () => {
        if (!methodsData) return;
        const header = `\\begin{table}[h!]
\\centering
\\caption{Temporal RAG Decay Method Comparison}
\\label{tab:decay_comparison}
\\begin{tabular}{lrrrrr}
\\hline
\\textbf{Method} & \\textbf{KW Overlap} & \\textbf{Temporal KW} & \\textbf{\\% Stats} & \\textbf{Avg Src Year} & \\textbf{Latency (ms)} \\\\\
\\hline`;
        const rows = METHODS.filter(m => methodsData[m]).map(m => {
            const r = methodsData[m];
            return `${METHOD_LABELS[m]} & ${r.avg_keyword_overlap?.toFixed(3) ?? '-'} & ${r.temporal_keyword_overlap?.toFixed(3) ?? '-'} & ${r.pct_with_statistics != null ? (r.pct_with_statistics * 100).toFixed(1) : '-'}\\% & ${r.avg_source_year?.toFixed(1) ?? '-'} & ${r.avg_total_ms != null ? Math.round(r.avg_total_ms) : '-'} \\\\`;
        }).join('\n');
        const footer = `\\hline
\\end{tabular}
\\end{table}`;
        const latex = [header, rows, footer].join('\n');
        navigator.clipboard.writeText(latex).then(() => toast.success('LaTeX table copied to clipboard ✅'));
    };

    return (
        <div className="max-w-6xl mx-auto py-6 space-y-8">
            {/* Gradient Header */}
            <div className="page-gradient-header">
                <div className="header-badge">
                    <span className="dot"></span>
                    RAGAS Benchmarks
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-rose-600 p-2.5 rounded-xl" style={{ position: 'relative', zIndex: 1 }}>
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <h2>Evaluation Dashboard</h2>
                        <p>RAGAS-style benchmarks across all temporal decay methods — for IEEE publication</p>
                    </div>
                </div>
                {payload?.generated_at && (
                    <div className="mt-3 flex items-center gap-3" style={{ position: 'relative', zIndex: 1 }}>
                        <span className="bg-white/10 text-white/70 text-[10px] font-bold px-3 py-1 rounded-full">
                            Last run: {new Date(payload.generated_at).toLocaleString()}
                        </span>
                        <span className="bg-white/10 text-white/70 text-[10px] font-bold px-3 py-1 rounded-full">
                            {payload.n_questions} questions
                        </span>
                    </div>
                )}
            </div>

            {loading && (
                <div className="space-y-4">
                    <div className="h-16 bg-slate-100 animate-pulse rounded-2xl" />
                    <div className="h-48 bg-slate-100 animate-pulse rounded-2xl" />
                </div>
            )}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl text-sm"
                >
                    {error}
                </motion.div>
            )}

            {!loading && !error && !hasMethods && (
                <motion.div
                    className="glass-card p-10 text-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="bg-amber-50 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <p className="text-slate-800 font-semibold text-lg mb-2">No evaluation results yet</p>
                    <p className="text-slate-500 text-sm mb-4">Run the RAGAS evaluation to populate this dashboard</p>
                    <code className="bg-slate-900 text-emerald-300 px-5 py-2.5 rounded-xl text-sm block max-w-md mx-auto font-mono">
                        python evaluation/ragas_eval.py
                    </code>
                </motion.div>
            )}

            {hasMethods && methodsData && (
                <motion.div
                    className="glass-card overflow-hidden"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <div className="section-label" style={{ marginBottom: '0.25rem' }}>
                                <span>Comparison</span>
                            </div>
                            <h3 className="font-bold text-slate-800">Method Comparison</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                {payload?.n_questions} questions · <span className="text-rose-500">Bold = best</span>
                            </span>
                            <button onClick={exportLatex}
                                className="text-xs bg-slate-900 text-emerald-400 px-3 py-1.5 rounded-lg font-mono hover:bg-slate-800 transition-colors flex items-center gap-1.5">
                                📋 Copy as LaTeX
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-widest">
                                <tr>
                                    <th className="px-6 py-3 text-left font-bold">Method</th>
                                    <th className="px-4 py-3 text-right font-bold">KW Overlap ↑</th>
                                    <th className="px-4 py-3 text-right font-bold">Temporal KW ↑</th>
                                    <th className="px-4 py-3 text-right font-bold">% w/ Stats ↑</th>
                                    <th className="px-4 py-3 text-right font-bold">Avg Src Year ↑</th>
                                    <th className="px-4 py-3 text-right font-bold">Latency ms ↓</th>
                                </tr>
                            </thead>
                            <tbody>
                                {METHODS.map((method, i) => {
                                    const r = methodsData[method];
                                    if (!r) return null;
                                    const isTop = (field: keyof MethodMetrics, higher = true) => bestMethod(field, higher) === method;
                                    const cell = (v: number | undefined, field: keyof MethodMetrics, dec = 3, higher = true) => (
                                        <td className={`px-4 py-4 text-right font-mono text-sm ${isTop(field, higher) ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                                            {v != null ? <AnimatedNumber value={v} decimals={dec} /> : '—'}
                                            {isTop(field, higher) && v != null && (
                                                <span className="ml-1 text-[8px] bg-rose-50 text-rose-500 px-1.5 py-0.5 rounded-full font-bold">BEST</span>
                                            )}
                                        </td>
                                    );
                                    return (
                                        <motion.tr
                                            key={method}
                                            className={`border-t border-slate-100 hover:bg-slate-50/60 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.15 + i * 0.08 }}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-offset-2 ring-opacity-20" style={{ background: METHOD_COLORS[method], boxShadow: `0 0 0 3px ${METHOD_COLORS[method]}20` }} />
                                                    <span className="font-semibold text-slate-700">{METHOD_LABELS[method]}</span>
                                                </div>
                                            </td>
                                            {cell(r.avg_keyword_overlap, 'avg_keyword_overlap')}
                                            {cell(r.temporal_keyword_overlap, 'temporal_keyword_overlap')}
                                            {cell(r.pct_with_statistics != null ? r.pct_with_statistics * 100 : undefined, 'pct_with_statistics', 1)}
                                            {cell(r.avg_source_year, 'avg_source_year', 1)}
                                            <td className={`px-4 py-4 text-right font-mono text-sm ${isTop('avg_total_ms', false) ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                                                {r.avg_total_ms != null ? Math.round(r.avg_total_ms).toLocaleString() : '—'}
                                                {isTop('avg_total_ms', false) && r.avg_total_ms != null && (
                                                    <span className="ml-1 text-[8px] bg-rose-50 text-rose-500 px-1.5 py-0.5 rounded-full font-bold">BEST</span>
                                                )}
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DecayChart />
                {hasMethods && methodsData
                    ? <LatencyChart methods={methodsData} />
                    : (
                        <div className="glass-card p-6 flex items-center justify-center text-slate-400 text-sm">
                            <div className="text-center">
                                <svg className="w-8 h-8 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Latency chart available after running evaluation
                            </div>
                        </div>
                    )}
            </div>

            {/* Radar Chart */}
            {hasMethods && methodsData && (
                <RadarChart methods={methodsData} />
            )}

            {/* How to run */}
            <motion.div
                className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 border border-slate-700"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
            >
                <h3 className="font-bold mb-4 text-rose-400 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    How to run the evaluation
                </h3>
                <div className="space-y-3 text-sm font-mono">
                    <div className="bg-white/5 rounded-xl p-3">
                        <p className="text-slate-400 text-xs mb-1"># Step 1: Full RAGAS evaluation (~15-20 min)</p>
                        <code className="text-emerald-300">python evaluation/ragas_eval.py</code>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                        <p className="text-slate-400 text-xs mb-1"># Step 2: Paper-ready table + LaTeX</p>
                        <code className="text-emerald-300">python evaluation/ablation_study.py</code>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                        <p className="text-slate-400 text-xs mb-1"># Step 3: Restart backend to serve updated metrics</p>
                        <code className="text-emerald-300">python backend/app.py</code>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
