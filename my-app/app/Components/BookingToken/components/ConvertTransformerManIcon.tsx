"use client";

type Props = {
  className?: string;
  /** When true, always show the walking frame (e.g. while submitting). */
  walking?: boolean;
};

/**
 * 3D Transformer-style man for Convert actions.
 * Idle stand → walk frame on hover / when `walking`.
 */
export default function ConvertTransformerManIcon({
  className = "h-5 w-5",
  walking = false,
}: Props) {
  return (
    <span
      className={`bt-convert-man relative inline-flex shrink-0 overflow-hidden rounded-md ${className}`}
      aria-hidden="true"
    >
      <img
        src="/icons/convert-transformer-man-3d.jpg"
        alt=""
        className={`bt-convert-man-stand absolute inset-0 h-full w-full object-cover ${
          walking ? "opacity-0" : "opacity-100"
        }`}
        draggable={false}
      />
      <img
        src="/icons/convert-transformer-man-walk-3d.jpg"
        alt=""
        className={`bt-convert-man-walk absolute inset-0 h-full w-full object-cover ${
          walking ? "opacity-100" : "opacity-0"
        }`}
        draggable={false}
      />
    </span>
  );
}
