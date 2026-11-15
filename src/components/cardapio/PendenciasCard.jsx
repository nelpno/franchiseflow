// Bloco 2: o que está travando venda agora (ESPEC do cardápio § 4.3). Só aparece com pendência; sem nenhuma vira a
// linha "Tudo em dia para vender." (E4). Tudo é calculado (lib/cardapioDigital.pendencias), nada é digitado.
import { Link } from "react-router-dom";
import NadaPendente from "@/components/shared/NadaPendente";
import { BTN_SECUNDARIO, H3_CARTAO, LINK_ACAO, TOM_ATENCAO } from "@/components/shared/adminUi";
import { linkWhatsAppMaxi } from "@/lib/contatoMaxi";

const COR = { err: "text-err", warn: "text-ink", info: "text-ink" };

function Acao({ acao, nomeUnidade, onBio, marcandoBio, onIrPromocao }) {
  if (!acao) return null; // item novo do checklist do banco sem botão mapeado: mostra o texto, sem ação
  if (acao.tipo === "rota") return <Link to={acao.to} className={LINK_ACAO}>{acao.rotulo}</Link>;
  if (acao.tipo === "whatsapp") {
    const motivo = acao.mensagem || "falta o WhatsApp público no cadastro";
    const href = linkWhatsAppMaxi(`Olá! Quero ligar o cardápio digital da ${nomeUnidade || "minha unidade"} e ${motivo}.`);
    return href ? <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_ACAO}>{acao.rotulo}</a> : null;
  }
  if (acao.tipo === "bio") {
    return (
      <button type="button" className={`${BTN_SECUNDARIO} min-h-11`} onClick={onBio} disabled={marcandoBio}>
        {marcandoBio ? "Salvando…" : acao.rotulo}
      </button>
    );
  }
  if (acao.tipo === "promocao") return <button type="button" className={LINK_ACAO} onClick={onIrPromocao}>{acao.rotulo}</button>;
  return null;
}

export default function PendenciasCard({ itens, nomeUnidade, onBio, marcandoBio, onIrPromocao }) {
  if (!itens.length) return <NadaPendente>Tudo em dia para vender.</NadaPendente>;
  return (
    <section className={`${TOM_ATENCAO} space-y-3`} aria-labelledby="cardapio-pendencias">
      <h2 id="cardapio-pendencias" className={H3_CARTAO}>Antes de divulgar</h2>
      <ul className="divide-y divide-warn/30">
        {itens.map((p) => (
          <li key={p.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 md:flex-row md:items-center md:gap-4">
            <p className={`min-w-0 text-sm ${COR[p.tom] || "text-ink"}`}>
              {p.destaque && <strong className="font-semibold">{p.destaque}</strong>}
              {p.destaque && p.texto ? " " : ""}
              {p.texto}
            </p>
            <div className="shrink-0 md:ml-auto">
              <Acao acao={p.acao} nomeUnidade={nomeUnidade} onBio={onBio} marcandoBio={marcandoBio} onIrPromocao={onIrPromocao} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
