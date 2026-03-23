import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import MaterialIcon from "@/components/ui/MaterialIcon";
import ProgressRing from "./ProgressRing";
import { ROLE_TAGS } from "./ONBOARDING_BLOCKS";
import { ITEM_DETAILS } from "./ITEM_DETAILS";

function ItemDetails({ details }) {
  if (!details) return null;
  return (
    <div className="ml-9 mr-4 mb-3 rounded-xl border border-[#d4af37]/20 bg-[#d4af37]/5 px-4 py-3 text-[13px] text-[#4a3d3d] leading-relaxed">
      <div className="whitespace-pre-wrap">{details.text}</div>
      {details.links?.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {details.links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[#b91c1c] underline underline-offset-2 hover:text-[#991b1b] font-medium min-h-[40px]"
            >
              {link.label}
              <MaterialIcon icon="open_in_new" size={12} className="flex-shrink-0" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function getSubtitle(checkedCount, total, isNextActive) {
  if (checkedCount === total) return { text: "Missão completa!", color: "#059669" };
  if (checkedCount === total - 1) return { text: "Falta 1 item!", color: null }; // null = use block.color
  if (checkedCount === 0 && isNextActive) return { text: "Pronta para você", color: null };
  if (checkedCount === 0) return { text: "Toque para começar", color: null };
  return { text: `${checkedCount} de ${total} itens`, color: "#4a3d3d" };
}

export default function OnboardingBlock({ block, items, onToggle, isAdmin, disabled, isExpanded, onToggleExpand, blockRef, isNextActive }) {
  const [expandedKeys, setExpandedKeys] = useState({});
  const [celebrating, setCelebrating] = useState(false);
  const celebrationTimerRef = useRef(null);
  const prevCompleteRef = useRef(false);

  const blockItems = block.items || [];
  const checkedCount = blockItems.filter(i => items[i.key]).length;
  const total = blockItems.length;
  const progress = total > 0 ? Math.round((checkedCount / total) * 100) : 0;
  const isComplete = checkedCount === total;

  // Separate franchisee items from franchisor items
  const franchiseeItems = blockItems.filter(i => i.role === "franchisee" || i.role === "both");
  const franchisorItems = blockItems.filter(i => i.role === "franchisor");

  // Micro-celebration: detect completion transition
  useEffect(() => {
    if (isComplete && !prevCompleteRef.current && checkedCount > 0) {
      setCelebrating(true);
      celebrationTimerRef.current = setTimeout(() => setCelebrating(false), 3000);
    }
    prevCompleteRef.current = isComplete;
  }, [isComplete, checkedCount]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
    };
  }, []);

  const handleToggleExpand = () => {
    // User interaction cancels celebration timer
    if (celebrationTimerRef.current) {
      clearTimeout(celebrationTimerRef.current);
      celebrationTimerRef.current = null;
      setCelebrating(false);
    }
    onToggleExpand();
  };

  const canMark = (item) => {
    if (isAdmin) return item.role !== "auto";
    if (item.role === "franchisor" || item.role === "auto") return false;
    return true;
  };

  const toggleItemExpand = (key, e) => {
    e.stopPropagation();
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const subtitle = getSubtitle(checkedCount, total, isNextActive);
  const subtitleColor = subtitle.color || block.color;

  // Progress illusion: next active block with 0 items shows 5%
  const ringProgress = (isNextActive && checkedCount === 0) ? 5 : progress;

  // Border-left style
  const borderLeftColor = isComplete ? "#10b981" : block.color;
  const borderLeftWidth = (isExpanded && !isComplete) ? 5 : 4;

  // Card classes
  let cardClassName = "overflow-hidden transition-all duration-300 rounded-xl ";
  if (isComplete) {
    cardClassName += "bg-[#ecfdf5]/30 border border-emerald-200";
  } else if (isExpanded) {
    cardClassName += "shadow-md border border-[#291715]/5";
  } else {
    cardClassName += "bg-white border border-[#291715]/5 hover:shadow-sm";
  }

  // Celebration glow
  const celebrationStyle = celebrating ? {
    borderLeft: `${borderLeftWidth}px solid ${borderLeftColor}`,
    boxShadow: `0 0 20px ${block.color}40`,
    transform: "scale(1.02)",
    transition: "transform 300ms ease, box-shadow 300ms ease",
  } : {
    borderLeft: `${borderLeftWidth}px solid ${borderLeftColor}`,
  };

  const renderItem = (item) => {
    const tag = ROLE_TAGS[item.role];
    const locked = !canMark(item) || disabled;
    const checked = !!items[item.key];
    const isItemExpanded = !!expandedKeys[item.key];
    const details = ITEM_DETAILS[item.key];

    return (
      <div key={item.key}>
        <div
          className={`flex items-start gap-3 px-4 py-3 transition-colors ${
            locked && !checked ? "opacity-70" : ""
          }`}
        >
          {/* Checkbox — click target is the checkbox area only */}
          <div
            className={`mt-0.5 flex-shrink-0 ${!locked ? "cursor-pointer" : ""}`}
            onClick={() => !locked && onToggle(item.key)}
          >
            {locked && item.role !== "auto" && !checked ? (
              <div className="w-7 h-7 rounded-lg border-2 border-[#291715]/15 bg-[#fbf9fa] flex items-center justify-center">
                <MaterialIcon icon="lock" size={12} className="text-[#291715]/30" />
              </div>
            ) : (
              <div
                className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
                  !locked ? "hover:scale-110 active:scale-95" : ""
                } ${
                  checked
                    ? "border-emerald-500 bg-emerald-500 shadow-sm shadow-emerald-200"
                    : item.role === "auto"
                    ? "border-[#291715]/15 bg-[#fbf9fa]"
                    : "border-[#291715]/20 bg-white hover:border-[#d4af37]"
                }`}
              >
                {checked && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            )}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1.5">
              <span
                className={`text-sm leading-snug ${checked ? "line-through text-[#4a3d3d]/40" : "text-[#1b1c1d]"} ${details ? "cursor-pointer" : ""}`}
                onClick={details ? (e) => toggleItemExpand(item.key, e) : undefined}
              >
                {item.label}
              </span>
              {details && (
                <button
                  onClick={(e) => toggleItemExpand(item.key, e)}
                  className={`inline-flex items-center flex-shrink-0 mt-0.5 w-5 h-5 rounded-full transition-all ${
                    isItemExpanded
                      ? "bg-[#d4af37]/20 text-[#775a19]"
                      : "bg-[#291715]/5 text-[#291715]/40 hover:bg-[#d4af37]/10 hover:text-[#775a19]"
                  }`}
                >
                  <MaterialIcon icon={isItemExpanded ? "expand_less" : "help_outline"} size={14} className="mx-auto" />
                </button>
              )}
            </div>
            {/* Role tag - hidden on mobile for franchisee items */}
            {tag && (
              <span className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tag.className} ${
                item.role === "franchisee" ? "hidden sm:inline-block" : ""
              }`}>
                {tag.label}
              </span>
            )}
          </div>
        </div>

        {/* Expandable details */}
        {isItemExpanded && details && <ItemDetails details={details} />}
      </div>
    );
  };

  return (
    <div ref={blockRef}>
      <Card className={cardClassName} style={celebrationStyle}>

        {/* Celebration banner */}
        {celebrating && (
          <div
            className="px-4 py-2 text-center text-white text-sm font-bold"
            style={{
              backgroundColor: block.color,
              animation: "fade-in 300ms ease-out",
            }}
          >
            🎉 Missão completa!
          </div>
        )}

        {/* Card Header */}
        <button
          onClick={handleToggleExpand}
          className="w-full p-3 sm:p-4 flex items-center gap-3 transition-colors hover:bg-[#fbf9fa]/50"
        >
          {/* Progress Ring */}
          <div className="sm:hidden">
            <ProgressRing
              size={40}
              progress={ringProgress}
              color={block.color}
              isComplete={isComplete}
              icon={block.icon}
            />
          </div>
          <div className="hidden sm:block">
            <ProgressRing
              size={48}
              progress={ringProgress}
              color={block.color}
              isComplete={isComplete}
              icon={block.icon}
            />
          </div>

          {/* Title + Subtitle */}
          <div className="flex-1 min-w-0 text-left">
            <h3 className={`font-bold text-sm ${isComplete ? "text-emerald-700" : "text-[#1b1c1d]"}`}>
              {block.title}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: subtitleColor }}>
              {subtitle.text}
            </p>
          </div>

          {/* Chevron */}
          <MaterialIcon
            icon={isExpanded ? "expand_less" : "expand_more"}
            size={20}
            className="text-[#4a3d3d]/40 flex-shrink-0"
          />
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <CardContent className="p-0 pt-0">
            {/* Dashed separator */}
            <div className="border-t border-dashed border-[#291715]/10 mx-4" />

            {/* Franchisee/both items */}
            {franchiseeItems.length > 0 && (
              <div className="divide-y divide-[#291715]/5">
                {franchiseeItems.map(renderItem)}
              </div>
            )}

            {/* Franchisor items grouped separately */}
            {franchisorItems.length > 0 && (
              <div className={`${franchiseeItems.length > 0 ? "border-t border-dashed border-[#291715]/10 mt-1" : ""}`}>
                {!isAdmin && (
                  <div className="px-4 py-2 bg-[#291715]/3 flex items-center gap-2">
                    <MaterialIcon icon="schedule" size={14} className="text-[#4a3d3d]/50" />
                    <span className="text-xs text-[#4a3d3d]/70 font-medium">Aguardando franqueador</span>
                  </div>
                )}
                <div className="divide-y divide-[#291715]/5">
                  {franchisorItems.map(renderItem)}
                </div>
              </div>
            )}
          </CardContent>
        )}

        {/* Expanded background tint */}
        {isExpanded && !isComplete && (
          <style>{`
            [data-block-id="${block.id}"] {
              background-color: ${block.color}08;
            }
          `}</style>
        )}
      </Card>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
