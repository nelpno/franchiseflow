import MaterialIcon from "@/components/ui/MaterialIcon";
import { PAYMENT_METHODS, PIX_KEY_TYPES, WEEKDAYS } from "@/lib/franchiseUtils";

function ReviewSection({ icon, title, fields, stepNum, onGoToStep }) {
  const hasWarning = fields.some((f) => f.warning);

  return (
    <div className="border border-[#bccac0]/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MaterialIcon icon={icon} filled size={18} className="text-brand" />
          <h4 className="text-sm font-bold text-[#3d4a42]">{title}</h4>
          {hasWarning && (
            <MaterialIcon icon="warning" filled size={14} className="text-amber-500" />
          )}
        </div>
        <button
          type="button"
          onClick={() => onGoToStep(stepNum)}
          className="text-xs text-brand font-semibold hover:underline"
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
              <span className="text-xs text-ink font-medium">{f.value || "—"}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReviewSummary({ formData, onGoToStep }) {
  const pixTypeLabel = PIX_KEY_TYPES.find((t) => t.value === formData.pix_key_type)?.label;

  const paymentLabels = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return "";
    return arr.map((v) => PAYMENT_METHODS.find((m) => m.value === v)?.label || v).join(", ");
  };

  const feeRulesText = (rules) => {
    if (!rules) return "";
    if (rules?.mode === "modality") {
      return (rules.rules || [])
        .filter((r) => r.label && r.fee)
        .map((r) => `${r.label}: R$ ${r.fee}`)
        .join(" | ");
    }
    return (Array.isArray(rules) ? rules : [])
      .filter((r) => r.max_km && r.fee)
      .map((r) => `Até ${r.max_km}km: R$ ${r.fee}`)
      .join(" | ");
  };

  const scheduleLabel = (days) => {
    if (!days || days.length === 0) return "";
    const ordered = [...days].sort(
      (a, b) => WEEKDAYS.findIndex((w) => w.value === a) - WEEKDAYS.findIndex((w) => w.value === b)
    );
    if (ordered.length === 7) return "Todos os dias";
    if (ordered.length === 1) return WEEKDAYS.find((w) => w.value === ordered[0])?.label || "";
    const indices = ordered.map((d) => WEEKDAYS.findIndex((w) => w.value === d));
    const isConsecutive = indices.every((idx, i) => i === 0 || idx === indices[i - 1] + 1);
    if (isConsecutive) return `${WEEKDAYS[indices[0]]?.label}-${WEEKDAYS[indices[indices.length - 1]]?.label}`;
    return ordered.map((d) => WEEKDAYS.find((w) => w.value === d)?.label).join(", ");
  };

  const hasDelivery = formData.has_delivery ?? true;
  const hasPickup = formData.has_pickup ?? false;

  const deliveryScheduleFields = () => {
    const schedule = formData.delivery_schedule;
    if (!Array.isArray(schedule) || schedule.length === 0) {
      return [{ label: "Horário de entrega", value: "", warning: true }];
    }
    return schedule.map((range, i) => {
      const time = `${range.delivery_start || "?"} às ${range.delivery_end || "?"}`;
      const fee = range.charges_fee === false ? "Frete grátis" : feeRulesText(range.fee_rules);
      const cutoff = range.order_cutoff ? ` | Pedidos até ${range.order_cutoff}` : "";
      return { label: scheduleLabel(range.days) || `Faixa ${i + 1}`, value: `${time}${fee ? ` — ${fee}` : ""}${cutoff}` };
    });
  };

  const pickupHoursFields = () => {
    const ps = formData.pickup_schedule;
    if ((formData.has_custom_pickup_hours || !hasDelivery) && Array.isArray(ps) && ps.length > 0) {
      return [{ label: "Horário", value: ps.map((r) => `${scheduleLabel(r.days)}: ${r.open}-${r.close}`).join(" | ") }];
    }
    if (!hasDelivery) return [{ label: "Horário", value: formData.opening_hours || "", warning: !formData.opening_hours }];
    return [{ label: "Horário", value: "O mesmo da entrega" }];
  };

  const usados = new Set([
    ...(hasDelivery ? formData.payment_delivery || [] : []),
    ...(hasPickup ? formData.payment_pickup || [] : []),
  ]);

  return (
    <div className="space-y-4">
      <ReviewSection
        icon="storefront"
        title="Sua unidade"
        stepNum={1}
        onGoToStep={onGoToStep}
        fields={[
          { label: "Nome", value: formData.franchise_name, warning: !formData.franchise_name },
          { label: "Rua e número", value: formData.street_address, warning: !formData.street_address },
          { label: "Bairro", value: formData.neighborhood, warning: !formData.neighborhood },
          { label: "Cidade", value: formData.city, warning: !formData.city },
          ...(formData.cep ? [{ label: "CEP", value: formData.cep }] : []),
          { label: "Referência", value: formData.address_reference },
          { label: "WhatsApp (pedidos)", value: formData.personal_phone_for_summary, warning: !formData.personal_phone_for_summary },
        ]}
      />

      <ReviewSection
        icon="local_shipping"
        title="Entrega e retirada"
        stepNum={2}
        onGoToStep={onGoToStep}
        fields={[
          { label: "Entrega", value: hasDelivery ? "Sim" : "Não" },
          ...(hasDelivery
            ? [
                { label: "Raio máximo", value: formData.max_delivery_radius_km ? `${formData.max_delivery_radius_km} km` : "", warning: !formData.max_delivery_radius_km },
                { label: "Pedido mínimo", value: formData.min_order_value ? `R$ ${formData.min_order_value}` : "Sem mínimo" },
                { label: "Prazo", value: formData.avg_prep_time_minutes ? `em até ${formData.avg_prep_time_minutes} min` : "Sem prazo em minutos" },
                ...deliveryScheduleFields(),
              ]
            : []),
          { label: "Retirada", value: hasPickup ? "Sim" : "Não" },
          ...(hasPickup
            ? [
                { label: "Tipo", value: formData.pickup_is_store ? "Loja / ponto físico" : "Retirada simples" },
                { label: "Hora combinada", value: formData.pickup_requires_scheduling !== false ? "Sim" : "Não" },
                { label: "Endereço", value: formData.pickup_address || "O da unidade" },
                ...pickupHoursFields(),
              ]
            : []),
        ]}
      />

      <ReviewSection
        icon="payments"
        title="Pagamento"
        stepNum={3}
        onGoToStep={onGoToStep}
        fields={[
          ...(hasDelivery ? [{ label: "Na entrega", value: paymentLabels(formData.payment_delivery), warning: !formData.payment_delivery?.length }] : []),
          ...(hasPickup ? [{ label: "Na retirada", value: paymentLabels(formData.payment_pickup), warning: !formData.payment_pickup?.length }] : []),
          ...(usados.has("pix")
            ? [
                { label: "Chave Pix", value: formData.pix_key_data ? `${formData.pix_key_data}${pixTypeLabel ? ` (${pixTypeLabel})` : ""}` : "", warning: !formData.pix_key_data },
                { label: "Titular", value: [formData.pix_holder_name, formData.pix_bank].filter(Boolean).join(" - ") },
              ]
            : []),
          ...(usados.has("payment_link") ? [{ label: "Link", value: formData.payment_link || "A unidade envia na hora" }] : []),
          { label: "Repassa taxa", value: formData.charges_card_fee_to_customer ? "Sim" : "Não" },
        ]}
      />

      <ReviewSection
        icon="smart_toy"
        title="Seu vendedor"
        stepNum={4}
        onGoToStep={onGoToStep}
        fields={[
          { label: "Atendente", value: formData.agent_name, warning: !formData.agent_name },
          { label: "Catálogo", value: formData.catalog_image_url ? "Enviado" : "", warning: !formData.catalog_image_url },
          // vazio é o normal (32 unidades): não é alerta
          { label: "Promoções", value: formData.promotions_combo ? "Configuradas" : "Nenhuma" },
          { label: "Reserva sem pagar", value: formData.accepts_reservation_without_payment ? "Aceita" : "Não aceita" },
        ]}
      />
    </div>
  );
}
