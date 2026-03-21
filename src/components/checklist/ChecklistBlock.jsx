import React from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import ChecklistItem from "./ChecklistItem";

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

  const checkedCount = items.filter((i) => checkedItems[i.key]).length;

  return (
    <div className={`rounded-2xl overflow-hidden shadow-md ${highlight ? "ring-4 ring-red-600 ring-offset-2" : ""}`}>
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
              ? <MaterialIcon icon="expand_more" size={20} className="text-white" />
              : <MaterialIcon icon="expand_less" size={20} className="text-white" />
          )}
        </div>
      </div>

      {/* Items */}
      {!collapsed && (
        <div className="bg-white divide-y divide-slate-100">
          {items.map((item) => (
            <ChecklistItem
              key={item.key}
              item={item}
              checked={!!checkedItems[item.key]}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}