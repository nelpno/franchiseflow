import React from "react";

/**
 * Mini horizontal bar for a single health dimension.
 * Props: label (string), score (0-100), maxWidth (px, default 60)
 */
export default function HealthScoreBar({ label, score, maxWidth = 60 }) {
  const color = score >= 70 ? "#16a34a"
    : score >= 40 ? "#d97706"
    : "#dc2626";

  const fillWidth = Math.round((score / 100) * maxWidth);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className="rounded-full overflow-hidden"
        style={{ width: maxWidth, height: 6, backgroundColor: "#e9e8e9" }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: fillWidth, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px]" style={{ color: "#7a6d6d" }}>{label}</span>
    </div>
  );
}
