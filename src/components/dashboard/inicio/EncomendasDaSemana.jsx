// Cartão "Encomendas desta semana" da Início (17/11/2026): só aparece quando há encomenda a entregar
// em até 7 dias (as atrasadas entram). Não aparece em carregamento nem em erro: é um lembrete, não um
// painel, e a falta dele nunca pode derrubar a Início. Regras: lib/encomendas.js.
import React from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { useEncomendas } from "@/hooks/useEncomendas";
import { diasAte, daSemana, rotuloPrazo, totalUnidades } from "@/lib/encomendas";
import { formatDateOnly } from "@/lib/dateOnly";
import { CARTAO, H3_CARTAO, LINK_ACAO } from "@/components/shared/adminUi";

const MAX_LINHAS = 3;

export default function EncomendasDaSemana({ evoId, className = "" }) {
  const { encomendas } = useEncomendas(evoId);
  const hoje = format(new Date(), "yyyy-MM-dd");
  const semana = daSemana(encomendas, hoje);
  if (semana.length === 0) return null;
  const resto = semana.length - MAX_LINHAS;

  return (
    <section aria-label="Encomendas desta semana" className={`${CARTAO} ${className}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <MaterialIcon icon="event_available" size={22} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={H3_CARTAO}>
            Encomendas desta semana · <span className="tabular-nums">{semana.length}</span>
          </h2>
          <ul className="mt-2 space-y-1.5">
            {semana.slice(0, MAX_LINHAS).map((e) => {
              const dias = diasAte(e.entregar_em, hoje);
              return (
                <li key={e.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink">
                    <span className="font-semibold">{e.cliente_nome}</span>
                    <span className="text-ink-2"> · {totalUnidades(e)} un.</span>
                  </span>
                  <span className={`shrink-0 text-xs ${dias < 0 ? "font-semibold text-err" : "text-ink-2"}`}>
                    {formatDateOnly(e.entregar_em, "dd/MM")} · {rotuloPrazo(dias)}
                  </span>
                </li>
              );
            })}
          </ul>
          {resto > 0 && <p className="mt-1 text-xs text-ink-2">e mais {resto}</p>}
          <Link to="/Vendas?aba=encomendas" className={`${LINK_ACAO} mt-1`}>
            Ver encomendas
            <MaterialIcon icon="chevron_right" size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
