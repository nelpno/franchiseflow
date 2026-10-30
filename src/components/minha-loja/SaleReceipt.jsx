import React from "react";
import { getPaymentMethodLabel } from "@/lib/franchiseUtils";
import { formatPhone } from "@/lib/whatsappUtils";
import { formatBRL as formatCurrency } from "@/lib/formatters";
import {
  resolveDeliveryLabel,
  formatReceiptAddressLine,
  formatCardFeePercent,
  formatReceiptDateTime,
  formatReceiptLaunch,
  showProductsSubtotal,
  ENDERECO_NAO_INFORMADO,
} from "@/lib/receiptUtils";
import logoMaxi from "@/assets/logo-maxi-massas-optimized.png";

const getPaymentLabel = getPaymentMethodLabel;

const dashedBorder = "1px dashed #999";

// Regras do papel: valem na impressão e no PDF (receipt-pdf). O tamanho da letra precisa de classe
// e !important porque o estilo inline (px) venceria a herança do font-size da raiz.
const regrasDoPapel = (r) => `
  ${r} {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box;
    padding: 2mm !important;
    font-family: 'Courier New', 'Consolas', ui-monospace, monospace !important;
    font-weight: 700 !important;
    font-size: 10pt !important;
    line-height: 1.3 !important;
    color: #000 !important;
    background: #fff !important;
    -webkit-font-smoothing: none;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  ${r} * {
    color: #000 !important;
    background-color: transparent !important;
    border-color: #000 !important;
    box-shadow: none !important;
    text-shadow: none !important;
    font-weight: 700 !important;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  ${r} div, ${r} span { font-size: 10pt !important; }
  ${r} .r-titulo { font-size: 12pt !important; }
  ${r} .r-pedido, ${r} .r-endereco, ${r} .r-total-rotulo { font-size: 11pt !important; }
  ${r} .r-total { font-size: 15pt !important; }
  ${r} img {
    width: 18mm !important;
    max-width: 18mm !important;
    height: auto !important;
    margin-bottom: 4px !important;
  }
  ${r} > div { break-inside: avoid; page-break-inside: avoid; }
  /* Preço e data não quebram no meio ("R$ 111,7" / "0"): quem cede é o rótulo ou a linha. */
  ${r} .r-valor, ${r} .r-total {
    white-space: nowrap;
    overflow-wrap: normal;
    word-break: normal;
    flex-shrink: 0;
  }
`;

// Folha comum (A4, carta, "Salvar como PDF"): a raiz se adapta à largura do papel, e sem este
// limite o comprovante esticava na folha inteira. Na bobina (até 112 mm) a regra não entra.
const estilosDoCupom = `
  @media print {
    ${regrasDoPapel(".receipt")}
  }
  @media print and (min-width: 120mm) {
    .receipt {
      max-width: 80mm !important;
      margin: 8mm auto 0 !important;
    }
  }
  ${regrasDoPapel(".receipt.receipt-pdf")}
`;

const SaleReceipt = React.forwardRef(function SaleReceipt(
  { sale, saleItems, contact, franchiseName, unitWhatsApp },
  ref
) {
  const subtotal = saleItems.reduce(
    (sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0),
    0
  );
  const deliveryFee = parseFloat(sale.delivery_fee) || 0;
  const discountAmount = parseFloat(sale.discount_amount) || 0;
  const feePassedToCustomer = sale.fee_passed_to_customer === true;
  const cardFeeAmount = parseFloat(sale.card_fee_amount) || 0;
  const cardFeePercent = parseFloat(sale.card_fee_percent) || 0;
  const showCardFeeRow = feePassedToCustomer && cardFeeAmount > 0;
  const totalValue =
    (parseFloat(sale.value) || 0) -
    discountAmount +
    deliveryFee +
    (showCardFeeRow ? cardFeeAmount : 0);

  // S13.1 (28/09/2026): Entrega/Retirada explícito e endereço da VENDA primeiro (o robô grava
  // sales.customer_address desde a S4.2), depois o do contato "vivo"; sem nenhum, avisa em vez
  // de calar. Venda legada sem delivery_method (P3, 28/09/2026) infere pelo frete/endereço em
  // vez de virar "Retirada" por default; sem sinal nenhum, deliveryLabel vem null (sem selo).
  // Regra inteira em src/lib/receiptUtils.js (testada, sem depender do DOM).
  const deliveryLabel = resolveDeliveryLabel(sale);
  const receiptAddressLine = formatReceiptAddressLine({ sale, contact });
  // Telefone do cliente no cupom — o entregador liga direto em vez de acionar a franqueada.
  // Mesma cascata do endereço: contato "vivo" primeiro, snapshot da venda como fallback.
  const receiptPhone = formatPhone(contact?.telefone || sale.contact_phone || "");
  // Em entrega a observação (portaria, troco) sobe para junto do endereço: é o entregador quem lê.
  const obsJuntoDoEndereco = deliveryLabel === "Entrega";
  const launchLine = formatReceiptLaunch(sale.sale_date, sale.created_at);
  const productsSubtotalVisible = showProductsSubtotal({
    subtotal,
    total: totalValue,
    deliveryFee,
    discountAmount,
    cardFeeShown: showCardFeeRow,
  });

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
      <style>{estilosDoCupom}</style>
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
          className="r-titulo"
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
            color: "#7a6d6d",
            marginTop: 2,
          }}
        >
          Comprovante de Venda
        </div>
        {sale.sale_number ? (
          <div
            className="r-pedido"
            style={{
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "0.04em",
              marginTop: 6,
            }}
          >
            Pedido #{sale.sale_number}
          </div>
        ) : null}
        {/* Entrega/Retirada explícito (S13.1) — nunca "loja"; texto puro, sem ícone (o cupom
            pode ir pra um iframe de impressão que só carrega Inter/Plus Jakarta). Venda legada
            sem sinal nenhum (sem delivery_method, sem frete, sem endereço) não mostra selo. */}
        {deliveryLabel && (
          <div
            style={{
              display: "inline-block",
              marginTop: 8,
              padding: "3px 10px",
              border: "1px solid #1b1c1d",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {deliveryLabel}
          </div>
        )}
      </div>

      {/* Separador */}
      <div style={{ borderTop: dashedBorder, margin: "8px 0" }} />

      {/* Cliente, Endereço e Data */}
      <div style={{ fontSize: 12, lineHeight: 1.6 }}>
        {(contact?.nome || sale.customer_name) && (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between" }}>
            <span style={{ color: "#7a6d6d" }}>Cliente</span>
            <span style={{ fontWeight: 600 }}>{contact?.nome || sale.customer_name}</span>
          </div>
        )}
        {receiptPhone && (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between" }}>
            <span style={{ color: "#7a6d6d" }}>Telefone</span>
            <span className="r-valor" style={{ fontWeight: 600 }}>{receiptPhone}</span>
          </div>
        )}
        {/* Só aparece em ENTREGA (retirada não precisa endereço do cliente); sem nenhum
            endereço, avisa em vez de calar (linha vem de receiptUtils.js). */}
        {receiptAddressLine && (
          <div style={{ margin: "4px 0" }}>
            <div style={{ color: "#7a6d6d" }}>Endereço</div>
            <div
              className="r-endereco"
              style={{
                fontSize: 13,
                fontWeight: 700,
                lineHeight: 1.35,
                overflowWrap: "anywhere",
                color: receiptAddressLine === ENDERECO_NAO_INFORMADO ? "#dc2626" : "inherit",
              }}
            >
              {receiptAddressLine}
            </div>
          </div>
        )}
        {obsJuntoDoEndereco && sale.observacoes && (
          <div style={{ margin: "4px 0" }}>
            <div style={{ color: "#7a6d6d" }}>Obs.</div>
            <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{sale.observacoes}</div>
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between" }}>
          <span style={{ color: "#7a6d6d" }}>Data</span>
          <span className="r-valor">{formatReceiptDateTime(sale.sale_date, sale.created_at)}</span>
        </div>
        {launchLine && (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "#7a6d6d" }}>Lançado em</span>
            <span className="r-valor">{launchLine}</span>
          </div>
        )}
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
              color: "#4a3d3d",
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
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", gap: 8, fontSize: 12, color: "#4a3d3d" }}>
                  <span className="r-valor" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {item.quantity} × {formatCurrency(item.unit_price)}
                  </span>
                  <span className="r-valor" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "#1b1c1d", minWidth: 72, textAlign: "right" }}>
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
        {productsSubtotalVisible && (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between" }}>
            <span style={{ color: "#4a3d3d" }}>Valor dos produtos</span>
            <span className="r-valor" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(subtotal)}
            </span>
          </div>
        )}

        {deliveryFee > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between" }}>
            <span style={{ color: "#4a3d3d" }}>Frete</span>
            <span className="r-valor" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(deliveryFee)}
            </span>
          </div>
        )}

        {discountAmount > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
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
            <span className="r-valor" style={{ fontVariantNumeric: "tabular-nums" }}>
              −{formatCurrency(discountAmount)}
            </span>
          </div>
        )}

        {showCardFeeRow && (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between" }}>
            <span style={{ color: "#4a3d3d" }}>
              {/* P3 (28/09/2026, item 8): taxa cobrada mas percentual zerado/ausente não pode
                  virar "(0%)" — omite o parêntese em vez de mostrar um número inventado. */}
              Taxa cartão{cardFeePercent > 0 ? ` (${formatCardFeePercent(cardFeePercent)})` : ""}
            </span>
            <span className="r-valor" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(cardFeeAmount)}
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
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          className="r-total-rotulo"
          style={{
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          Total
        </span>
        <span
          className="r-total"
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
          flexWrap: "wrap",
          justifyContent: "space-between",
          fontSize: 12,
          color: "#4a3d3d",
        }}
      >
        <span>Pagamento</span>
        <span style={{ fontWeight: 600, color: "#1b1c1d" }}>
          {getPaymentLabel(sale.payment_method)}
        </span>
      </div>

      {!obsJuntoDoEndereco && sale.observacoes && (
        <>
          <div style={{ borderTop: dashedBorder, margin: "8px 0" }} />
          <div style={{ fontSize: 12 }}>
            <span style={{ color: "#7a6d6d", fontWeight: 600 }}>Obs.</span>
            <div style={{ marginTop: 2, color: "#1b1c1d", whiteSpace: "pre-wrap" }}>
              {sale.observacoes}
            </div>
          </div>
        </>
      )}

      <div style={{ borderTop: dashedBorder, margin: "10px 0" }} />

      {/* Footer */}
      <div style={{ textAlign: "center", paddingTop: 2 }}>
        <div style={{ fontSize: 12, color: "#4a3d3d" }}>
          Obrigado pela preferência!
        </div>
        {unitWhatsApp && (
          <div style={{ fontSize: 11, color: "#4a3d3d", marginTop: 4 }}>
            WhatsApp: {unitWhatsApp}
          </div>
        )}
      </div>
    </div>
  );
});

export default SaleReceipt;
