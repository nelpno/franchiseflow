// Bloco 4: promoção do cardápio (ESPEC § 4.5–4.6). A franqueada ESCOLHE da lista, não digita regra:
// "Kit com preço fechado" ou "Leve N e ganhe %". O banco valida e gera o texto que o robô lê (promotions_combo);
// a mesma regra e o mesmo texto em lib/promocaoRegras.js servem de prévia. Uma promoção ativa por vez.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BTN_PRIMARIO, BTN_SECUNDARIO, CARTAO, CHIP, CHIP_ATIVO, CHIP_INATIVO, H2, H3_CARTAO, LINK_ACAO } from "@/components/shared/adminUi";
import { TIPOS, erroDaRegra, limparRegra, precoNormal, regraAtiva, regraVazia, reais, textoDaRegra, MAX_ITENS, NOME_MAX } from "@/lib/promocaoRegras";
import { nomeCurtoProduto, vencimentoPromocao } from "@/lib/cardapioDigital";

const CAMPO = "h-11 w-full rounded-xl border border-surface-line bg-white px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30";
const ROTULO_CAMPO = "mb-1 block text-sm font-semibold text-ink";

function brl(v) {
  return `R$ ${reais(v)}`;
}

function EscolherProduto({ aberto, onFechar, produtos, jaEscolhidos, onEscolher }) {
  const [busca, setBusca] = useState("");
  useEffect(() => { if (!aberto) setBusca(""); }, [aberto]);
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    return (produtos || [])
      .filter((p) => !jaEscolhidos.includes(p.produto))
      .filter((p) => !q || p.produto.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").includes(q));
  }, [produtos, jaEscolhidos, busca]);
  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escolher produto</DialogTitle>
          <DialogDescription>Os produtos do seu Estoque, com o preço de agora.</DialogDescription>
        </DialogHeader>
        <label className="sr-only" htmlFor="busca-produto-promo">Buscar produto</label>
        <input id="busca-produto-promo" className={CAMPO} placeholder="Buscar produto" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <ul className="max-h-[50vh] divide-y divide-surface-line overflow-y-auto">
          {lista.map((p) => (
            <li key={p.id}>
              <button type="button" className="flex min-h-11 w-full items-center gap-3 px-1 py-2 text-left text-sm hover:bg-surface" onClick={() => { onEscolher(p.produto); onFechar(); }}>
                <span className="min-w-0 flex-1 text-ink">{p.produto}</span>
                {p.zerado && <span className="shrink-0 text-xs font-semibold text-warn-ink">Em falta</span>}
                <span className="shrink-0 tabular-nums text-ink-2">{brl(p.preco)}</span>
              </button>
            </li>
          ))}
          {!lista.length && <li className="py-4 text-sm text-ink-3">Nenhum produto com esse nome.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function PreviaCliente({ regra, produtos, texto, kitNoCardapio }) {
  const normal = precoNormal(regra, produtos);
  if (regra.tipo === "kit" && kitNoCardapio) {
    return (
      <div className="rounded-2xl border border-surface-line bg-white p-3">
        <span className="inline-block rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
          Promoção{regra.vale_ate ? ` até ${regra.vale_ate.slice(8, 10)}/${regra.vale_ate.slice(5, 7)}` : ""}
        </span>
        <p className="mt-1 font-plus-jakarta text-base font-bold text-ink">{regra.nome || "Nome do kit"}</p>
        <p className="text-sm text-ink-2">{regra.itens.map((i) => `${i.qtd} ${nomeCurtoProduto(i.product_name)}`).join(" + ") || "Escolha os produtos"}</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-sm">
            {normal != null && <s className="text-ink-3">{brl(normal)}</s>}{" "}
            <b className="font-plus-jakarta text-xl font-extrabold text-brand-dark">{regra.preco ? brl(regra.preco) : "R$ —"}</b>
          </p>
          <span className="inline-flex min-h-11 items-center rounded-xl bg-brand px-3 text-sm font-semibold text-white">Pôr o kit no pedido</span>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-surface-line bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-3">Promoção da unidade</p>
      <p className="mt-1 line-clamp-2 text-sm text-ink">{texto || "O texto aparece aqui."}</p>
    </div>
  );
}

export default function PromocaoForm({ painel, hojeISO, salvando, onSalvar, onEncerrar, secaoRef }) {
  const ativa = regraAtiva(painel?.promocao_regras);
  const produtos = useMemo(() => (painel?.produtos || []).map((p) => ({ ...p, ativo: true })), [painel?.produtos]);
  const paraEscolher = useMemo(() => produtos.filter((p) => p.visivel !== false), [produtos]); // escondido não entra
  const venceLivre = !ativa ? vencimentoPromocao(null, painel?.promocao_texto, hojeISO) : null;
  // o formulário fica fechado atrás do botão (a chave cardapio_kit está desligada até o Nelson decidir)
  const [editando, setEditando] = useState(false);
  const [regra, setRegra] = useState(() => (ativa ? { ...regraVazia(ativa.tipo), ...ativa } : regraVazia("kit")));
  const [escolhendo, setEscolhendo] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [confirmarFim, setConfirmarFim] = useState(false);

  // a regra salva mudou no banco (salvou, encerrou, venceu): a tela volta para ela
  const chaveAtiva = JSON.stringify(ativa || null);
  useEffect(() => {
    setEditando(false);
    setRegra(ativa ? { ...regraVazia(ativa.tipo), ...ativa } : regraVazia("kit"));
    setTentou(false);
  }, [chaveAtiva]); // eslint-disable-line react-hooks/exhaustive-deps

  const erro = erroDaRegra(regra, produtos, hojeISO);
  const semPreco = regra.tipo === "kit" && !(Number(regra.preco) > 0);
  const texto = regra.itens.length && !semPreco ? textoDaRegra(limparRegra(regra), produtos) : null;
  const normal = precoNormal(regra, produtos);
  const desconto = regra.tipo === "kit" && normal && Number(regra.preco) > 0 ? Math.round((1 - Number(regra.preco) / normal) * 100) : null;
  const mudarTipo = (tipo) => setRegra((r) => ({ ...regraVazia(tipo), nome: r.nome, itens: r.itens.map((i) => ({ ...i, qtd: tipo === "percentual" ? 1 : i.qtd })), vale_ate: r.vale_ate }));
  const setQtd = (nome, d) => setRegra((r) => ({ ...r, itens: r.itens.map((i) => (i.product_name === nome ? { ...i, qtd: Math.min(20, Math.max(1, (Number(i.qtd) || 1) + d)) } : i)) }));
  const tirar = (nome) => setRegra((r) => ({ ...r, itens: r.itens.filter((i) => i.product_name !== nome) }));
  const salvar = () => {
    setTentou(true);
    if (erro) return;
    onSalvar(limparRegra(regra));
  };

  return (
    <section ref={secaoRef} id="bloco-promocao" className="scroll-mt-20 space-y-3" aria-labelledby="cardapio-promocao">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="cardapio-promocao" className={H2}>Promoção do cardápio</h2>
        <p className="text-sm text-ink-3">Aparece no topo do cardápio e o robô oferece uma vez por conversa.</p>
      </div>

      {ativa && !editando ? (
        <div className={`${CARTAO} space-y-3`}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={H3_CARTAO}>{ativa.nome}</h3>
            <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-semibold text-ok-ink">
              Ativa{ativa.vale_ate ? ` até ${ativa.vale_ate.slice(8, 10)}/${ativa.vale_ate.slice(5, 7)}` : ""}
            </span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-3">O robô diz</p>
            <p className="mt-1 text-sm text-ink">{painel?.promocao_texto}</p>
          </div>
          {!painel?.promocao_texto && (
            <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn-ink">
              Um produto desta promoção saiu do Estoque ou foi escondido do cardápio: o robô parou de oferecer. Mostre o produto de novo, edite ou encerre a promoção.
            </p>
          )}
          {!painel?.kit_no_cardapio && ativa.tipo === "kit" && (
            <p className="text-sm text-ink-3">No cardápio, por enquanto, ela aparece como texto no topo.</p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" className={`${BTN_SECUNDARIO} min-h-11`} onClick={() => setEditando(true)}>
              <MaterialIcon icon="edit" size={18} aria-hidden="true" /> Editar promoção
            </button>
            <button type="button" className={`${BTN_SECUNDARIO} min-h-11`} onClick={() => setConfirmarFim(true)} disabled={salvando}>
              Encerrar promoção
            </button>
          </div>
        </div>
      ) : !ativa && !editando ? (
        <div className={`${CARTAO} space-y-3`}>
          {painel?.promocao_texto ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={H3_CARTAO}>Promoção de agora</h3>
                {venceLivre && venceLivre.dias >= 0 && (
                  <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-semibold text-warn-ink">vence {venceLivre.ddmm}</span>
                )}
              </div>
              <p className="text-sm text-ink">{painel.promocao_texto}</p>
              <p className="text-xs text-ink-3">Texto escrito no Meu robô. No cardápio aparece no topo, como está.</p>
            </>
          ) : (
            <p className="text-sm text-ink-2">Sem promoção agora.</p>
          )}
          <button type="button" className={`${BTN_SECUNDARIO} min-h-11 w-full sm:w-auto`} onClick={() => setEditando(true)}>
            <MaterialIcon icon="add" size={18} aria-hidden="true" /> Criar promoção com produtos
          </button>
        </div>
      ) : (
        <div className={`${CARTAO} space-y-4`}>
          {!ativa && painel?.promocao_texto && (
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">
              Hoje o robô usa o texto do Meu robô: “{painel.promocao_texto}” Ao salvar, esta promoção fica no lugar dele.
            </p>
          )}

          <div>
            <p className={ROTULO_CAMPO}>Tipo</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo da promoção">
              {TIPOS.map((t) => (
                <button key={t.id} type="button" role="radio" aria-checked={regra.tipo === t.id} onClick={() => mudarTipo(t.id)}
                  className={`${CHIP} ${regra.tipo === t.id ? CHIP_ATIVO : CHIP_INATIVO}`}>{t.rotulo}</button>
              ))}
            </div>
          </div>

          <div>
            <label className={ROTULO_CAMPO} htmlFor="promo-nome">Nome</label>
            <input id="promo-nome" className={CAMPO} maxLength={NOME_MAX} value={regra.nome}
              placeholder={regra.tipo === "kit" ? "Ex.: Kit Nhoque com molho" : "Ex.: Leve 2 kg de nhoque"}
              onChange={(e) => setRegra((r) => ({ ...r, nome: e.target.value }))} />
            <p className="mt-1 text-xs text-ink-3">É o que o cliente e o robô leem ({regra.nome.length}/{NOME_MAX}).</p>
          </div>

          <div>
            <p className={ROTULO_CAMPO}>{regra.tipo === "kit" ? "O que vem no kit" : "Produto(s) da promoção"}</p>
            <ul className="flex flex-wrap gap-2">
              {regra.itens.map((i) => (
                <li key={i.product_name} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-surface-line bg-white pl-3 text-sm text-ink">
                  {regra.tipo === "kit" && (
                    <>
                      <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface disabled:opacity-40"
                        aria-label={`Menos ${i.product_name}`} disabled={Number(i.qtd) <= 1} onClick={() => setQtd(i.product_name, -1)}>
                        <MaterialIcon icon="remove" size={16} aria-hidden="true" />
                      </button>
                      <span className="tabular-nums font-semibold">{i.qtd} ×</span>
                      <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface"
                        aria-label={`Mais ${i.product_name}`} onClick={() => setQtd(i.product_name, 1)}>
                        <MaterialIcon icon="add" size={16} aria-hidden="true" />
                      </button>
                    </>
                  )}
                  <span className="max-w-[16rem] truncate">{i.product_name}</span>
                  <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full text-ink-3 hover:bg-surface"
                    aria-label={`Tirar ${i.product_name}`} onClick={() => tirar(i.product_name)}>
                    <MaterialIcon icon="close" size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
              {regra.itens.length < MAX_ITENS && (
                <li>
                  <button type="button" className={`${BTN_SECUNDARIO} min-h-11 rounded-full`} onClick={() => setEscolhendo(true)}>
                    <MaterialIcon icon="add" size={18} aria-hidden="true" /> produto
                  </button>
                </li>
              )}
            </ul>
          </div>

          {regra.tipo === "kit" && regra.itens.some((i) => produtos.find((p) => p.produto === i.product_name)?.zerado) && (
            <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn-ink">
              Um produto do kit está zerado: o kit só aparece no cardápio depois que você repor. O robô continua oferecendo pelo texto.
            </p>
          )}

          {regra.tipo === "kit" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className={ROTULO_CAMPO}>Preço normal</p>
                <p className="flex h-11 items-center rounded-xl bg-surface-2 px-3 text-sm tabular-nums text-ink-2">
                  {normal != null ? `${brl(normal)} (soma sozinho)` : "Escolha os produtos"}
                </p>
              </div>
              <div>
                <label className={ROTULO_CAMPO} htmlFor="promo-preco">Preço do kit</label>
                <input id="promo-preco" className={CAMPO} type="number" inputMode="decimal" min="0" step="0.01" value={regra.preco ?? ""}
                  onChange={(e) => setRegra((r) => ({ ...r, preco: e.target.value === "" ? null : e.target.value }))} />
                {desconto != null && desconto > 0 && <p className="mt-1 text-xs text-ink-3">{desconto}% de desconto (máximo 35%).</p>}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={ROTULO_CAMPO} htmlFor="promo-min">Quantas (somando os produtos)</label>
                <select id="promo-min" className={CAMPO} value={regra.min_qtd} onChange={(e) => setRegra((r) => ({ ...r, min_qtd: Number(e.target.value) }))}>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className={ROTULO_CAMPO} htmlFor="promo-pct">Desconto (%)</label>
                <input id="promo-pct" className={CAMPO} type="number" inputMode="numeric" min="1" max="35" step="1" value={regra.pct ?? ""}
                  onChange={(e) => setRegra((r) => ({ ...r, pct: e.target.value === "" ? null : Number(e.target.value) }))} />
              </div>
            </div>
          )}

          <div className="sm:max-w-xs">
            <label className={ROTULO_CAMPO} htmlFor="promo-ate">Vale até</label>
            <input id="promo-ate" className={CAMPO} type="date" min={hojeISO} value={regra.vale_ate || ""}
              onChange={(e) => setRegra((r) => ({ ...r, vale_ate: e.target.value || null }))} />
            <p className="mt-1 text-xs text-ink-3">Sem data, vale até você encerrar. No dia seguinte à data, sai sozinha do cardápio e do robô.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className={ROTULO_CAMPO}>Como o cliente vê</p>
              <PreviaCliente regra={regra} produtos={produtos} texto={texto} kitNoCardapio={!!painel?.kit_no_cardapio} />
            </div>
            <div>
              <p className={ROTULO_CAMPO}>Como o robô vai dizer</p>
              <p className="rounded-2xl bg-surface-2 p-3 text-sm text-ink">{texto || (regra.itens.length ? "Digite o preço do kit para ver a frase." : "Escolha os produtos para ver a frase.")}</p>
            </div>
          </div>

          <p className="text-sm text-ink-3">Um item do kit ficou em falta? O kit some do cardápio e volta quando repor.</p>

          {tentou && erro && <p className="text-sm font-semibold text-err" role="alert">{erro}</p>}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" className={`${BTN_PRIMARIO} min-h-11`} onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar promoção"}
            </button>
            <button type="button" className={`${BTN_SECUNDARIO} min-h-11`} onClick={() => setEditando(false)} disabled={salvando}>Cancelar</button>
          </div>
        </div>
      )}

      <Link to="/FranchiseSettings" className={LINK_ACAO}>Prefere escrever a promoção? Abrir no Meu robô →</Link>

      <EscolherProduto aberto={escolhendo} onFechar={() => setEscolhendo(false)} produtos={paraEscolher}
        jaEscolhidos={regra.itens.map((i) => i.product_name)}
        onEscolher={(nome) => setRegra((r) => ({ ...r, itens: [...r.itens, { product_name: nome, qtd: 1 }] }))} />

      <AlertDialog open={confirmarFim} onOpenChange={setConfirmarFim}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar a promoção?</AlertDialogTitle>
            <AlertDialogDescription>
              “{ativa?.nome}” sai do cardápio e o robô para de oferecer agora. O campo de promoção do Meu robô fica vazio para você escrever, se quiser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Voltar</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" onClick={() => onEncerrar()}>Encerrar promoção</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
