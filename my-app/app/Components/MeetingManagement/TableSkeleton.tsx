"use client";

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <>
      <style>{`@keyframes meeting-shimmer{from{background-position:100% 0}to{background-position:-100% 0}}`}</style>
      {Array.from({ length: rows }, (_, index) => (
        <tr key={index} aria-hidden>
          {Array.from({ length: 8 }, (_, cell) => (
            <td key={cell} className="px-3 py-3">
              <span
                className="block h-4 rounded-md motion-reduce:animate-none"
                style={{
                  backgroundImage: "linear-gradient(90deg,#eef2f6 0%,#f8fafc 45%,#eef2f6 100%)",
                  backgroundSize: "200% 100%",
                  animation: "meeting-shimmer 1.4s linear infinite",
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
