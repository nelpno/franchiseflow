import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { CHECKLIST_DETAILS } from "./CHECKLIST_DETAILS";

export default function ChecklistItem({ item, checked, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const details = CHECKLIST_DETAILS[item.key];

  const handleCopy = (e) => {
    e.stopPropagation();
    if (!details?.script) return;
    navigator.clipboard.writeText(details.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTextClick = (e) => {
    e.preventDefault();
    if (details) setExpanded((prev) => !prev);
  };

  const handleCheckboxChange = (e) => {
    onToggle(item.key);
  };

  return (
    <div className={`border-b border-slate-100 last:border-b-0 transition-colors duration-150 ${checked ? "bg-red-50" : "bg-white"}`}>
      {/* Main row */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Checkbox - click only marks */}
        <div
          className="mt-0.5 flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onToggle(item.key); }}
        >
          <Checkbox
            checked={!!checked}
            onCheckedChange={() => onToggle(item.key)}
            className="flex-shrink-0"
          />
        </div>

        {/* Text + chevron - click only expands */}
        <div
          className={`flex-1 flex items-start justify-between gap-2 ${details ? "cursor-pointer" : ""}`}
          onClick={handleTextClick}
        >
          <span
            className={`text-sm leading-relaxed flex-1 ${
              checked ? "line-through text-slate-400" : "text-slate-800"
            }`}
          >
            {item.label}
          </span>
          {details && (
            <MaterialIcon
              icon="chevron_right"
              size={16}
              className={`flex-shrink-0 mt-0.5 text-slate-400 transition-transform duration-200 ${
                expanded ? "rotate-90" : ""
              }`}
            />
          )}
        </div>
      </div>

      {/* Expandable details */}
      {expanded && details && (
        <div
          className="mx-4 mb-3 rounded-xl p-4 text-sm"
          style={{ backgroundColor: "#FFF8E1", border: "1px solid #F0E0A0" }}
        >
          {/* Main tip text */}
          <p className="text-slate-700 leading-relaxed whitespace-pre-line">{details.text}</p>

          {/* Script block */}
          {details.script && (
            <div
              className="mt-3 rounded-lg p-3 bg-white relative"
              style={{ borderLeft: "4px solid #C49A2A" }}
            >
              {details.scriptLabel && (
                <p className="text-xs font-bold text-amber-700 mb-2 uppercase tracking-wide">
                  📋 Script: {details.scriptLabel}
                </p>
              )}
              <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line font-mono text-xs">
                {details.script}
              </p>
              <button
                onClick={handleCopy}
                className={`mt-3 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 ${
                  copied
                    ? "bg-red-100 text-[#b91c1c]"
                    : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                }`}
              >
                {copied ? (
                  <><MaterialIcon icon="check" size={12} /> Copiado!</>
                ) : (
                  <><MaterialIcon icon="content_copy" size={12} /> Copiar script</>
                )}
              </button>
            </div>
          )}

          {/* Note */}
          {details.note && (
            <p className="mt-3 text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
              💡 {details.note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}