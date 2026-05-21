import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { RotateCcw } from 'lucide-react';

const OrientationOverlay: React.FC = () => {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 768;
      setIsPortrait(portrait);
    };

    // Initial check
    checkOrientation();

    // Listeners for both events as requested
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (!isPortrait) return null;

  return (
    <div 
      id="orientation-overlay"
      className="fixed inset-0 z-[9999] bg-[#020617]/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center"
    >
      <div className="overlay-content max-w-sm space-y-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="flex justify-center"
        >
          <div className="p-8 bg-indigo-600/20 rounded-full border border-indigo-500/30 shadow-[0_0_50px_rgba(79,70,229,0.2)]">
            <RotateCcw className="w-16 h-16 text-indigo-400" />
          </div>
        </motion.div>

        <div className="space-y-4">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            กรุณาหมุนโทรศัพท์เป็นแนวนอน
          </h2>
          <p className="text-slate-400 text-sm font-light leading-relaxed uppercase tracking-widest">
            เพื่อการแสดงผลกราฟ S-Curve และ Dashboard <br />
            ที่สมบูรณ์แบบที่สุด
          </p>
        </div>

        <div className="pt-8 opacity-20">
          <div className="w-12 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent mx-auto rounded-full" />
        </div>
      </div>
    </div>
  );
};

export default OrientationOverlay;
