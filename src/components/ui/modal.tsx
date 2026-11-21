"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handler);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-ink-950/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className={cn(
              "glass-strong relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl p-6 shadow-2xl sm:rounded-3xl",
              widths[size],
            )}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                {title ? (
                  <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
                ) : null}
                {description ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-white/55">{description}</p>
                ) : null}
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="size-4.5" />
              </button>
            </div>
            {children}
            {footer ? <div className="mt-6 flex items-center justify-end gap-2">{footer}</div> : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
