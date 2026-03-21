import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { GATE_BLOCK, ROLE_TAGS } from "./ONBOARDING_BLOCKS";
import { ITEM_DETAILS } from "./ITEM_DETAILS";

function ItemDetails({ details }) {
  if (!details) return null;
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

  return (
    <Card className="border-2 overflow-hidden" style={{ borderColor: "#C49A2A", background: "linear-gradient(135deg, #fff9f0 0%, #fffdf5 100%)" }}>
      <div className="px-5 py-4" style={{ background: "linear-gradient(135deg, #D32F2F18 0%, #C49A2A22 100%)" }}>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: "linear-gradient(135deg, #D32F2F, #C49A2A)" }}>
            9
          </div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <MaterialIcon icon="rocket_launch" size={16} className="text-amber-600" />
            Gate de Liberação
          </h3>
          <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold">
            PRÉ-REQUISITO PARA TRÁFEGO PAGO
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-amber-700">
            {blocks1to8Complete ? "Blocos 1-8 completos! Aguardando validação do admin." : "Complete os blocos 1-8 primeiro"}
          </span>
          <span className="text-sm font-semibold text-amber-700">{checkedCount}/{total}</span>
        </div>
        <div className="w-full bg-white/60 rounded-full h-2 mt-2">
          <div
            className="h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.round((checkedCount / total) * 100)}%`, background: "linear-gradient(90deg, #D32F2F, #C49A2A)" }}
          />
        </div>
      </div>
      <CardContent className="p-0">
        <div className="divide-y divide-amber-100">
          {gateItems.map((item) => {
            const tag = ROLE_TAGS[item.role];
            const locked = !canMark(item);
            const checked = !!items[item.key];
            const isExpanded = !!expandedKeys[item.key];
            const details = ITEM_DETAILS[item.key];

            return (
              <div key={item.key}>
                <div className={`flex items-start gap-3 px-5 py-3 ${!locked ? "hover:bg-amber-50" : "opacity-70"} ${item.highlight ? "bg-amber-50/60" : ""}`}>
                  {/* Checkbox area */}
                  <div
                    className={`mt-0.5 flex-shrink-0 ${!locked ? "cursor-pointer" : ""}`}
                    onClick={() => !locked && onToggle(item.key)}
                  >
                    {locked ? (
                      <div className="w-5 h-5 rounded border-2 border-amber-300 bg-amber-50 flex items-center justify-center">
                        {item.role === "auto" ? (
                          checked ? (
                            <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : null
                        ) : (
                          <MaterialIcon icon="lock" size={12} className="text-amber-400" />
                        )}
                      </div>
                    ) : (
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          checked ? "border-green-500 bg-green-500" : "border-amber-400 bg-white"
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
                    <span className={`text-sm font-medium ${item.highlight ? "text-amber-900 font-bold text-base" : checked ? "line-through text-slate-400" : "text-slate-700"}`}>
                      {item.label}
                    </span>
                    {details && (
                      <MaterialIcon
                        icon="chevron_right"
                        size={14}
                        className={`flex-shrink-0 mt-0.5 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
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