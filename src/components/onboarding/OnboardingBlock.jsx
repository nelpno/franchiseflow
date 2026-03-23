import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import MaterialIcon from "@/components/ui/MaterialIcon";
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
              className="inline-flex items-center gap-1 text-[#b91c1c] underline underline-offset-2 hover:text-[#991b1b] font-medium"
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

export default function OnboardingBlock({ block, items, onToggle, isAdmin, disabled, isExpanded, onToggleExpand, blockRef }) {
  const [expandedKeys, setExpandedKeys] = useState({});
  const blockItems = block.items || [];
  const checkedCount = blockItems.filter(i => items[i.key]).length;
  const total = blockItems.length;
  const progress = total > 0 ? Math.round((checkedCount / total) * 100) : 0;
  const isComplete = checkedCount === total;

  // Separate franchisee items from franchisor items
  const franchiseeItems = blockItems.filter(i => i.role === "franchisee" || i.role === "both");
  const franchisorItems = blockItems.filter(i => i.role === "franchisor");
  const franchiseeChecked = franchiseeItems.filter(i => items[i.key]).length;
  const franchisorChecked = franchisorItems.filter(i => items[i.key]).length;

  const canMark = (item) => {
    if (isAdmin) return item.role !== "auto";
    if (item.role === "franchisor" || item.role === "auto") return false;
    return true;
  };

  const toggleExpand = (key, e) => {
    e.stopPropagation();
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const remaining = total - checkedCount;

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
            !locked ? "hover:bg-[#d4af37]/5 cursor-pointer" : ""
          } ${locked && !checked ? "opacity-70" : ""}`}
          onClick={() => !locked && onToggle(item.key)}
        >
          {/* Checkbox - larger for mobile */}
          <div className="mt-0.5 flex-shrink-0">
            {locked && item.role !== "auto" && !checked ? (
              <div className="w-6 h-6 rounded-lg border-2 border-[#291715]/15 bg-[#fbf9fa] flex items-center justify-center">
                <MaterialIcon icon="lock" size={12} className="text-[#291715]/30" />
              </div>
            ) : (
              <div
                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                  checked
                    ? "border-emerald-500 bg-emerald-500 shadow-sm shadow-emerald-200"
                    : item.role === "auto"
                    ? "border-[#291715]/15 bg-[#fbf9fa]"
                    : "border-[#291715]/20 bg-white"
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
              <span className={`text-sm leading-snug ${checked ? "line-through text-[#4a3d3d]/40" : "text-[#1b1c1d]"}`}>
                {item.label}
              </span>
              {details && (
                <button
                  onClick={(e) => toggleExpand(item.key, e)}
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
      <Card className={`overflow-hidden transition-all duration-300 ${
        isComplete
          ? "border border-emerald-200 bg-emerald-50/30"
          : isExpanded
          ? "border-2 shadow-md"
          : "border border-[#291715]/8 hover:border-[#291715]/15"
      }`} style={!isComplete && isExpanded ? { borderColor: block.color + "60" } : {}}>

        {/* Collapsible Header */}
        <button
          onClick={onToggleExpand}
          className={`w-full px-4 py-4 flex items-center gap-3 transition-colors ${
            isExpanded && !isComplete ? "" : "hover:bg-[#fbf9fa]"
          }`}
          style={isExpanded && !isComplete ? { backgroundColor: block.color + "0D" } : {}}
        >
          {/* Block number badge */}
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all ${
              isComplete ? "bg-emerald-500 text-white" : "text-white"
            }`}
            style={!isComplete ? { backgroundColor: block.color } : {}}
          >
            {isComplete ? (
              <MaterialIcon icon="check" size={18} />
            ) : (
              block.id
            )}
          </div>

          {/* Title + progress */}
          <div className="flex-1 min-w-0 text-left">
            <h3 className={`font-bold text-sm ${isComplete ? "text-emerald-700" : "text-[#1b1c1d]"}`}>
              {block.title}
            </h3>
            {!isExpanded && !isComplete && (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 bg-[#291715]/5 rounded-full h-1.5 max-w-[120px]">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%`, backgroundColor: block.color }}
                  />
                </div>
                <span className="text-xs text-[#4a3d3d]/70">{checkedCount}/{total}</span>
              </div>
            )}
            {isComplete && !isExpanded && (
              <span className="text-xs text-emerald-600 font-medium">Completo!</span>
            )}
          </div>

          {/* Expand/collapse icon */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isExpanded && !isComplete && (
              <span className="text-xs font-semibold hidden sm:block" style={{ color: block.color }}>
                {checkedCount}/{total}
              </span>
            )}
            <MaterialIcon
              icon={isExpanded ? "expand_less" : "expand_more"}
              size={20}
              className={`transition-transform text-[#4a3d3d]/40`}
            />
          </div>
        </button>

        {/* Progress bar when expanded */}
        {isExpanded && !isComplete && (
          <div className="px-4 pb-2">
            <div className="w-full bg-white/60 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, backgroundColor: block.color }}
              />
            </div>
            <p className="text-xs mt-1.5 font-medium" style={{ color: block.color }}>
              {remaining === 0
                ? "Tudo pronto neste bloco!"
                : remaining === 1
                ? "Falta apenas 1 item!"
                : `Faltam ${remaining} itens para completar`}
            </p>
          </div>
        )}

        {/* Items - only when expanded */}
        {isExpanded && (
          <CardContent className="p-0 pt-1">
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
      </Card>
    </div>
  );
}
