"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fetchRecordingPlayUrl } from "@/lib/recording-call-logs/api";
import { formatDurationLabel } from "@/lib/recording-call-logs/format";

export type RecordingPlayerTarget = {
  recordingId: number;
  title: string;
  subtitle?: string;
  durationSec?: number;
};

type Props = {
  target: RecordingPlayerTarget | null;
  onClose: () => void;
};

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function RecordingPlayerModal({ target, onClose }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!target) {
      setPlayUrl(null);
      setError(null);
      setLoading(false);
      setPlaying(false);
      setCurrentSec(0);
      setDurationSec(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPlayUrl(null);
    setPlaying(false);
    setCurrentSec(0);
    setDurationSec(target.durationSec && target.durationSec > 0 ? target.durationSec : 0);

    void fetchRecordingPlayUrl(target.recordingId)
      .then((url) => {
        if (cancelled) return;
        setPlayUrl(url);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load recording");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [target, onClose]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playUrl) return;
    void audio.play().catch(() => {
      // Autoplay may be blocked; user can press play.
    });
  }, [playUrl]);

  if (!mounted || !target) return null;

  const total = durationSec > 0 ? durationSec : target.durationSec || 0;
  const progress = total > 0 ? Math.min(100, (currentSec / total) * 100) : 0;

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  };

  const seek = (ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.duration * ratio));
  };

  const skipBy = (deltaSec: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const max =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : Math.max(total, currentSec + Math.abs(deltaSec));
    const next = Math.max(0, Math.min(max, audio.currentTime + deltaSec));
    audio.currentTime = next;
    setCurrentSec(next);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recording-player-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0f172a]/55 backdrop-blur-[2px]"
        aria-label="Close recording player"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-2xl border border-[#E6EAF0] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-3 border-b border-[#E6EAF0] bg-[#F8FAFC] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#1D4ED8]">
              Call recording
            </p>
            <h2
              id="recording-player-title"
              className="mt-1 truncate text-[16px] font-bold text-[#14171F]"
            >
              {target.title}
            </h2>
            {target.subtitle ? (
              <p className="mt-0.5 truncate text-[12px] font-medium text-[#8A94A6]">
                {target.subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E6EAF0] bg-white text-[#5B6778] transition hover:bg-[#F1F5F9] hover:text-[#14171F]"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#1D4ED8]">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path
                d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {loading ? (
            <p className="mt-6 text-center text-[13px] font-medium text-[#8A94A6]">
              Loading recording…
            </p>
          ) : error ? (
            <div className="mt-6 text-center">
              <p className="text-[14px] font-bold text-[#14171F]">Could not play</p>
              <p className="mt-1 text-[12px] text-[#B91C1C]">{error}</p>
            </div>
          ) : (
            <>
              <div className="mt-6 min-w-0">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={progress}
                  onChange={(e) => seek(Number(e.target.value) / 100)}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#E6EAF0] accent-[#1D4ED8]"
                  aria-label="Seek"
                />
                <div className="mt-1.5 flex justify-between text-[11px] font-semibold tabular-nums text-[#8A94A6]">
                  <span>{formatClock(currentSec)}</span>
                  <span>
                    {total > 0 ? formatClock(total) : formatDurationLabel(target.durationSec || 0)}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => skipBy(-5)}
                  disabled={!playUrl}
                  className="inline-flex h-11 min-w-11 flex-col items-center justify-center rounded-full border border-[#E6EAF0] bg-[#F8FAFC] px-2 text-[#1D4ED8] transition hover:bg-[#EFF6FF] disabled:opacity-50"
                  aria-label="Back 5 seconds"
                  title="Back 5 sec"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 7L6 12l5 5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M18 7l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[10px] font-bold leading-none">5s</span>
                </button>

                <button
                  type="button"
                  onClick={togglePlay}
                  disabled={!playUrl}
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1D4ED8] text-white shadow-[0_8px_20px_rgba(29,78,216,0.35)] transition hover:bg-[#1E40AF] disabled:opacity-50"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                      <rect x="6" y="5" width="4" height="14" rx="1" />
                      <rect x="14" y="5" width="4" height="14" rx="1" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor">
                      <path d="M8 5.5v13l11-6.5L8 5.5z" />
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => skipBy(5)}
                  disabled={!playUrl}
                  className="inline-flex h-11 min-w-11 flex-col items-center justify-center rounded-full border border-[#E6EAF0] bg-[#F8FAFC] px-2 text-[#1D4ED8] transition hover:bg-[#EFF6FF] disabled:opacity-50"
                  aria-label="Forward 5 seconds"
                  title="Forward 5 sec"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[10px] font-bold leading-none">5s</span>
                </button>
              </div>

              <audio
                ref={audioRef}
                src={playUrl ?? undefined}
                preload="auto"
                className="hidden"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                onTimeUpdate={(e) => setCurrentSec(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration;
                  if (Number.isFinite(d) && d > 0) setDurationSec(d);
                }}
              />
            </>
          )}
        </div>

      </div>
    </div>,
    document.body,
  );
}
