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

const dashedBorder = "1px dashed #999";

const SaleReceipt = React.forwardRef(function SaleReceipt(
  { sale, saleItems, contact, franchiseName },
  ref
) {
  const subtotal = saleItems.reduce(
    (sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0),
    0
  );
  const deliveryFee = parseFloat(sale.delivery_fee) || 0;
  const discountAmount = parseFloat(sale.discount_amount) || 0;
  const totalValue =
    (parseFloat(sale.value) || 0) - discountAmount + deliveryFee;

  return (
    <div
      ref={ref}
      className="receipt"
      style={{
        width: "100%",
        maxWidth: 400,
        fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif",
        backgroundColor: "#ffffff",
        padding: "20px 16px",
        color: "#1b1c1d",
      }}
    >
      <style>{`
        @media print {
          .receipt {
            width: 100% !important;
            max-width: 100% !important;
            padding: 2mm !important;
            font-family: 'Courier New', 'Consolas', ui-monospace, monospace !important;
            font-weight: 700 !important;
            font-size: 11pt !important;
            line-height: 1.3 !important;
            color: #000 !important;
            background: #fff !important;
            -webkit-font-smoothing: none;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .receipt * {
            color: #000 !important;
            background-color: transparent !important;
            border-color: #000 !important;
            box-shadow: none !important;
            text-shadow: none !important;
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          .receipt img {
            max-width: 40mm !important;
            height: auto !important;
          }
          .receipt table {
            table-layout: fixed;
            width: 100%;
          }
        }
      `}</style>
      {/* Header — logo + nome + subtítulo */}
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <img
          src={logoMaxi}
          alt="Maxi Massas"
          style={{
            width: 80,
            height: 80,
            objectFit: "contain",
            margin: "0 auto 10px",
            display: "block",
          }}
        />
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            letterSpacing: "0.02em",
          }}
        >
          {franchiseName || "Maxi Massas"}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#666",
            marginTop: 2,
          }}
        >
          Comprovante de Venda
        </div>
      </div>

      {/* Separador */}
      <div style={{ borderTop: dashedBorder, margin: "8px 0" }} />

      {/* Cliente, Endereço e Data */}
      <div style={{ fontSize: 12, lineHeight: 1.6 }}>
        {contact?.nome && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>Cliente</span>
            <span style={{ fontWeight: 600 }}>{contact.nome}</span>
          </div>
        )}
        {(contact?.endereco || contact?.bairro) && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "#666", flexShrink: 0 }}>Endereço</span>
            <span style={{ textAlign: "right", fontWeight: 600 }}>
              {[contact.endereco, contact.bairro].filter(Boolean).join(" — ")}
            </span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#666" }}>Data</span>
          <span>{formatReceiptDate(sale.sale_date, sale.created_at)}</span>
        </div>
      </div>

      <div style={{ borderTop: dashedBorder, margin: "8px 0" }} />

      {/* Cabeçalho da tabela */}
      {saleItems.length > 0 && (
        <>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#444",
              marginBottom: 6,
            }}
          >
            Produtos
          </div>

          <div style={{ borderBottom: "1px solid #ddd", paddingBottom: 2 }} />

          {/* Itens */}
          {saleItems.map((item, i) => {
            const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
            return (
              <div
                key={item.id || i}
                style={{
                  fontSize: 13,
                  padding: "5px 0",
                  borderBottom:
                    i < saleItems.length - 1 ? "1px solid #f0f0f0" : "none",
                }}
              >
                {/* Nome do produto — nunca corta */}
                <div style={{ marginBottom: 2, lineHeight: 1.3, wordBreak: "break-word" }}>
                  {item.product_name}
                </div>
                {/* Qtd × Preço = Total na mesma linha */}
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, fontSize: 12, color: "#444" }}>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {item.quantity} × {formatCurrency(item.unit_price)}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "#1b1c1d", minWidth: 72, textAlign: "right" }}>
                    {formatCurrency(lineTotal)}
                  </span>
                </div>
              </div>
            );
          })}

          <div style={{ borderTop: dashedBorder, margin: "8px 0" }} />
        </>
      )}

      {/* Subtotais */}
      <div style={{ fontSize: 13, lineHeight: 1.8 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#444" }}>Valor dos produtos</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatCurrency(subtotal)}
          </span>
        </div>

        {deliveryFee > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#444" }}>Frete</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(deliveryFee)}
            </span>
          </div>
        )}

        {discountAmount > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "#dc2626",
            }}
          >
            <span>
              Desconto
              {sale.discount_type === "percent" && sale.discount_input
                ? ` (${sale.discount_input}%)`
                : ""}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              −{formatCurrency(discountAmount)}
            </span>
          </div>
        )}
      </div>

      {/* Total — destaque */}
      <div
        style={{
          borderTop: "2px solid #1b1c1d",
          marginTop: 6,
          paddingTop: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          Total
        </span>
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          {formatCurrency(totalValue)}
        </span>
      </div>

      <div style={{ borderTop: dashedBorder, margin: "8px 0" }} />

      {/* Pagamento */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "#444",
        }}
      >
        <span>Pagamento</span>
        <span style={{ fontWeight: 600, color: "#1b1c1d" }}>
          {getPaymentLabel(sale.payment_method)}
        </span>
      </div>

      {sale.observacoes && (
        <>
          <div style={{ borderTop: dashedBorder, margin: "8px 0" }} />
          <div style={{ fontSize: 12 }}>
            <span style={{ color: "#666", fontWeight: 600 }}>Obs.</span>
            <div style={{ marginTop: 2, color: "#1b1c1d", whiteSpace: "pre-wrap" }}>
              {sale.observacoes}
            </div>
          </div>
        </>
      )}

      <div style={{ borderTop: dashedBorder, margin: "10px 0" }} />

      {/* Footer */}
      <div style={{ textAlign: "center", paddingTop: 2 }}>
        <div style={{ fontSize: 12, color: "#444" }}>
          Obrigado pela preferência!
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#1b1c1d",
            marginTop: 4,
          }}
        >
          Maxi Massas
        </div>
      </div>
    </div>
  );
});

export default SaleReceipt;
