import React from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Button } from "@/components/ui/button";

/**
 * Estado vazio padrão do app.
 *
 * Existe porque cada tela inventava o seu: o Resultado dizia "Sem vendas neste mês.",
 * o Financeiro não dizia nada e a home do franqueado mostrava um grid de zeros — que é
 * pior que vazio, porque parece que a venda sumiu.
 *
 * Regra: sempre diz o que fazer em seguida quando existe um próximo passo (`acao`).
 *
 *   <EmptyState icone="search_off" titulo="Nenhuma unidade encontrada" texto="…"
 *     acao={{ rotulo: "Limpar busca", onClick }} cartao />
 *
 * `cartao`: embrulha no cartão K1 do padrão do admin (lista/página vazia, regra E3).
 */
export default function EmptyState({
  icone = "inbox",
  titulo,
  texto,
  acao, // { rotulo, onClick } ou { rotulo, href }
  cartao = false,
  className = "",
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-10 px-4 ${cartao ? "rounded-2xl border border-surface-line bg-white" : ""} ${className}`}>
      <MaterialIcon icon={icone} size={48} className="text-ink-4 mb-3" aria-hidden="true" />
      <h3 className="text-base font-bold text-ink font-plus-jakarta">{titulo}</h3>
      {texto && <p className="text-sm text-ink-2 mt-1 max-w-sm">{texto}</p>}
      {acao && (
        <Button
          className="mt-4 h-12 min-w-[48px] px-5"
          onClick={acao.onClick}
          {...(acao.href ? { asChild: true } : {})}
        >
          {acao.href ? <a href={acao.href}>{acao.rotulo}</a> : acao.rotulo}
        </Button>
      )}
    </div>
  );
}
