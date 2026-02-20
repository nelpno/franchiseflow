import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function ChecklistBlock({
  title,
  badge,
  badgeExtra,
  color,
  items,
  checkedItems,
  onToggle,
  collapsible = false,
  defaultCollapsed = false,
  highlight = false,
}) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  const checkedCount = items.filter(i => checkedItems[i.key]).length;

  return (
    <div
      className={`rounded-2xl overflow-hidden shadow-md ${highlight ? "ring-4 ring-red-600 ring-offset-2" : ""}`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
        style={{ backgroundColor: color }}
        onClick={collapsible ? () => setCollapsed(!collapsed) : undefined}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-white font-bold text-lg">{title}</h2>
          <span className="bg-white/20 text-white text-xs font-medium px-3 py-1 rounded-full">
            {badge}
          </span>
          {badgeExtra && (
            <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full">
              {badgeExtra}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-white/20 text-white text-sm font-bold px-3 py-1 rounded-full">
            {checkedCount}/{items.length}
          </span>
          {collapsible && (
            collapsed
              ? <ChevronDown className="w-5 h-5 text-white" />
              : <ChevronUp className="w-5 h-5 text-white" />
          )}
        </div>
      </div>

      {/* Items */}
      {!collapsed && (
        <div className="bg-white divide-y divide-slate-100">
          {items.map((item) => (
            <label
              key={item.key}
              className={`flex items-start gap-4 px-5 py-4 cursor-pointer transition-colors duration-150 hover:bg-slate-50 ${
                checkedItems[item.key] ? "bg-green-50" : ""
              }`}
            >
              <Checkbox
                checked={!!checkedItems[item.key]}
                onCheckedChange={() => onToggle(item.key)}
                className="mt-0.5 flex-shrink-0"
              />
              <span
                className={`text-sm leading-relaxed ${
                  checkedItems[item.key]
                    ? "line-through text-slate-400"
                    : "text-slate-800"
                }`}
              >
                {item.label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}