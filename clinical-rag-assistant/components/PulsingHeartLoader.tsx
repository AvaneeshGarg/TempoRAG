
import React from "react";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";

interface PulsingHeartLoaderProps {
    phrase?: string;
}

export const PulsingHeartLoader: React.FC<PulsingHeartLoaderProps> = ({
    phrase = "Thinking...",
}) => {
    const pulseSpeed = 1.4;

    return (
        <div className="flex items-start gap-3 mb-8">
            {/* Chat bubble wrapper */}
            <div className="flex flex-col items-start gap-2">
                {/* Heart animation */}
                <div className="relative w-16 h-16 flex items-center justify-center">
                    {/* Expanding rings */}
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            className="absolute w-full h-full rounded-full border border-rose-300"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: [0.5, 1.5, 2], opacity: [0, 0.5, 0] }}
                            transition={{
                                duration: pulseSpeed * 2,
                                repeat: Infinity,
                                ease: "easeOut",
                                delay: i * ((pulseSpeed * 2) / 3),
                            }}
                        />
                    ))}

                    {/* Glow blob */}
                    <motion.div
                        className="absolute w-10 h-10 bg-rose-400 rounded-full blur-[16px]"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
                        transition={{ duration: pulseSpeed, repeat: Infinity, ease: "easeInOut" }}
                    />

                    {/* Heart icon — lub-dub beat */}
                    <motion.div
                        className="relative z-10"
                        animate={{ scale: [1, 1.18, 0.94, 1.06, 1] }}
                        transition={{
                            duration: pulseSpeed,
                            repeat: Infinity,
                            times: [0, 0.15, 0.3, 0.45, 1],
                            ease: "easeInOut",
                        }}
                    >
                        <Heart size={32} className="fill-rose-500 text-rose-500 drop-shadow-md" />
                    </motion.div>
                </div>

                {/* Cycling phrase */}
                <div className="bg-white border border-rose-100 rounded-2xl rounded-tl-none px-5 py-3 shadow-sm">
                    <motion.p
                        key={phrase}
                        animate={{ opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: pulseSpeed, repeat: Infinity, ease: "easeInOut" }}
                        className="text-sm font-semibold text-rose-600"
                    >
                        {phrase}
                    </motion.p>
                </div>
            </div>
        </div>
    );
};
