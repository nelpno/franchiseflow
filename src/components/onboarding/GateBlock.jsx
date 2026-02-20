import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Rocket } from "lucide-react";
import { GATE_BLOCK, ROLE_TAGS } from "./ONBOARDING_BLOCKS";

export default function GateBlock({ items, onToggle, isAdmin, blocks1to8Complete }) {
  const gateItems = GATE_BLOCK.items;
  const checkedCount = gateItems.filter(i => items[i.key]).length;
  const total = gateItems.length;

  const canMark = (item) => {
    if (item.role === "auto") return false;
    if (!blocks1to8Complete) return false;
    if (!isAdmin && item.role === "franchisor") return false;
    return true;
  };

  return (
    <Card className="border-2 overflow-hidden" style={{ borderColor: "#C49A2A", background: "linear-gradient(135deg, #fff9f0 0%, #fffdf5 100%)" }}>
      <div className="px-5 py-4" style={{ background: "linear-gradient(135deg, #D32F2F18 0%, #C49A2A22 100%)" }}>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: "linear-gradient(135deg, #D32F2F, #C49A2A)" }}>
            9
          </div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Rocket className="w-4 h-4 text-amber-600" />
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

            return (
              <div
                key={item.key}
                className={`flex items-start gap-3 px-5 py-3 ${!locked ? "hover:bg-amber-50 cursor-pointer" : "opacity-70"} ${item.highlight ? "bg-amber-50/60" : ""}`}
                onClick={() => !locked && onToggle(item.key)}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {locked ? (
                    <div className="w-5 h-5 rounded border-2 border-amber-300 bg-amber-50 flex items-center justify-center">
                      {item.role === "auto" ? (
                        checked ? (
                          <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : null
                      ) : (
                        <Lock className="w-3 h-3 text-amber-400" />
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
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${item.highlight ? "text-amber-900 font-bold text-base" : checked ? "line-through text-slate-400" : "text-slate-700"}`}>
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