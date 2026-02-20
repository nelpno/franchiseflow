import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { ROLE_TAGS } from "./ONBOARDING_BLOCKS";

export default function OnboardingBlock({ block, items, onToggle, isAdmin, disabled }) {
  const blockItems = block.items || [];
  const checkedCount = blockItems.filter(i => items[i.key]).length;
  const total = blockItems.length;
  const progress = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

  const canMark = (item) => {
    if (isAdmin) return item.role !== "auto";
    if (item.role === "franchisor" || item.role === "auto") return false;
    return true;
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

            return (
              <div
                key={item.key}
                className={`flex items-start gap-3 px-5 py-3 ${!locked ? "hover:bg-slate-50 cursor-pointer" : "opacity-70"}`}
                onClick={() => !locked && onToggle(item.key)}
              >
                <div className="mt-0.5 flex-shrink-0">
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
                <div className="flex-1 min-w-0">
                  <span className={`text-sm ${checked ? "line-through text-slate-400" : "text-slate-700"}`}>
                    {item.label}
                  </span>
                </div>
                {tag && (
                  <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tag.className}`}>
                    {tag.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}