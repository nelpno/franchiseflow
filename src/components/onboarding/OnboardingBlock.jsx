import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, ChevronDown, ExternalLink, Info } from "lucide-react";
import { ROLE_TAGS } from "./ONBOARDING_BLOCKS";
import { ITEM_DETAILS } from "./ITEM_DETAILS";

function ItemDetails({ details }) {
  if (!details) return null;
  const lines = details.text.split("\n");
  return (
    <div className="mx-5 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-slate-600 leading-relaxed">
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
              className="inline-flex items-center gap-1 text-blue-600 underline underline-offset-2 hover:text-blue-800 font-medium"
            >
              {link.label}
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OnboardingBlock({ block, items, onToggle, isAdmin, disabled }) {
  const [expandedKeys, setExpandedKeys] = useState({});
  const blockItems = block.items || [];
  const checkedCount = blockItems.filter(i => items[i.key]).length;
  const total = blockItems.length;
  const progress = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

  const canMark = (item) => {
    if (isAdmin) return item.role !== "auto";
    if (item.role === "franchisor" || item.role === "auto") return false;
    return true;
  };

  const toggleExpand = (key, e) => {
    e.stopPropagation();
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Card className={`border-2 ${block.borderColor || "border-slate-200"} overflow-hidden`}>
      <div className="px-5 py-4" style={{ backgroundColor: block.color + "18" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: block.color }}>
              {block.id}
            </div>
            <h3 className="font-bold text-slate-800">{block.title}</h3>
          </div>
          <span className="text-sm font-semibold" style={{ color: block.color }}>{checkedCount}/{total}</span>
        </div>
        <div className="w-full bg-white/60 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, backgroundColor: block.color }}
          />
        </div>
      </div>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          {blockItems.map((item) => {
            const tag = ROLE_TAGS[item.role];
            const locked = !canMark(item) || disabled;
            const checked = !!items[item.key];
            const isExpanded = !!expandedKeys[item.key];
            const details = ITEM_DETAILS[item.key];

            return (
              <div key={item.key}>
                <div className={`flex items-start gap-3 px-5 py-3 ${!locked ? "hover:bg-slate-50" : "opacity-70"}`}>
                  {/* Checkbox area — marks/unmarks */}
                  <div
                    className={`mt-0.5 flex-shrink-0 ${!locked ? "cursor-pointer" : ""}`}
                    onClick={() => !locked && onToggle(item.key)}
                  >
                    {locked && item.role !== "auto" ? (
                      <div className="w-4 h-4 rounded border-2 border-slate-300 bg-slate-100 flex items-center justify-center">
                        <Lock className="w-2.5 h-2.5 text-slate-400" />
                      </div>
                    ) : (
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                          checked
                            ? "border-green-500 bg-green-500"
                            : item.role === "auto"
                            ? "border-slate-300 bg-slate-100"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {checked && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Text + expand area */}
                  <div
                    className="flex-1 min-w-0 flex items-start gap-1 cursor-pointer select-none"
                    onClick={(e) => toggleExpand(item.key, e)}
                  >
                    <span className={`text-sm ${checked ? "line-through text-slate-400" : "text-slate-700"}`}>
                      {item.label}
                    </span>
                    {details && (
                      <ChevronRight
                        className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                      />
                    )}
                  </div>

                  {tag && (
                    <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tag.className}`}>
                      {tag.label}
                    </span>
                  )}
                </div>

                {/* Expandable details */}
                {isExpanded && details && <ItemDetails details={details} />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}