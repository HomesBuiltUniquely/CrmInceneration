"use client";

import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE, focusRing } from "./motion";

export function MeetingDialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-[80] bg-[#0F172A]/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                className="fixed left-1/2 top-1/2 z-[81] w-[min(420px,calc(100vw-32px))] rounded-2xl bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.16)]"
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: "-50%", y: "calc(-50% + 10px)", scale: 0.96 }}
                animate={{ opacity: 1, x: "-50%", y: "-50%", scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: "-50%", y: "calc(-50% + 6px)", scale: 0.98, transition: { duration: 0.15 } }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                <div className="mb-2.5 flex items-start justify-between gap-3">
                  <Dialog.Title className="text-[16px] font-bold leading-tight tracking-[-0.02em] text-[#14171F]">{title}</Dialog.Title>
                  <Dialog.Close asChild>
                    <motion.button
                      type="button"
                      aria-label="Close"
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[18px] text-[#64748B] transition-colors hover:bg-[#F4F6F8] hover:text-[#0F172A] ${focusRing}`}
                      {...(reduce ? { whileTap: { scale: 0.96 } } : { whileHover: { rotate: 90, scale: 1.05 }, whileTap: { scale: 0.94 }, transition: { duration: 0.18 } })}
                    >
                      ×
                    </motion.button>
                  </Dialog.Close>
                </div>
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
