// src/components/reports/FranchiseReportTable.jsx
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { formatBRL } from "@/lib/formatBRL";

const COLUMNS = [
  { key: "name", label: "Franquia", sortable: true, align: "left", sticky: true },
  { key: "revenue", label: "Receita", sortable: true, align: "right" },
  { key: "ordersCount", label: "Pedidos", sortable: true, align: "right" },
  { key: "avgTicket", label: "Ticket médio", sortable: true, align: "right" },
  { key: "botConversion", label: "Conversão bot", sortable: true, align: "right" },
  { key: "newCustomers", label: "Novos clientes", sortable: true, align: "right" },
  { key: "subscription", label: "Assinatura", sortable: false, align: "center" },
];

const SUB_STATUS_BADGE = {
  PAID: { label: "Pago", className: "bg-green-100 text-green-800" },
  RECEIVED: { label: "Pago", className: "bg-green-100 text-green-800" },
  CONFIRMED: { label: "Pago", className: "bg-green-100 text-green-800" },
  PENDING: { label: "Pendente", className: "bg-yellow-100 text-yellow-800" },
  OVERDUE: { label: "Vencido", className: "bg-red-100 text-red-800" },
  CANCELLED: { label: "Cancelada", className: "bg-gray-100 text-gray-700" },
};

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function SortIcon({ direction }) {
  if (!direction) return <MaterialIcon icon="unfold_more" className="text-sm opacity-40" />;
  return (
    <MaterialIcon
      icon={direction === "asc" ? "arrow_upward" : "arrow_downward"}
      className="text-sm"
    />
  );
}

export default function FranchiseReportTable({ rows, isLoading }) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState("revenue");
  const [sortDir, setSortDir] = useState("desc");

  const sorted = useMemo(() => {
    if (!rows) return [];
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") {
        return sortDir === "asc" ? av.localeCompare(bv, "pt-BR") : bv.localeCompare(av, "pt-BR");
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const handleSort = (key) => {
    if (!COLUMNS.find((c) => c.key === key)?.sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const handleRowClick = (row) => {
    if (!row.evolutionInstanceId) return;
    navigate(`/Franchises?id=${encodeURIComponent(row.evolutionInstanceId)}&openSheet=1`);
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!sorted.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <MaterialIcon icon="inbox" className="text-4xl text-gray-300" />
        <p className="text-sm text-gray-600 mt-2">Sem vendas no período selecionado</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((col) => (
              <TableHead
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={[
                  col.sortable ? "cursor-pointer select-none" : "",
                  col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                  col.sticky ? "sticky left-0 bg-white z-10" : "",
                  "whitespace-nowrap",
                ].filter(Boolean).join(" ")}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && <SortIcon direction={sortKey === col.key ? sortDir : null} />}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => {
            const subInfo = SUB_STATUS_BADGE[row.subscriptionStatus] || {
              label: "Aguardando",
              className: "bg-yellow-100 text-yellow-800",
            };
            return (
              <TableRow
                key={row.evolutionInstanceId || row.id}
                onClick={() => handleRowClick(row)}
                className="cursor-pointer hover:bg-gray-50"
              >
                <TableCell className="sticky left-0 bg-white z-10 font-medium whitespace-nowrap">
                  {row.name}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatBRL(row.revenue)}</TableCell>
                <TableCell className="text-right tabular-nums">{row.ordersCount}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.ordersCount > 0 ? formatBRL(row.avgTicket) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPercent(row.botConversion)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.newCustomers}</TableCell>
                <TableCell className="text-center">
                  <Badge className={subInfo.className}>{subInfo.label}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
