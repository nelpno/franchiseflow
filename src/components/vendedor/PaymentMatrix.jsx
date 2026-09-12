import MaterialIcon from "@/components/ui/MaterialIcon";

// Uma linha por forma de pagamento, uma coluna por modalidade ligada (entrega/retirada).
// Coluna com valor null não aparece. Valor que não está na lista (o legado "card_machine")
// fica intacto no array: marcar e desmarcar mexe só no que a tela mostra.
export default function PaymentMatrix({ methods, entrega, retirada, onChangeEntrega, onChangeRetirada }) {
  const colunas = [
    entrega !== null && { chave: "entrega", rotulo: "Entrega", valor: entrega, mudar: onChangeEntrega },
    retirada !== null && { chave: "retirada", rotulo: "Retirada", valor: retirada, mudar: onChangeRetirada },
  ].filter(Boolean);

  if (colunas.length === 0) {
    return (
      <p className="text-xs text-[#3d4a42]/60">
        Ligue a entrega ou a retirada na etapa anterior para escolher as formas de pagamento.
      </p>
    );
  }

  const alternar = (coluna, valor) =>
    coluna.mudar(coluna.valor.includes(valor) ? coluna.valor.filter((v) => v !== valor) : [...coluna.valor, valor]);

  return (
    <div className="overflow-x-auto rounded-xl border border-[#bccac0]/20">
      <table className="w-full text-sm">
        <thead className="bg-surface">
          <tr>
            <th className="text-left px-3 sm:px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#3d4a42]/60">Forma</th>
            {colunas.map((c) => (
              <th key={c.chave} className="px-1 sm:px-3 py-2 w-[4.5rem] sm:w-28 text-center text-[11px] font-semibold uppercase tracking-wide text-[#3d4a42]/60">
                {c.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {methods.map((m) => (
            <tr key={m.value} className="border-t border-[#bccac0]/10">
              <td className="px-3 sm:px-4 py-2.5">
                <span className="flex items-center gap-2 text-[#3d4a42] text-[13px] sm:text-sm">
                  <MaterialIcon icon={m.icon} size={16} className="text-[#3d4a42]/50" />
                  {m.label}
                </span>
              </td>
              {colunas.map((c) => {
                const marcado = c.valor.includes(m.value);
                return (
                  <td key={c.chave} className="px-1 sm:px-3 py-2.5 text-center">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={marcado}
                      aria-label={`${m.label} ${c.rotulo.toLowerCase()}`}
                      onClick={() => alternar(c, m.value)}
                      className={`w-6 h-6 rounded-md border-2 inline-flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 ${
                        marcado ? "bg-brand border-brand text-white" : "border-[#bccac0] hover:border-brand/60"
                      }`}
                    >
                      {marcado && <MaterialIcon icon="check" size={16} />}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
