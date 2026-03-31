import React from "react";
import { Badge } from "@/components/ui/badge";

/**
 * Calculates margin percentage: (sale_price - cost_price) / cost_price * 100
 */
export function getMarginPercent(item) {
  if (!item.cost_price || !item.sale_price || item.cost_price <= 0) return null;
  return ((item.sale_price - item.cost_price) / item.cost_price) * 100;
}

/**
 * Returns a colored Badge JSX element showing margin percentage.
 * Red <50%, Gold 50-80%, Green >=80%
 */
export function getMarginBadge(item) {
  const margin = getMarginPercent(item);
  if (margin === null) return null;

  let colorClass = "bg-green-100 text-green-700"; // >= 80%
  if (margin < 50) {
    colorClass = "bg-red-100 text-red-700";
  } else if (margin < 80) {
    colorClass = "bg-[#d4af37]/10 text-[#775a19]";
  }

  return (
    <Badge className={`${colorClass} rounded-full px-1.5 py-0 text-[10px] font-bold ml-1`}>
      {margin.toFixed(0)}%
    </Badge>
  );
}

/**
 * Counts inventory items by margin tier.
 * Returns { low, medium, high, noPrice }
 *   low: margin <50%
 *   medium: margin 50-80%
 *   high: margin >=80%
 *   noPrice: missing cost or sale price
 *   avgMargin: average margin of items that have both prices
 */
export function getMarginTierCounts(items) {
  let low = 0, medium = 0, high = 0, noPrice = 0;
  let totalMargin = 0, marginCount = 0;

  for (const item of items) {
    const margin = getMarginPercent(item);
    if (margin === null) {
      noPrice++;
      continue;
    }
    totalMargin += margin;
    marginCount++;
    if (margin < 50) low++;
    else if (margin < 80) medium++;
    else high++;
  }

  return {
    low,
    medium,
    high,
    noPrice,
    avgMargin: marginCount > 0 ? totalMargin / marginCount : 0,
    total: items.length,
  };
}
