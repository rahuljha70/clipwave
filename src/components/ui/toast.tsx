"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastApi {
  toast: (kind: ToastKind, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev.slice(-3), { id, kind, title, description }]);
      setTimeout(() => remove(id), kind === "error" ? 7000 : 4500);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (t, d) => toast("success", t, d),
      error: (t, d) => toast("error", t, d),
      info: (t, d) => toast("info", t, d),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(92vw,380px)] flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="glass-strong pointer-events-auto flex items-start gap-3 rounded-2xl px-4 py-3 shadow-2xl"
            >
              <span
                className={
                  t.kind === "success"
                    ? "text-mint-400"
                    : t.kind === "error"
                      ? "text-rose-400"
                      : "text-electric-400"
                }
              >
                {t.kind === "success" ? (
                  <CheckCircle2 className="mt-0.5 size-5" />
                ) : t.kind === "error" ? (
                  <TriangleAlert className="mt-0.5 size-5" />
                ) : (
                  <Info className="mt-0.5 size-5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{t.title}</p>
                {t.description ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-white/60">{t.description}</p>
                ) : null}
              </div>
              <button
                onClick={() => remove(t.id)}
                className="rounded-full p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
                aria-label="Dismiss"
              >
                <X className="size-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}
