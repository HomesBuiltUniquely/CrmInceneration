"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FollowUpDayModal from "./FollowUpDayModal";
import {
  dispatchSeFollowUpStart,
  isCrmLeadOverlayOpen,
  isLocalEveningWindow,
  markEveningFollowUpDismissed,
  markMorningFollowUpDismissed,
  readSeFollowUpViewerKey,
  shouldOfferEveningPopup,
  shouldOfferMorningPopup,
} from "@/lib/sales-executive-followup-day";
import { localCalendarDateKey } from "@/lib/se-followup-motivational-quotes";
import {
  fetchFollowUpDayBrief,
  readStoredSnapshotToken,
  seFollowUpApiEnabled,
  writeStoredSnapshotToken,
  type FollowUpDayApiResponse,
} from "@/lib/sales-executive-followup-day-client";
import { firstNameFromDisplayName } from "@/lib/se-followup-modal-titles";

type Props = {
  enabled: boolean;
  displayName: string;
};

type ModalVariant = "morning" | "evening";

export default function SalesExecutiveFollowUpDayHost({ enabled, displayName }: Props) {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<ModalVariant>("morning");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<FollowUpDayApiResponse | null>(null);
  const viewerKey = readSeFollowUpViewerKey();
  const pendingVariantRef = useRef<ModalVariant | null>(null);
  const openRef = useRef(false);
  const fetchInFlightRef = useRef(false);
  openRef.current = open;

  const loadBrief = useCallback(async (nextVariant: ModalVariant): Promise<boolean> => {
    if (!seFollowUpApiEnabled()) {
      setError("Follow-up API is disabled.");
      return false;
    }
    if (fetchInFlightRef.current) return false;
    fetchInFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const dateKey = localCalendarDateKey();
      const snapshotToken =
        nextVariant === "evening"
          ? readStoredSnapshotToken(viewerKey, dateKey)
          : "";
      const tzOffsetMinutes = new Date().getTimezoneOffset() * -1;
      const json = await fetchFollowUpDayBrief({
        variant: nextVariant,
        snapshotToken,
        tzOffsetMinutes,
      });
      if (!json.ok) {
        if (json.code === "USER_INACTIVE") {
          setError(null);
          return false;
        }
        setError(json.error ?? "Could not load follow-ups");
        return false;
      }
      setPayload(json);
      if (json.snapshotToken?.trim()) {
        writeStoredSnapshotToken(viewerKey, dateKey, json.snapshotToken.trim());
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load follow-ups");
      return false;
    } finally {
      setLoading(false);
      fetchInFlightRef.current = false;
    }
  }, [viewerKey]);

  const tryOpen = useCallback(
    async (nextVariant: ModalVariant) => {
      if (!enabled || !viewerKey) return;
      if (isCrmLeadOverlayOpen()) {
        pendingVariantRef.current = nextVariant;
        return;
      }
      setVariant(nextVariant);
      const ok = await loadBrief(nextVariant);
      if (!ok) return;
      setOpen(true);
    },
    [enabled, loadBrief, viewerKey],
  );

  const evaluateSchedule = useCallback(() => {
    if (!enabled || !viewerKey) return;
    if (!displayName.trim()) return;
    if (openRef.current || fetchInFlightRef.current) return;

    if (shouldOfferMorningPopup(viewerKey)) {
      void tryOpen("morning");
      return;
    }
    if (isLocalEveningWindow() && shouldOfferEveningPopup(viewerKey)) {
      void tryOpen("evening");
    }
  }, [displayName, enabled, tryOpen, viewerKey]);

  useEffect(() => {
    if (!enabled) return;
    void evaluateSchedule();
    const t = window.setTimeout(evaluateSchedule, 600);
    return () => window.clearTimeout(t);
  }, [enabled, evaluateSchedule]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (openRef.current || fetchInFlightRef.current) return;
      if (isCrmLeadOverlayOpen()) return;
      if (pendingVariantRef.current) {
        const v = pendingVariantRef.current;
        pendingVariantRef.current = null;
        void tryOpen(v);
        return;
      }
      if (isLocalEveningWindow() && shouldOfferEveningPopup(viewerKey)) {
        void tryOpen("evening");
      }
    }, 60_000);
    return () => window.clearInterval(id);
  }, [enabled, tryOpen, viewerKey]);

  useEffect(() => {
    if (!enabled) return;
    const onInvalidate = () => {
      if (!openRef.current) return;
      void loadBrief(variant);
    };
    window.addEventListener("crm:leads-invalidate", onInvalidate);
    return () => window.removeEventListener("crm:leads-invalidate", onInvalidate);
  }, [enabled, loadBrief, variant]);

  const dismiss = useCallback(() => {
    const key = readSeFollowUpViewerKey();
    const dateKey = localCalendarDateKey();
    if (variant === "morning") markMorningFollowUpDismissed(key, dateKey);
    else markEveningFollowUpDismissed(key, dateKey);
    setOpen(false);
    if (variant === "morning" && isLocalEveningWindow() && shouldOfferEveningPopup(key)) {
      window.setTimeout(() => void tryOpen("evening"), 300);
    }
  }, [tryOpen, variant]);

  const onStartFollowUps = useCallback(() => {
    const key = readSeFollowUpViewerKey();
    const dateKey = localCalendarDateKey();
    if (variant === "morning") markMorningFollowUpDismissed(key, dateKey);
    else markEveningFollowUpDismissed(key, dateKey);
    dispatchSeFollowUpStart(variant === "morning" ? "todayAll" : "todayPending");
    setOpen(false);
  }, [variant]);

  const firstName = useMemo(() => {
    const fromApi = payload?.firstName?.trim();
    if (fromApi) return fromApi;
    const fromDisplay = firstNameFromDisplayName(displayName);
    return fromDisplay || "there";
  }, [displayName, payload]);

  if (!enabled) return null;

  return (
    <FollowUpDayModal
      open={open}
      variant={variant}
      firstName={firstName}
      quote={payload?.quote ?? ""}
      apiPayload={payload}
      loading={loading}
      error={error}
      onClose={dismiss}
      onRetry={() => void loadBrief(variant).then((ok) => ok && setOpen(true))}
      onStartFollowUps={onStartFollowUps}
    />
  );
}