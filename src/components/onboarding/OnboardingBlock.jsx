import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import MaterialIcon from "@/components/ui/MaterialIcon";
import ProgressRing from "./ProgressRing";
import { ROLE_TAGS } from "./ONBOARDING_BLOCKS";
import { ITEM_DETAILS } from "./ITEM_DETAILS";

function ItemDetails({ details }) {
  if (!details) return null;
  return (
    <div className="ml-9 mr-4 mb-3 rounded-xl border border-brand-gold/20 bg-brand-gold/5 px-4 py-3 text-[13px] text-ink-2 leading-relaxed">
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
              className="inline-flex items-center gap-1 text-brand underline underline-offset-2 hover:text-brand-dark font-medium min-h-[40px]"
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
  const franchiseeItems = blockItems.filter(i => i.role === "franchisee" || i.role === "both" || i.role === "auto");
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
    // Block item if dependency not yet completed
    if (item.dependsOn && !items[item.dependsOn]) return false;
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
    cardClassName += "shadow-md border border-ink-shadow/5";
  } else {
    cardClassName += "bg-white border border-ink-shadow/5 hover:shadow-sm";
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
              <div className="w-7 h-7 rounded-lg border-2 border-ink-shadow/15 bg-surface flex items-center justify-center">
                <MaterialIcon icon="lock" size={12} className="text-ink-shadow/30" />
              </div>
            ) : (
              <div
                className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
                  !locked ? "hover:scale-110 active:scale-95" : ""
                } ${
                  checked
                    ? "border-emerald-500 bg-emerald-500 shadow-sm shadow-emerald-200"
                    : item.role === "auto"
                    ? "border-ink-shadow/15 bg-surface"
                    : "border-ink-shadow/20 bg-white hover:border-brand-gold"
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
                className={`text-sm leading-snug ${checked ? "line-through text-ink-2/40" : "text-ink"} ${details ? "cursor-pointer" : ""}`}
                onClick={details ? (e) => toggleItemExpand(item.key, e) : undefined}
              >
                {item.label}
              </span>
              {details && (
                <button
                  onClick={(e) => toggleItemExpand(item.key, e)}
                  className={`inline-flex items-center flex-shrink-0 mt-0.5 w-5 h-5 rounded-full transition-all ${
                    isItemExpanded
                      ? "bg-brand-gold/20 text-brand-gold-ink"
                      : "bg-ink-shadow/5 text-ink-shadow/40 hover:bg-brand-gold/10 hover:text-brand-gold-ink"
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
          className="w-full p-3 sm:p-4 flex items-center gap-3 transition-colors hover:bg-surface/50"
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
            <h3 className={`font-bold text-sm ${isComplete ? "text-emerald-700" : "text-ink"}`}>
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
            className="text-ink-2/40 flex-shrink-0"
          />
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <CardContent className="p-0 pt-0">
            {/* Dashed separator */}
            <div className="border-t border-dashed border-ink-shadow/10 mx-4" />

            {/* Franchisee/both items */}
            {franchiseeItems.length > 0 && (
              <div className="divide-y divide-ink-shadow/5">
                {franchiseeItems.map(renderItem)}
              </div>
            )}

            {/* Franchisor items grouped separately */}
            {franchisorItems.length > 0 && (
              <div className={`${franchiseeItems.length > 0 ? "border-t border-dashed border-ink-shadow/10 mt-1" : ""}`}>
                {!isAdmin && (
                  <div className="px-4 py-2 bg-ink-shadow/3 flex items-center gap-2">
                    <MaterialIcon icon="schedule" size={14} className="text-ink-2/50" />
                    <span className="text-xs text-ink-2/70 font-medium">Aguardando franqueador</span>
                  </div>
                )}
                <div className="divide-y divide-ink-shadow/5">
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
