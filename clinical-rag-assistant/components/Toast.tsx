import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warn' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    message: string;
}

interface ToastContextValue {
    success: (msg: string) => void;
    error: (msg: string) => void;
    warn: (msg: string) => void;
    info: (msg: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const icons: Record<ToastType, string> = {
    success: '✅',
    error: '❌',
    warn: '⚠️',
    info: 'ℹ️',
};

const colors: Record<ToastType, string> = {
    success: 'from-emerald-500/20 to-emerald-500/10 border-emerald-500/30 text-emerald-300',
    error: 'from-rose-500/20 to-rose-500/10 border-rose-500/30 text-rose-300',
    warn: 'from-amber-500/20 to-amber-500/10 border-amber-500/30 text-amber-300',
    info: 'from-blue-500/20 to-blue-500/10 border-blue-500/30 text-blue-300',
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const timerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const addToast = useCallback((type: ToastType, message: string) => {
        const id = `${Date.now()}-${Math.random()}`;
        setToasts(prev => [...prev, { id, type, message }]);
        timerRef.current[id] = setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
            delete timerRef.current[id];
        }, 4000);
    }, []);

    const dismiss = (id: string) => {
        clearTimeout(timerRef.current[id]);
        delete timerRef.current[id];
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    useEffect(() => () => Object.values(timerRef.current).forEach(clearTimeout), []);

    const value: ToastContextValue = {
        success: (msg) => addToast('success', msg),
        error: (msg) => addToast('error', msg),
        warn: (msg) => addToast('warn', msg),
        info: (msg) => addToast('info', msg),
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            {/* Toast container */}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '360px' }}>
                <AnimatePresence>
                    {toasts.map(t => (
                        <motion.div
                            key={t.id}
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border bg-gradient-to-r backdrop-blur-xl shadow-xl ${colors[t.type]}`}
                            onClick={() => dismiss(t.id)}
                        >
                            <span className="text-base flex-shrink-0 mt-0.5">{icons[t.type]}</span>
                            <p className="text-sm font-medium leading-snug flex-1">{t.message}</p>
                            <button className="flex-shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity text-xs mt-0.5">✕</button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};
