
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PRIMARY = "#F43F5E";

const MESSAGES = [
    "Searching NIH databases...",
    "Cross-referencing WHO guidelines...",
    "Querying PubMed literature...",
    "Evaluating clinical evidence...",
    "Synthesizing research findings...",
    "Reviewing journal publications...",
];

export const EKGPulseLoader: React.FC = () => {
    const [msgIndex, setMsgIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setMsgIndex((prev) => (prev + 1) % MESSAGES.length);
        }, 2500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full flex flex-col items-center justify-center py-16 bg-[#090D14] rounded-3xl relative overflow-hidden">
            {/* Ambient glow */}
            <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-lg max-h-64 rounded-full blur-[120px] opacity-20"
                style={{ backgroundColor: PRIMARY }}
            />

            <div className="relative z-10 flex flex-col items-center w-full">
                {/* EKG SVG */}
                <div className="w-full max-w-lg h-[140px] relative">
                    <svg viewBox="0 0 600 200" className="w-full h-full overflow-visible">
                        {/* Faint static background track */}
                        <path
                            d="M 0 100 L 150 100 L 180 40 L 220 180 L 260 20 L 300 130 L 330 100 L 450 100 L 480 70 L 510 130 L 540 100 L 600 100"
                            fill="none"
                            stroke={PRIMARY}
                            strokeWidth="4"
                            strokeOpacity="0.12"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />
                        {/* Animated glowing path */}
                        <motion.path
                            d="M 0 100 L 150 100 L 180 40 L 220 180 L 260 20 L 300 130 L 330 100 L 450 100 L 480 70 L 510 130 L 540 100 L 600 100"
                            fill="none"
                            stroke={PRIMARY}
                            strokeWidth="5"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            initial={{ pathLength: 0.2, pathOffset: 1 }}
                            animate={{ pathOffset: [1, -0.2] }}
                            transition={{ duration: 2.5, ease: "linear", repeat: Infinity, repeatType: "loop" }}
                            style={{ filter: `drop-shadow(0px 0px 12px ${PRIMARY})` }}
                        />
                    </svg>
                </div>

                {/* Cycling message */}
                <div className="mt-6 h-12 flex items-center justify-center text-white text-xl font-medium tracking-wide text-center px-6">
                    <AnimatePresence mode="wait">
                        <motion.p
                            key={msgIndex}
                            initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
                            transition={{ duration: 0.4 }}
                        >
                            {MESSAGES[msgIndex]}
                        </motion.p>
                    </AnimatePresence>
                </div>

                {/* Subtext */}
                <motion.p
                    className="mt-3 text-xs font-light tracking-widest uppercase opacity-50"
                    style={{ color: PRIMARY }}
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                    CARDIO-AI RESEARCH ENGINE
                </motion.p>
            </div>
        </div>
    );
};
