import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CARDIOLOGY_HINTS = [
    'What are the latest guidelines for heart failure with reduced ejection fraction?',
    'SGLT2 inhibitors in HFrEF — what does the evidence say?',
    'How does spironolactone affect outcomes in heart failure?',
    'What is the role of cardiac resynchronization therapy?',
    'Sacubitril/valsartan vs enalapril in heart failure outcomes',
    'Management of atrial fibrillation in heart failure patients',
    'Beta-blocker selection in heart failure — carvedilol vs metoprolol',
    'What are the BNP threshold criteria for heart failure diagnosis?',
    'ARNI therapy in HFpEF: current evidence',
    'Ivabradine in patients with heart rate > 75 on beta-blockers',
    'Diuretic resistance in advanced heart failure — management strategies',
    'Iron deficiency treatment in heart failure patients',
    'Echocardiographic parameters for HFpEF diagnosis',
    'Palliative care considerations in end-stage heart failure',
    'Hypertrophic cardiomyopathy — ICD indications',
    'Dapagliflozin vs empagliflozin in heart failure outcomes',
    'Cardiac biomarkers in acute decompensated heart failure',
    'Vericiguat in worsening heart failure with reduced ejection fraction',
    'Sleep-disordered breathing and heart failure — SERVE-HF trial',
    'Exercise training in stable chronic heart failure',
    'Remote monitoring for heart failure — HeartLogic device',
    'Digoxin in modern heart failure management',
    'Tafamidis in transthyretin cardiac amyloidosis',
    'Intravenous iron in heart failure — AFFIRM-AHF trial',
    'Left ventricular assist device indications and outcomes',
    'Mitral valve repair in functional mitral regurgitation with heart failure',
    'Cardio-renal syndrome in decompensated heart failure',
    'Cardiac rehabilitation in heart failure patients',
    'Natriuretic peptide-guided therapy in chronic heart failure',
    'Telemonitoring and heart failure readmission rates',
];

interface Props {
    value: string;
    onSelect: (hint: string) => void;
}

export const QuerySuggest: React.FC<Props> = ({ value, onSelect }) => {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (value.length < 3) {
            setSuggestions([]);
            setActiveIndex(-1);
            return;
        }
        const lower = value.toLowerCase();
        const filtered = CARDIOLOGY_HINTS.filter(h =>
            h.toLowerCase().includes(lower)
        ).slice(0, 5);
        setSuggestions(filtered);
        setActiveIndex(-1);
    }, [value]);

    const handleKeyDown = (e: KeyboardEvent) => {
        if (!suggestions.length) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, suggestions.length - 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, -1)); }
        if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); onSelect(suggestions[activeIndex]); setSuggestions([]); }
        if (e.key === 'Escape') setSuggestions([]);
    };

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [suggestions, activeIndex]);

    if (!suggestions.length) return null;

    // Highlight matching part
    const highlight = (text: string) => {
        const idx = text.toLowerCase().indexOf(value.toLowerCase());
        if (idx === -1) return <span>{text}</span>;
        return (
            <>
                {text.slice(0, idx)}
                <span className="text-rose-400 font-semibold">{text.slice(idx, idx + value.length)}</span>
                {text.slice(idx + value.length)}
            </>
        );
    };

    return (
        <AnimatePresence>
            <motion.div
                ref={containerRef}
                className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border border-white/10 shadow-2xl overflow-hidden z-50"
                style={{ background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(16px)' }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
            >
                <div className="px-3 py-2 border-b border-white/5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Suggested Queries</span>
                </div>
                {suggestions.map((s, i) => (
                    <button
                        key={s}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-start gap-2 ${i === activeIndex ? 'bg-rose-900/30 text-white' : 'text-slate-300 hover:bg-white/5'
                            }`}
                        onClick={() => { onSelect(s); setSuggestions([]); }}
                    >
                        <span className="text-slate-600 mt-0.5 flex-shrink-0">🔍</span>
                        <span className="leading-snug">{highlight(s)}</span>
                    </button>
                ))}
            </motion.div>
        </AnimatePresence>
    );
};
