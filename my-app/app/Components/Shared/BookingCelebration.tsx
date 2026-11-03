'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** Short enough to stay out of the way, long enough to read the name and amount. */
export const CELEBRATION_VISIBLE_MS = 6000;

/**
 * Drop your celebration sound here (Hallway public folder):
 *   my-app/public/celebrations/booking-done.mp3
 * Served at: /celebrations/booking-done.mp3
 * CRM / Design load the same file from the Hallway origin.
 */
export const CELEBRATION_SOUND_PATH = '/celebrations/booking-done.mp3';

type CelebrationEvent = {
  id: string;
  celebrationType: 'new_booking' | 'big_one' | 'spot_closure' | string;
  typeLabel: string;
  salespersonName: string;
  branchName: string;
  customerName: string;
  quoteFormatted: string;
  announcementId: string;
};

type Props = {
  apiBase: string;
  viewerKey: string;
  /** Extra identity keys (email, username, user id, display name) so one receipt covers all modules. */
  viewerAliases?: string[];
  viewerName: string;
  placement: 'center' | 'corner';
  enabled?: boolean;
};

function hallwayOrigin(apiBase: string): string {
  return apiBase.replace(/\/$/, '');
}

function uniqueKeys(...parts: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const key = String(part || '')
      .trim()
      .toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export default function BookingCelebration({
  apiBase,
  viewerKey,
  viewerAliases = [],
  viewerName,
  placement,
  enabled = true,
}: Props) {
  const [queue, setQueue] = useState<CelebrationEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [congratsState, setCongratsState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const tabId = useRef(`tab-${Math.random().toString(36).slice(2)}`);
  const leader = useRef(false);
  const claimedIds = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const current = queue[0] || null;

  const identityKeys = useMemo(
    () => uniqueKeys(viewerKey, ...viewerAliases),
    [viewerKey, viewerAliases]
  );
  const viewerQuery = identityKeys.join(',');

  const enqueue = useCallback((incoming: CelebrationEvent[]) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    setQueue((prev) => {
      const ids = new Set(prev.map((item) => item.id));
      const next = [...prev];
      for (const event of incoming) {
        if (!event?.id || ids.has(event.id) || claimedIds.current.has(event.id)) continue;
        ids.add(event.id);
        next.push(event);
      }
      return next.slice(0, 5);
    });
  }, []);

  const markSeen = useCallback(
    async (eventId: string, congratulated: boolean) => {
      const base = hallwayOrigin(apiBase);
      const primary = identityKeys[0] || viewerKey;
      await fetch(`${base}/api/celebrations/${encodeURIComponent(eventId)}/seen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viewerKey: primary,
          viewerKeys: identityKeys,
          congratulated,
        }),
      });
    },
    [apiBase, identityKeys, viewerKey]
  );

  const dismiss = useCallback(() => {
    setQueue((prev) => prev.slice(1));
    setCongratsState('idle');
    setPaused(false);
  }, []);

  const playCelebrationSound = useCallback(() => {
    if (typeof window === 'undefined') return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;
    try {
      const base = hallwayOrigin(apiBase) || window.location.origin;
      const src = `${base}${CELEBRATION_SOUND_PATH}`;
      if (!audioRef.current) {
        audioRef.current = new Audio(src);
        audioRef.current.preload = 'auto';
      } else if (audioRef.current.src !== src) {
        audioRef.current.src = src;
      }
      audioRef.current.currentTime = 0;
      void audioRef.current.play().catch(() => {
        /* Autoplay may be blocked until a user gesture; popup still shows. */
      });
    } catch {
      /* Missing mp3 or playback error — keep popup silent. */
    }
  }, [apiBase]);

  useEffect(() => {
    if (!enabled || identityKeys.length === 0) return;
    const lockKey = 'hw-cele-leader';
    const claim = () => {
      const now = Date.now();
      let currentLock: { id?: string; ts?: number } | null = null;
      try {
        currentLock = JSON.parse(localStorage.getItem(lockKey) || 'null');
      } catch {
        currentLock = null;
      }
      const mine = currentLock?.id === tabId.current;
      const stale = !currentLock?.ts || now - Number(currentLock.ts) > 8000;
      if (mine || stale) {
        localStorage.setItem(lockKey, JSON.stringify({ id: tabId.current, ts: now }));
        leader.current = true;
        return;
      }
      leader.current = false;
    };
    claim();
    const beat = window.setInterval(claim, 3000);
    return () => window.clearInterval(beat);
  }, [enabled, identityKeys.length]);

  useEffect(() => {
    if (!enabled || !viewerQuery) return;
    const base = hallwayOrigin(apiBase);
    let pollTimer: number | null = null;
    let source: EventSource | null = null;
    let closed = false;

    const pull = async () => {
      if (!leader.current) return;
      try {
        const res = await fetch(
          `${base}/api/celebrations?viewer=${encodeURIComponent(viewerQuery)}`
        );
        if (!res.ok) return;
        const body = await res.json();
        const events: CelebrationEvent[] = Array.isArray(body?.events) ? body.events : [];
        setQueue((prev) => {
          const showing = prev[0];
          const ids = new Set(
            events.filter((event) => !claimedIds.current.has(event.id)).map((event) => event.id)
          );
          const kept = showing && ids.has(showing.id) ? [showing] : [];
          for (const event of events) {
            if (claimedIds.current.has(event.id)) continue;
            if (kept.some((item) => item.id === event.id)) continue;
            kept.push(event);
          }
          return kept.slice(0, 5);
        });
      } catch {
        /* next poll */
      }
    };

    const startPoll = () => {
      if (pollTimer != null) return;
      void pull();
      pollTimer = window.setInterval(() => void pull(), 4000);
    };

    try {
      source = new EventSource(
        `${base}/api/celebrations/stream?viewer=${encodeURIComponent(viewerQuery)}`
      );
      source.onmessage = (message) => {
        if (!leader.current) return;
        try {
          const events = JSON.parse(message.data);
          if (Array.isArray(events)) enqueue(events);
        } catch {
          /* ignore */
        }
      };
      source.onerror = () => {
        source?.close();
        source = null;
        startPoll();
      };
    } catch {
      startPoll();
    }

    const pollFallback = window.setTimeout(() => {
      if (!closed && queue.length === 0) startPoll();
    }, 6000);

    return () => {
      closed = true;
      window.clearTimeout(pollFallback);
      if (pollTimer != null) window.clearInterval(pollTimer);
      source?.close();
    };
    // queue.length is read only for the fallback; the stream owns live updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, enabled, enqueue, viewerQuery]);

  const currentId = current?.id || '';

  // Claim + mark seen as soon as the popup appears so switching modules never re-shows it.
  useEffect(() => {
    if (!currentId) return;
    if (claimedIds.current.has(currentId)) return;
    claimedIds.current.add(currentId);
    playCelebrationSound();
    void markSeen(currentId, false).catch(() => undefined);
  }, [currentId, markSeen, playCelebrationSound]);

  useEffect(() => {
    if (!currentId || paused || congratsState === 'sending') return;
    const timer = window.setTimeout(() => {
      void markSeen(currentId, false).finally(dismiss);
    }, CELEBRATION_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [congratsState, currentId, dismiss, markSeen, paused]);

  useEffect(() => {
    if (!current || placement === 'corner') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        void markSeen(current.id, false).finally(dismiss);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, dismiss, markSeen, placement]);

  if (!current) return null;

  const close = () => {
    void markSeen(current.id, false).finally(dismiss);
  };

  const congratulate = async () => {
    if (congratsState !== 'idle') return;
    setCongratsState('sending');
    const base = hallwayOrigin(apiBase);
    try {
      const res = await fetch(
        `${base}/api/celebrations/${encodeURIComponent(current.id)}/congratulate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            viewerKey: identityKeys[0] || viewerKey,
            viewerKeys: identityKeys,
            authorName: viewerName || 'Hub member',
          }),
        }
      );
      if (!res.ok) throw new Error('comment failed');
      setCongratsState('sent');
    } catch {
      setCongratsState('idle');
    }
  };

  const view = async () => {
    await markSeen(current.id, false).catch(() => undefined);
    const base = hallwayOrigin(apiBase) || window.location.origin;
    window.location.assign(`${base}/?announcement=${encodeURIComponent(current.announcementId)}`);
  };

  const corner = placement === 'corner';
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gif = `${hallwayOrigin(apiBase) || ''}/celebrations/booking.gif`;

  return (
    <div className={corner ? 'hw-cele-corner' : 'hw-cele-center'} role="status" aria-live="polite">
      <style>{`
        .hw-cele-center, .hw-cele-corner, .hw-cele-card, .hw-cele-card * { box-sizing: border-box; font-family: Manrope, "Segoe UI", sans-serif; }
        .hw-cele-center { position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.28); }
        .hw-cele-corner { position: fixed; right: 16px; bottom: 16px; z-index: 80; }
        .hw-cele-card { width: min(420px, calc(100vw - 32px)); background: #fff; color: #111827; border-radius: 16px; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.22); overflow: hidden; }
        .hw-cele-gif { display: block; width: 100%; height: 132px; object-fit: cover; background: #fff7f6; }
        .hw-cele-body { padding: 14px 16px 16px; }
        .hw-cele-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
        .hw-cele-tag { display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 999px; background: #fff1f0; color: #c81e1e; font-size: 11px; font-weight: 800; letter-spacing: 0.02em; }
        .hw-cele-x { border: 0; background: transparent; color: #667085; cursor: pointer; font-size: 18px; line-height: 1; padding: 0 2px; }
        .hw-cele-name { margin: 8px 0 0; font-size: 18px; font-weight: 800; line-height: 1.25; }
        .hw-cele-meta { margin: 4px 0 0; color: #475467; font-size: 13px; line-height: 1.4; }
        .hw-cele-amt { color: #111827; font-weight: 800; }
        .hw-cele-actions { display: flex; gap: 8px; margin-top: 12px; }
        .hw-cele-btn { height: 34px; border-radius: 10px; border: 1px solid #e5e7eb; background: #fff; color: #111827; font-weight: 700; font-size: 13px; padding: 0 12px; cursor: pointer; }
        .hw-cele-btn.primary { background: #e8201c; border-color: #e8201c; color: #fff; }
        .hw-cele-btn:disabled { opacity: 0.7; cursor: default; }
      `}</style>
      <div
        className="hw-cele-card"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {reduceMotion ? null : <img className="hw-cele-gif" alt="" src={gif} />}
        <div className="hw-cele-body">
          <div className="hw-cele-top">
            <span className="hw-cele-tag">{current.typeLabel}</span>
            <button type="button" className="hw-cele-x" aria-label="Close" onClick={close}>
              ×
            </button>
          </div>
          <p className="hw-cele-name">
            {current.salespersonName}
            {current.branchName ? ` · ${current.branchName}` : ''}
          </p>
          <p className="hw-cele-meta">
            {current.customerName || 'Customer'} ·{' '}
            <span className="hw-cele-amt">{current.quoteFormatted}</span>
          </p>
          <div className="hw-cele-actions">
            <button
              type="button"
              className="hw-cele-btn primary"
              disabled={congratsState !== 'idle'}
              onClick={() => void congratulate()}
            >
              {congratsState === 'sent'
                ? 'Sent'
                : congratsState === 'sending'
                  ? 'Sending'
                  : 'Congratulate'}
            </button>
            <button type="button" className="hw-cele-btn" onClick={() => void view()}>
              View
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
