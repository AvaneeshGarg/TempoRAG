import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SplashScreenProps {
    onComplete: () => void;
    minimumDuration?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
    onComplete,
    minimumDuration = 3500
}) => {
    const [stage, setStage] = useState<1 | 2 | 3>(1);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        // Hide the HTML-level splash (if it exists) once React takes over
        const htmlSplash = document.getElementById('html-splash');
        if (htmlSplash) {
            htmlSplash.style.display = 'none';
        }

        // Stage 1: Pulse (0–1.5s)
        const stage2Timer = setTimeout(() => setStage(2), 1500);

        // Stage 2: Expand (1.5–3s)  
        const stage3Timer = setTimeout(() => setStage(3), 3000);

        // Stage 3: Exit transition
        const exitTimer = setTimeout(() => {
            setIsExiting(true);
        }, minimumDuration);

        // Complete after exit animation
        const completeTimer = setTimeout(() => {
            onComplete();
        }, minimumDuration + 800);

        return () => {
            clearTimeout(stage2Timer);
            clearTimeout(stage3Timer);
            clearTimeout(exitTimer);
            clearTimeout(completeTimer);
        };
    }, [onComplete, minimumDuration]);

    return (
        <AnimatePresence>
            {!isExiting ? (
                <motion.div
                    key="splash"
                    className="splash-container"
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: 'easeInOut' }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#0f172a',
                        overflow: 'hidden',
                    }}
                >
                    {/* Animated background glow */}
                    <motion.div
                        className="splash-bg-glow"
                        animate={{
                            scale: stage >= 2 ? [1, 1.5, 1.2] : [1, 1.1, 1],
                            opacity: stage >= 2 ? [0.3, 0.6, 0.4] : [0.15, 0.3, 0.15],
                        }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        style={{
                            position: 'absolute',
                            width: '600px',
                            height: '600px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(225,29,72,0.25) 0%, rgba(225,29,72,0.05) 50%, transparent 70%)',
                            filter: 'blur(60px)',
                        }}
                    />

                    {/* Pulse rings */}
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={`ring-${i}`}
                            animate={{
                                scale: [1, 2.5, 3],
                                opacity: [0.6, 0.2, 0],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                delay: i * 0.7,
                                ease: 'easeOut',
                            }}
                            style={{
                                position: 'absolute',
                                width: '120px',
                                height: '120px',
                                borderRadius: '50%',
                                border: '2px solid rgba(225,29,72,0.4)',
                            }}
                        />
                    ))}

                    {/* Floating particles */}
                    {Array.from({ length: 12 }).map((_, i) => (
                        <motion.div
                            key={`particle-${i}`}
                            initial={{
                                x: (Math.random() - 0.5) * 300,
                                y: (Math.random() - 0.5) * 300,
                                opacity: 0,
                                scale: 0,
                            }}
                            animate={{
                                x: (Math.random() - 0.5) * 400,
                                y: (Math.random() - 0.5) * 400,
                                opacity: [0, 0.6, 0],
                                scale: [0, 1, 0],
                            }}
                            transition={{
                                duration: 3 + Math.random() * 2,
                                repeat: Infinity,
                                delay: Math.random() * 2,
                                ease: 'easeInOut',
                            }}
                            style={{
                                position: 'absolute',
                                width: `${3 + Math.random() * 4}px`,
                                height: `${3 + Math.random() * 4}px`,
                                borderRadius: '50%',
                                background: i % 3 === 0
                                    ? 'rgba(225,29,72,0.8)'
                                    : i % 3 === 1
                                        ? 'rgba(244,63,94,0.6)'
                                        : 'rgba(255,255,255,0.4)',
                            }}
                        />
                    ))}

                    {/* EKG line animation */}
                    <motion.svg
                        width="400"
                        height="60"
                        viewBox="0 0 400 60"
                        style={{ position: 'absolute', top: '55%', marginTop: '80px' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: stage >= 2 ? 0.5 : 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <motion.path
                            d="M0,30 L80,30 L100,30 L120,10 L135,50 L150,5 L165,55 L180,25 L200,30 L400,30"
                            fill="none"
                            stroke="rgba(225,29,72,0.5)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: stage >= 2 ? 1 : 0 }}
                            transition={{ duration: 2, ease: 'easeInOut' }}
                        />
                    </motion.svg>

                    {/* Logo */}
                    <motion.div
                        animate={{
                            scale: stage === 1 ? [0.8, 1, 0.8] : stage === 2 ? 1.15 : 1.15,
                        }}
                        transition={
                            stage === 1
                                ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
                                : { duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }
                        }
                        style={{
                            position: 'relative',
                            zIndex: 2,
                        }}
                    >
                        <motion.div
                            style={{
                                position: 'absolute',
                                inset: '-20px',
                                borderRadius: '50%',
                                background: 'radial-gradient(circle, rgba(225,29,72,0.3), transparent 70%)',
                                filter: 'blur(15px)',
                            }}
                            animate={{
                                scale: [1, 1.3, 1],
                                opacity: [0.5, 1, 0.5],
                            }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <img
                            src="/logo.png"
                            alt="Clinical RAG Logo"
                            style={{
                                width: '140px',
                                height: '140px',
                                objectFit: 'contain',
                                filter: 'drop-shadow(0 0 30px rgba(225,29,72,0.5))',
                                position: 'relative',
                                zIndex: 2,
                            }}
                        />
                    </motion.div>

                    {/* Text - appears in Stage 2 */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{
                            opacity: stage >= 2 ? 1 : 0,
                            y: stage >= 2 ? 0 : 20,
                        }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        style={{
                            marginTop: '32px',
                            textAlign: 'center',
                            position: 'relative',
                            zIndex: 2,
                        }}
                    >
                        <motion.h1
                            style={{
                                fontSize: '2rem',
                                fontWeight: 700,
                                color: '#ffffff',
                                letterSpacing: '-0.02em',
                                margin: 0,
                                fontFamily: "'Inter', sans-serif",
                            }}
                        >
                            {'Clinical RAG'.split('').map((char, i) => (
                                <motion.span
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{
                                        opacity: stage >= 2 ? 1 : 0,
                                        y: stage >= 2 ? 0 : 10,
                                    }}
                                    transition={{ delay: i * 0.06, duration: 0.4 }}
                                >
                                    {char}
                                </motion.span>
                            ))}
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: stage >= 2 ? 1 : 0 }}
                            transition={{ delay: 0.8, duration: 0.6 }}
                            style={{
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                color: 'rgba(225,29,72,0.7)',
                                letterSpacing: '0.2em',
                                textTransform: 'uppercase',
                                marginTop: '8px',
                                fontFamily: "'Inter', sans-serif",
                            }}
                        >
                            Diagnostics Hub
                        </motion.p>
                    </motion.div>

                    {/* Tagline - appears in Stage 2 with delay */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: stage >= 2 ? 1 : 0 }}
                        transition={{ delay: 1.2, duration: 0.6 }}
                        style={{
                            marginTop: '24px',
                            fontSize: '0.8rem',
                            color: 'rgba(148,163,184,0.7)',
                            fontFamily: "'Inter', sans-serif",
                            letterSpacing: '0.05em',
                            position: 'relative',
                            zIndex: 2,
                        }}
                    >
                        Evidence-Based Cardiology Intelligence
                    </motion.p>

                    {/* Bottom timeline indicator */}
                    <motion.div
                        style={{
                            position: 'absolute',
                            bottom: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                        }}
                    >
                        {[
                            { label: 'Initializing', num: 1 },
                            { label: 'Loading', num: 2 },
                            { label: 'Ready', num: 3 },
                        ].map((s, i) => (
                            <React.Fragment key={s.num}>
                                {i > 0 && (
                                    <motion.div
                                        style={{
                                            width: '40px',
                                            height: '2px',
                                            background: stage >= s.num
                                                ? 'rgba(225,29,72,0.6)'
                                                : 'rgba(71,85,105,0.3)',
                                        }}
                                        animate={{
                                            background: stage >= s.num
                                                ? 'rgba(225,29,72,0.6)'
                                                : 'rgba(71,85,105,0.3)',
                                        }}
                                        transition={{ duration: 0.4 }}
                                    />
                                )}
                                <motion.div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '6px',
                                    }}
                                >
                                    <motion.div
                                        animate={{
                                            background:
                                                stage === s.num
                                                    ? '#e11d48'
                                                    : stage > s.num
                                                        ? 'rgba(225,29,72,0.5)'
                                                        : 'rgba(71,85,105,0.3)',
                                            scale: stage === s.num ? [1, 1.2, 1] : 1,
                                        }}
                                        transition={
                                            stage === s.num
                                                ? { scale: { duration: 1, repeat: Infinity } }
                                                : { duration: 0.3 }
                                        }
                                        style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                        }}
                                    />
                                    <span
                                        style={{
                                            fontSize: '0.6rem',
                                            fontWeight: 600,
                                            color:
                                                stage >= s.num
                                                    ? 'rgba(225,29,72,0.7)'
                                                    : 'rgba(71,85,105,0.4)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.1em',
                                            fontFamily: "'Inter', sans-serif",
                                        }}
                                    >
                                        {s.label}
                                    </span>
                                </motion.div>
                            </React.Fragment>
                        ))}
                    </motion.div>

                    {/* Viewport border glow */}
                    <motion.div
                        animate={{
                            opacity: [0.3, 0.6, 0.3],
                        }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            border: '1px solid rgba(225,29,72,0.15)',
                            boxShadow: 'inset 0 0 80px rgba(225,29,72,0.05)',
                            pointerEvents: 'none',
                        }}
                    />
                </motion.div>
            ) : (
                /* Exit transition — wipe reveal */
                <motion.div
                    key="splash-exit"
                    initial={{ clipPath: 'circle(150% at 50% 50%)' }}
                    animate={{ clipPath: 'circle(0% at 50% 50%)' }}
                    transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999,
                        background: '#0f172a',
                        pointerEvents: 'none',
                    }}
                />
            )}
        </AnimatePresence>
    );
};
