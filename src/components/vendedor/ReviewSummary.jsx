import MaterialIcon from "@/components/ui/MaterialIcon";
import { PAYMENT_METHODS, DELIVERY_METHODS, PIX_KEY_TYPES } from "@/lib/franchiseUtils";

function ReviewSection({ icon, title, fields, stepNum, onGoToStep }) {
  const hasWarning = fields.some((f) => f.warning);

  return (
    <div className="border border-[#bccac0]/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MaterialIcon icon={icon} filled size={18} className="text-[#b91c1c]" />
          <h4 className="text-sm font-bold text-[#3d4a42]">{title}</h4>
          {hasWarning && (
            <MaterialIcon icon="warning" filled size={14} className="text-amber-500" />
          )}
        </div>
        <button
          type="button"
          onClick={() => onGoToStep(stepNum)}
          className="text-xs text-[#b91c1c] font-semibold hover:underline"
        >
          Editar
        </button>
      </div>
      <div className="space-y-1.5">
        {fields.map((f, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-xs text-[#3d4a42]/50 min-w-[120px]">{f.label}:</span>
            {f.warning ? (
              <span className="text-xs text-amber-600 italic">{f.value || "Não preenchido"}</span>
            ) : (
              <span className="text-xs text-[#1b1c1d] font-medium">{f.value || "—"}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReviewSummary({ formData, onGoToStep }) {
  const deliveryMethodLabel = DELIVERY_METHODS.find(
    (m) => m.value === formData.delivery_method
  )?.label;

  const pixTypeLabel = PIX_KEY_TYPES.find(
    (t) => t.value === formData.pix_key_type
  )?.label;

  const paymentLabels = (arr) => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return "";
    return arr
      .map((v) => PAYMENT_METHODS.find((m) => m.value === v)?.label || v)
      .join(", ");
  };

  const feeRulesText = () => {
    const rules = formData.delivery_fee_rules;
    if (!rules || !Array.isArray(rules) || rules.length === 0) return "";
    return rules
      .filter((r) => r.max_km && r.fee)
      .map((r) => `Até ${r.max_km}km: R$ ${r.fee}`)
      .join(" | ");
  };

  const hasDelivery = formData.has_delivery ?? true;
  const hasPickup = formData.has_pickup ?? false;

  // Build operation & payment fields
  const operationFields = [
    { label: "Entrega", value: hasDelivery ? "Sim" : "Não" },
    ...(hasDelivery ? [{ label: "Método entrega", value: deliveryMethodLabel || "Não definido", warning: !formData.delivery_method }] : []),
    ...(hasDelivery ? [{ label: "Pgto entrega", value: paymentLabels(formData.payment_delivery), warning: !formData.payment_delivery?.length }] : []),
    { label: "Retirada", value: hasPickup ? "Sim" : "Não" },
    ...(hasPickup ? [{ label: "Pgto retirada", value: paymentLabels(formData.payment_pickup), warning: !formData.payment_pickup?.length }] : []),
    { label: "Tipo PIX", value: pixTypeLabel },
    { label: "Chave PIX", value: formData.pix_key_data },
    { label: "Link pagamento", value: formData.payment_link },
  ];

  return (
    <div className="space-y-4">
      <ReviewSection
        icon="storefront"
        title="Sua Unidade"
        stepNum={1}
        onGoToStep={onGoToStep}
        fields={[
          { label: "Nome", value: formData.franchise_name, warning: !formData.franchise_name },
          { label: "Endereço", value: formData.unit_address, warning: !formData.unit_address },
          { label: "Referência", value: formData.address_reference },
          { label: "WhatsApp pessoal", value: formData.personal_phone_for_summary },
        ]}
      />

      <ReviewSection
        icon="schedule"
        title="Horários"
        stepNum={2}
        onGoToStep={onGoToStep}
        fields={[
          { label: "Dias", value: formData.working_days, warning: !formData.working_days },
          { label: "Horário", value: formData.opening_hours, warning: !formData.opening_hours },
        ]}
      />

      <ReviewSection
        icon="settings"
        title="Operação e Pagamentos"
        stepNum={3}
        onGoToStep={onGoToStep}
        fields={operationFields}
      />

      {hasDelivery && (
        <ReviewSection
          icon="delivery_dining"
          title="Entrega"
          stepNum={4}
          onGoToStep={onGoToStep}
          fields={[
            { label: "Raio máximo", value: formData.max_delivery_radius_km ? `${formData.max_delivery_radius_km} km` : "" },
            { label: "Pedido mínimo", value: formData.min_order_value ? `R$ ${formData.min_order_value}` : "" },
            { label: "Tempo entrega", value: formData.avg_prep_time_minutes ? `${formData.avg_prep_time_minutes} min` : "" },
            { label: "Horário limite", value: formData.order_cutoff_time },
            { label: "Taxas de entrega", value: feeRulesText() },
          ]}
        />
      )}

      <ReviewSection
        icon="smart_toy"
        title="Seu Vendedor"
        stepNum={5}
        onGoToStep={onGoToStep}
        fields={[
          { label: "Nome", value: formData.agent_name, warning: !formData.agent_name },
          { label: "Promoções", value: formData.promotions_combo ? "Configurado" : "", warning: !formData.promotions_combo },
          { label: "Catálogo", value: formData.catalog_image_url ? "Enviado" : "", warning: !formData.catalog_image_url },
        ]}
      />
    </div>
  );
}
