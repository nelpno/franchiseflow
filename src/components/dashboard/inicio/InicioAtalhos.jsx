// S18.1 — 7º bloco da Início nova (chave ui_v2): atalhos que NÃO repetem a barra de baixo do
// menu novo (Início, Vendas, Nova venda, Estoque, Mais). Levam ao que fica dentro de "Mais" ou
// mais fundo (Repor = Estoque › Reposição).
import React from "react";
import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";

export const ATALHOS_INICIO = [
  { rotulo: "Repor estoque", to: "/Gestao?tab=reposicao", icone: "local_shipping" },
  { rotulo: "Clientes", to: "/MyContacts", icone: "people" },
  { rotulo: "Resultado do mês", to: "/Gestao?tab=resultado", icone: "bar_chart" },
  { rotulo: "Meu robô", to: "/FranchiseSettings", icone: "smart_toy" },
];

export default function InicioAtalhos() {
  return (
    <nav aria-label="Atalhos" className="grid grid-cols-2 gap-3">
      {ATALHOS_INICIO.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-surface-line bg-white px-4 py-3 text-sm font-semibold text-ink touch-manipulation transition-colors hover:bg-surface active:scale-[0.99]"
        >
          <MaterialIcon icon={a.icone} size={22} className="shrink-0 text-brand" aria-hidden="true" />
          <span className="min-w-0">{a.rotulo}</span>
        </Link>
      ))}
    </nav>
  );
}
