import React from "react";
import { PAYMENT_METHODS } from "@/lib/franchiseUtils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import logoMaxi from "@/assets/logo-maxi-massas-optimized.png";

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value || 0
  );

function getPaymentLabel(method) {
  const pm = PAYMENT_METHODS.find((p) => p.value === method);
  return pm?.label || method || "—";
}

function formatReceiptDate(saleDate, createdAt) {
  try {
    // Use sale_date for the date, created_at for the time
    const datePart = saleDate
      ? format(parseISO(saleDate), "dd/MM/yyyy", { locale: ptBR })
      : null;
    const timePart = createdAt
      ? format(parseISO(createdAt), "HH:mm")
      : null;

    if (datePart && timePart && timePart !== "00:00") {
      return `${datePart} às ${timePart}`;
    }
    return datePart || "—";
  } catch {
    return "—";
  }
}

const SaleReceipt = React.forwardRef(function SaleReceipt(
  { sale, saleItems, contact, franchiseName },
  ref
) {
  const totalValue =
    (parseFloat(sale.value) || 0) + (parseFloat(sale.delivery_fee) || 0);

  return (
    <div
      ref={ref}
      style={{
        width: 400,
        fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif",
        backgroundColor: "#ffffff",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)",
          padding: "24px 24px 20px",
          textAlign: "center",
        }}
      >
        <img
          src={logoMaxi}
          alt="Maxi Massas"
          style={{
            width: 64,
            height: 64,
            objectFit: "contain",
            margin: "0 auto 8px",
            display: "block",
            borderRadius: 12,
          }}
        />
        <div
          style={{
            color: "#ffffff",
            fontSize: 18,
            fontWeight: 700,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          {franchiseName || "Maxi Massas"}
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.8)",
            fontSize: 12,
            marginTop: 4,
          }}
        >
          Comprovante de Venda
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "20px 24px" }}>
        {/* Client & Date */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
            paddingBottom: 16,
            borderBottom: "1px solid #e9e8e9",
          }}
        >
          <div>
            {contact?.nome && (
              <>
                <div style={{ fontSize: 11, color: "#7a6d6d", marginBottom: 2 }}>
                  Cliente
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1b1c1d" }}>
                  {contact.nome}
                </div>
              </>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#7a6d6d", marginBottom: 2 }}>
              Data
            </div>
            <div style={{ fontSize: 13, color: "#1b1c1d" }}>
              {formatReceiptDate(sale.sale_date, sale.created_at)}
            </div>
          </div>
        </div>

        {/* Items */}
        {saleItems.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#7a6d6d",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 8,
              }}
            >
              Produtos
            </div>
            {saleItems.map((item, i) => (
              <div
                key={item.id || i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 0",
                  borderBottom:
                    i < saleItems.length - 1 ? "1px solid #f3f2f2" : "none",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, color: "#1b1c1d" }}>
                    {item.product_name}
                  </span>
                  <span style={{ fontSize: 12, color: "#7a6d6d", marginLeft: 6 }}>
                    x{item.quantity}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#4a3d3d",
                    fontVariantNumeric: "tabular-nums",
                    marginLeft: 12,
                    flexShrink: 0,
                  }}
                >
                  {formatCurrency(item.quantity * item.unit_price)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delivery fee */}
        {parseFloat(sale.delivery_fee) > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 0",
              borderTop: "1px solid #e9e8e9",
              fontSize: 13,
              color: "#4a3d3d",
            }}
          >
            <span>Frete</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(sale.delivery_fee)}
            </span>
          </div>
        )}

        {/* Discount */}
        {parseFloat(sale.discount_amount) > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 0",
              borderTop: "1px solid #e9e8e9",
              fontSize: 13,
              color: "#dc2626",
            }}
          >
            <span>
              Desconto{sale.discount_type === "percent" && sale.discount_input ? ` (${sale.discount_input}%)` : ""}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              −{formatCurrency(sale.discount_amount)}
            </span>
          </div>
        )}

        {/* Total */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 0",
            borderTop: "2px solid #1b1c1d",
            marginTop: 4,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#1b1c1d",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            Total
          </span>
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#1b1c1d",
              fontVariantNumeric: "tabular-nums",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            {formatCurrency(totalValue)}
          </span>
        </div>

        {/* Payment method */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            color: "#4a3d3d",
            paddingTop: 4,
          }}
        >
          <span>Pagamento</span>
          <span style={{ fontWeight: 500 }}>
            {getPaymentLabel(sale.payment_method)}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          backgroundColor: "#fbf9fa",
          padding: "16px 24px",
          textAlign: "center",
          borderTop: "1px solid #e9e8e9",
        }}
      >
        <div style={{ fontSize: 13, color: "#4a3d3d", marginBottom: 4 }}>
          Obrigado pela preferencia!
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#7a6d6d",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Maxi Massas
        </div>
      </div>
    </div>
  );
});

export default SaleReceipt;
