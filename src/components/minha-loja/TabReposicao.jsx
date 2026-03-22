import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MaterialIcon from "@/components/ui/MaterialIcon";
import PurchaseOrderForm from "./PurchaseOrderForm";
import PurchaseOrderHistory from "./PurchaseOrderHistory";

export default function TabReposicao({
  franchiseId,
  inventoryItems,
  saleItems,
}) {
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [orderRefreshKey, setOrderRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#1b1c1d] font-plus-jakarta">
            Reposicao de Estoque
          </h2>
          <p className="text-sm text-[#534343]">
            Faca pedidos para a fabrica Maxi Massas
          </p>
        </div>

        <Button
          onClick={() => setShowOrderDialog(true)}
          className="gap-2 bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl"
        >
          <MaterialIcon icon="add_shopping_cart" size={18} />
          Novo Pedido
        </Button>
      </div>

      {/* Purchase Order History */}
      <PurchaseOrderHistory franchiseId={franchiseId} refreshKey={orderRefreshKey} />

      {/* Purchase Order Dialog */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-plus-jakarta text-[#1b1c1d]">
              <MaterialIcon icon="local_shipping" size={20} className="text-[#d4af37]" />
              Novo Pedido de Compra
            </DialogTitle>
          </DialogHeader>
          <PurchaseOrderForm
            franchiseId={franchiseId}
            inventoryItems={inventoryItems}
            saleItems={saleItems}
            onSave={() => {
              setShowOrderDialog(false);
              setOrderRefreshKey((k) => k + 1);
            }}
            onCancel={() => setShowOrderDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
