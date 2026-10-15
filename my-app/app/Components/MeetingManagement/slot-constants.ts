/** Thresholds for how a day+hour cell presents its meetings. */
export const COMPACT_MAX = 4;
export const COMPACT_VISIBLE = 4;

export const HOUR_MIN_PX = 52;
export const COMPACT_ROW_PX = 30;
export const COUNT_CARD_PX = 64;

export const SLOT_EASE = [0.2, 0.8, 0.2, 1] as const;

export const SLOT_TYPE = {
  showroom: {
    bg: "#E6F0FF",
    border: "#BFD6FF",
    dot: "#1D4ED8",
    text: "#1E3A8A",
  },
  virtual: {
    bg: "#E5F7EC",
    border: "#B6E6C6",
    dot: "#15803D",
    text: "#14532D",
  },
  unset: {
    bg: "#F1F4F7",
    border: "#DDE3EA",
    dot: "#64748B",
    text: "#334155",
  },
} as const;
