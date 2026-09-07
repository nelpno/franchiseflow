import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import MaterialIcon from "@/components/ui/MaterialIcon";
import ProgressRing from "./ProgressRing";
import { GATE_BLOCK, ROLE_TAGS } from "./ONBOARDING_BLOCKS";
import { ITEM_DETAILS } from "./ITEM_DETAILS";

function ItemDetails({ details }) {
  if (!details) return null;
  return (
    <div className="mx-5 mb-3 rounded-lg border border-brand-gold/20 bg-brand-gold/5 px-4 py-3 text-[13px] text-ink-2 leading-relaxed">
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
              className="inline-flex items-center gap-1 text-brand underline underline-offset-2 hover:text-brand-dark font-medium"
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

export default function GateBlock({ items, onToggle, isAdmin, blocks1to8Complete }) {
  const [expandedKeys, setExpandedKeys] = useState({});
  const gateItems = GATE_BLOCK.items;
  const checkedCount = gateItems.filter(i => items[i.key]).length;
  const total = gateItems.length;

  const canMark = (item) => {
    if (item.role === "auto") return false;
    if (!blocks1to8Complete) return false;
    if (!isAdmin && item.role === "franchisor") return false;
    return true;
  };

  const toggleExpand = (key, e) => {
    e.stopPropagation();
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isGateComplete = checkedCount === total;
  const gateProgress = Math.round((checkedCount / total) * 100);

  return (
    <Card
      className={`overflow-hidden rounded-xl transition-all duration-300 ${
        isGateComplete ? "bg-[#ecfdf5]/30 border border-emerald-200" : "border border-ink-shadow/5 shadow-md"
      }`}
      style={{
        borderLeft: isGateComplete
          ? "5px solid #10b981"
          : "5px solid transparent",
        borderImage: isGateComplete
          ? undefined
          : "linear-gradient(to bottom, #b91c1c, #C49A2A) 1",
        background: isGateComplete ? undefined : "linear-gradient(135deg, #fff9f0 0%, #fffdf5 100%)",
      }}
    >
      <div className="p-3 sm:p-4" style={!isGateComplete ? { background: "linear-gradient(135deg, #D32F2F08 0%, #C49A2A10 100%)" } : {}}>
        <div className="flex items-center gap-3">
          <ProgressRing
            size={48}
            progress={gateProgress}
            isComplete={isGateComplete}
            icon="verified"
            color="#C49A2A"
          />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`font-bold text-sm ${isGateComplete ? "text-emerald-700" : "text-ink"}`}>
                Gate de Liberação
              </h3>
              <Badge className="bg-brand-gold/10 text-brand-gold-ink border border-brand-gold/30 text-[10px] font-bold">
                PRÉ-REQUISITO
              </Badge>
            </div>
            <p className="text-xs mt-0.5" style={{ color: isGateComplete ? "#059669" : "#775a19" }}>
              {isGateComplete
                ? "Gate completo!"
                : blocks1to8Complete
                ? "Aguardando validação do admin"
                : "Complete as 8 missões primeiro"}
            </p>
          </div>
        </div>
      </div>
      <CardContent className="p-0">
        <div className="divide-y divide-brand-gold/10">
          {gateItems.map((item) => {
            const tag = ROLE_TAGS[item.role];
            const locked = !canMark(item);
            const checked = !!items[item.key];
            const isExpanded = !!expandedKeys[item.key];
            const details = ITEM_DETAILS[item.key];

            return (
              <div key={item.key}>
                <div className={`flex items-start gap-3 px-5 py-3 ${!locked ? "hover:bg-brand-gold/5" : "opacity-70"} ${item.highlight ? "bg-brand-gold/5" : ""}`}>
                  {/* Checkbox area */}
                  <div
                    className={`mt-0.5 flex-shrink-0 ${!locked ? "cursor-pointer" : ""}`}
                    onClick={() => !locked && onToggle(item.key)}
                  >
                    {locked ? (
                      <div className="w-7 h-7 rounded-lg border-2 border-brand-gold/30 bg-brand-gold/5 flex items-center justify-center">
                        {item.role === "auto" ? (
                          checked ? (
                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : null
                        ) : (
                          <MaterialIcon icon="lock" size={12} className="text-brand-gold/60" />
                        )}
                      </div>
                    ) : (
                      <div
                        className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
                          checked ? "border-emerald-500 bg-emerald-500 shadow-sm shadow-emerald-200" : "border-brand-gold/40 bg-white hover:border-brand-gold"
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

                  {/* Text + expand area */}
                  <div
                    className="flex-1 min-w-0 flex items-start gap-1 cursor-pointer select-none"
                    onClick={(e) => toggleExpand(item.key, e)}
                  >
                    <span className={`text-sm font-medium ${item.highlight ? "text-brand-gold-ink font-bold text-base" : checked ? "line-through text-ink-2/40" : "text-ink"}`}>
                      {item.label}
                    </span>
                    {details && (
                      <MaterialIcon
                        icon="chevron_right"
                        size={14}
                        className={`flex-shrink-0 mt-0.5 text-ink-2/70 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                      />
                    )}
                  </div>

                  {tag && (
                    <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tag.className}`}>
                      {tag.label}
                    </span>
                  )}
                </div>

                {isExpanded && details && <ItemDetails details={details} />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}