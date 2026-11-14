"use client";

import { useCallback, useRef, useState } from "react";
import AssignNotifyCustomerModal from "./AssignNotifyCustomerModal";

export type NotifyCustomerChoice = boolean;

/**
 * Promise-based Yes/No for sales reassign / bulk assign WhatsApp notify.
 * `null` = dismissed without choosing → caller must abort assign.
 */
export function useAssignNotifyCustomerPrompt() {
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<((value: NotifyCustomerChoice | null) => void) | null>(
    null,
  );

  const finish = useCallback((value: NotifyCustomerChoice | null) => {
    setOpen(false);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(value);
  }, []);

  const confirmNotifyCustomer = useCallback((): Promise<NotifyCustomerChoice | null> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setOpen(true);
    });
  }, []);

  const notifyModal = (
    <AssignNotifyCustomerModal
      open={open}
      onYes={() => finish(true)}
      onNo={() => finish(false)}
      onDismiss={() => finish(null)}
    />
  );

  return { confirmNotifyCustomer, notifyModal };
}
