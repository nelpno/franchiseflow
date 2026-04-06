import MaterialIcon from "@/components/ui/MaterialIcon";

const TRACK_WIDTH = 4;

export default function ProgressRing({ size = 48, progress = 0, color, isComplete = false, icon, label }) {
  const clamped = Math.max(0, Math.min(100, progress));
  const radius = (size - TRACK_WIDTH * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  const activeColor = isComplete ? "#10b981" : color;
  const iconSize = Math.round(size * 0.42);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="block"
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={TRACK_WIDTH}
          opacity={0.15}
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={activeColor}
          strokeWidth={TRACK_WIDTH}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 400ms ease-out, stroke 300ms ease" }}
        />
      </svg>
      {/* Center content */}
      <div
        className={`absolute inset-0 flex items-center justify-center ${isComplete ? "animate-ring-pulse" : ""}`}
      >
        {label != null ? (
          <span style={{ fontSize: Math.round(size * 0.28), fontWeight: 700, color: activeColor, lineHeight: 1 }}>
            {label}
          </span>
        ) : (
          <MaterialIcon
            icon={isComplete ? "check" : (icon || String(size))}
            size={iconSize}
            style={{ color: activeColor }}
          />
        )}
      </div>
      <style>{`
        @keyframes ring-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        .animate-ring-pulse {
          animation: ring-pulse 400ms ease-out 1;
        }
      `}</style>
    </div>
  );
}
