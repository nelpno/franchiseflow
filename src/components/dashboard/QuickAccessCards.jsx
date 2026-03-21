import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Package, CheckSquare, AlertTriangle, Megaphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function QuickAccessCards({ lowStockCount, checklistDone, checklistTotal, marketingCount }) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate(createPageUrl("Inventory"))}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Estoque</span>
          </div>
          {lowStockCount > 0 ? (
            <div className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {lowStockCount} {lowStockCount === 1 ? "item baixo" : "itens baixos"}
              </span>
            </div>
          ) : (
            <span className="text-sm text-emerald-600 font-medium">Tudo em dia</span>
          )}
        </CardContent>
      </Card>

      <Card
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate(createPageUrl("MyChecklist"))}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckSquare className="h-5 w-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Checklist</span>
          </div>
          <span className="text-sm font-medium text-gray-900">
            {checklistDone}/{checklistTotal} feito
          </span>
        </CardContent>
      </Card>

      <Card
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate(createPageUrl("Marketing"))}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Megaphone className="h-5 w-5 text-rose-600" />
            <span className="text-sm font-medium text-gray-700">Marketing</span>
          </div>
          <span className="text-sm text-gray-600 font-medium">Ver materiais</span>
        </CardContent>
      </Card>
    </div>
  );
}
