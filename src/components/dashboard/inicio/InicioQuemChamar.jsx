// S18.1 — 6º bloco da Início nova (chave ui_v2): "Quem chamar hoje" (o cartão de sempre,
// DailyActionsList) com um CONVITE para a unidade que nunca usou (nenhuma linha em
// contact_actions; medido 28/09: 21 de 66 unidades ativas, 17 delas vendendo).
// O convite some sozinho no primeiro "Chamar" (a consulta roda de novo ao voltar à Início).
import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import MaterialIcon from "@/components/ui/MaterialIcon";
import DailyActionsList from "@/components/clientes/DailyActionsList";
import { unidadeJaUsouQuemChamar } from "@/entities/inicio";
import { cidadeDaUnidade } from "@/lib/customerActions";
import { TOM_MAXI, BTN_PRIMARIO, LINK_ACAO } from "@/components/shared/adminUi";

function Convite() {
  return (
    <section className={TOM_MAXI} aria-label="Conheça o Quem chamar hoje">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70 text-brand">
          <MaterialIcon icon="campaign" size={22} aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-1">
          <h2 className="font-plus-jakarta text-base font-bold text-ink">Conheça o “Quem chamar hoje”</h2>
          <p className="text-sm leading-relaxed text-ink-2">
            Todo dia o app monta uma lista curta de clientes para você chamar no WhatsApp: quem quase
            comprou, quem costuma comprar de novo e quem sumiu. A mensagem já vem pronta; é só tocar em Chamar.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link to="/MyContacts?aba=hoje" className={`${BTN_PRIMARIO} min-h-[44px]`}>
          Ver a lista de hoje
        </Link>
        <Link to="/Tutoriais?abrir=clientes" className={LINK_ACAO}>
          Como funciona?
        </Link>
      </div>
    </section>
  );
}

export default function InicioQuemChamar({ evoId, franchise }) {
  const { data: jaUsou } = useQuery({
    queryKey: ["quem-chamar-ja-usou", evoId],
    queryFn: ({ signal }) => unidadeJaUsouQuemChamar(evoId, { signal }),
    enabled: !!evoId,
    staleTime: 60 * 1000,
    retry: 1,
  });

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* só quando a resposta chegou e disse "nunca usou" (erro/carregando = sem convite) */}
      {jaUsou === false && <Convite />}
      <DailyActionsList variant="compact" franchiseId={evoId} cidade={cidadeDaUnidade(franchise)} />
    </div>
  );
}
