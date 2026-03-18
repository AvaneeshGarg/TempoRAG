import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import { HeartIcon } from './Icons';

// ── Provider Icons ────────────────────────────────────────────────────────────
const GoogleIcon = () => (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
);

const GitHubIcon = () => (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.089-.744.083-.729.083-.729 1.205.084 1.84 1.236 1.84 1.236 1.07 1.835 2.807 1.305 3.492.998.108-.776.418-1.305.762-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.572C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
);

// ── Main Login Page ───────────────────────────────────────────────────────────
export const LoginPage: React.FC = () => {
    const { loginWithGoogle, loginWithGitHub, loginAsGuest } = useAuth();
    const toast = useToast();
    const [googleLoading, setGoogleLoading] = useState(false);
    const [githubLoading, setGithubLoading] = useState(false);

    const handleGoogle = () => {
        setGoogleLoading(true);
        loginWithGoogle(); // redirects away; loading state is just UX feedback
    };

    const handleGitHub = () => {
        setGithubLoading(true);
        loginWithGitHub();
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1a0a14 50%, #0f172a 100%)' }}>

            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
                    style={{ background: 'radial-gradient(circle, rgba(225,29,72,0.12) 0%, transparent 70%)' }} />
                {['💊', '🫀', '🧬', '📋', '🩺'].map((icon, i) => (
                    <div key={i} className="absolute text-4xl opacity-5 select-none"
                        style={{ left: `${10 + i * 20}%`, top: `${15 + (i % 3) * 25}%`, transform: `rotate(${i * 15}deg)` }}>
                        {icon}
                    </div>
                ))}
            </div>

            <motion.div
                className="relative w-full max-w-md mx-4"
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                {/* Glassmorphism card */}
                <div className="rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
                    style={{ background: 'rgba(15,23,42,0.88)', backdropFilter: 'blur(24px)' }}>

                    {/* Header */}
                    <div className="flex flex-col items-center pt-10 pb-6 px-8 border-b border-white/5">
                        <motion.div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
                            style={{ background: 'linear-gradient(135deg, #e11d48, #9f1239)' }}
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            <HeartIcon className="w-8 h-8 text-white" />
                        </motion.div>
                        <h1 className="text-white font-bold text-2xl tracking-tight">Clinical RAG Hub</h1>
                        <p className="text-slate-400 text-sm mt-1">Evidence-Based Diagnostics Assistant</p>
                    </div>

                    <div className="p-8 space-y-4">
                        {/* Subtitle */}
                        <p className="text-center text-slate-400 text-sm">
                            Sign in securely with your existing account
                        </p>

                        {/* ── Google ── */}
                        <motion.button
                            onClick={handleGoogle}
                            disabled={googleLoading || githubLoading}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 rounded-xl py-3.5 text-sm font-semibold hover:bg-gray-100 transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {googleLoading
                                ? <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                : <GoogleIcon />}
                            {googleLoading ? 'Redirecting to Google...' : 'Continue with Google'}
                        </motion.button>

                        {/* ── GitHub ── */}
                        <motion.button
                            onClick={handleGitHub}
                            disabled={googleLoading || githubLoading}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full flex items-center justify-center gap-3 bg-slate-800 text-white border border-white/10 rounded-xl py-3.5 text-sm font-semibold hover:bg-slate-700 transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {githubLoading
                                ? <span className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                : <GitHubIcon />}
                            {githubLoading ? 'Redirecting to GitHub...' : 'Continue with GitHub'}
                        </motion.button>

                        {/* Divider */}
                        <div className="flex items-center gap-3 py-1">
                            <div className="flex-1 h-px bg-white/10" />
                            <span className="text-slate-600 text-xs font-medium uppercase tracking-wider">or</span>
                            <div className="flex-1 h-px bg-white/10" />
                        </div>

                        {/* Guest access */}
                        <button
                            type="button"
                            onClick={() => {
                                loginAsGuest();
                                toast.info('Guest access: Research Pulse only (3 searches).');
                            }}
                            className="w-full flex items-center justify-center gap-2 text-slate-500 text-xs py-2 hover:text-slate-300 transition-colors rounded-lg hover:bg-white/5"
                        >
                            🔒 Continue as Guest
                            <span className="text-slate-600">(Research only · 3 searches)</span>
                        </button>

                        {/* Trust badges */}
                        <div className="pt-2 border-t border-white/5 flex items-center justify-center gap-4 text-slate-600 text-[10px] uppercase tracking-widest">
                            <span>🔐 OAuth 2.0</span>
                            <span>·</span>
                            <span>🍪 HTTPOnly Cookie</span>
                            <span>·</span>
                            <span>🔑 JWT Signed</span>
                        </div>
                    </div>
                </div>

                {/* Footer note */}
                <p className="text-center text-slate-600 text-[10px] mt-4">
                    We never store passwords. Your identity is verified by Google or GitHub.
                </p>
            </motion.div>
        </div>
    );
};
