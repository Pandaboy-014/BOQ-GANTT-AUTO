import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { toastManager, Toast as ToastType } from '../lib/toast';

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastType[]>([]);

  useEffect(() => {
    return toastManager.subscribe((newToasts) => {
      setToasts(newToasts);
    });
  }, []);

  return (
    <div id="toast-container" className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[9999] flex flex-col gap-3 w-full max-w-[90%] sm:max-w-md pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            id={`toast-${toast.id}`}
            layout
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={`pointer-events-auto flex items-start gap-3 w-full p-4 rounded-2xl shadow-2xl backdrop-blur-md border ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-100 shadow-emerald-950/20'
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/30 text-rose-100 shadow-rose-950/20'
                : 'bg-[#131b2e]/95 border-slate-700/55 text-slate-100'
            }`}
          >
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {toast.type === 'error' && <XCircle className="w-5 h-5 text-rose-400" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-cyan-400" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium leading-relaxed font-sans">{toast.message}</p>
            </div>

            {/* Dismiss Button */}
            <button
              id={`toast-dismiss-${toast.id}`}
              onClick={() => toastManager.dismiss(toast.id)}
              className="flex-shrink-0 text-slate-400 hover:text-white transition-colors p-0.5 hover:bg-white/5 rounded-lg"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
